require("dotenv").config();
const mongoose = require("mongoose");
const { Expo } = require("expo-server-sdk");

const User = require("../models/User");
require("../models/Category");
require("../models/MenuItem");
const SmartOfferRule = require("../models/SmartOfferRule");
const PersonalizedOffer = require("../models/PersonalizedOffer");
const PersonalizedOfferEvent = require("../models/PersonalizedOfferEvent");

const OPEN_STATUSES = ["active", "viewed", "clicked"];

const personalize = (text, offer) => {
  if (!text) return "";
  const userName = String(offer.user?.name || "cher client").trim();
  const categoryName = offer.targetCategory?.name || "";
  const itemName = offer.targetMenuItem?.name || offer.freeItem?.name || "";
  return String(text)
    .replace(/{name}|{{name}}/g, userName)
    .replace(/{category}/g, categoryName)
    .replace(/{item}/g, itemName)
    .replace(/{discount}/g, String(offer.discountValue || 0))
    .replace(/{points}/g, String(offer.bonusPoints || 0))
    .replace(/{threshold}/g, String(offer.bonusThreshold || 0));
};

const run = async () => {
  const shouldApply = process.argv.includes("--apply");
  const uri = process.env.DEV_DB_CONNECTION;
  if (!uri) throw new Error("DEV_DB_CONNECTION is required.");

  await mongoose.connect(uri);
  try {
    const now = new Date();
    const [rules, offers] = await Promise.all([
      SmartOfferRule.find().select("strategyId updatedAt").lean(),
      PersonalizedOffer.find({
        status: { $in: OPEN_STATUSES },
        validUntil: { $gt: now },
      })
        .populate("user", "name expo_token appIsInstalled")
        .populate("targetCategory", "name")
        .populate("targetMenuItem", "name")
        .populate("freeItem", "name")
        .lean(),
    ]);
    const ruleByStrategy = new Map(rules.map((rule) => [rule.strategyId, rule]));
    const latestNotifiedEvents = await PersonalizedOfferEvent.aggregate([
      {
        $match: {
          personalizedOffer: { $in: offers.map((offer) => offer._id) },
          eventType: "notified",
        },
      },
      {
        $group: {
          _id: "$personalizedOffer",
          lastNotifiedAt: { $max: "$timestamp" },
        },
      },
    ]);
    const lastNotifiedByOffer = new Map(
      latestNotifiedEvents.map((event) => [String(event._id), event.lastNotifiedAt]),
    );

    const candidates = offers.filter((offer) => {
      const lastNotifiedAt = lastNotifiedByOffer.get(String(offer._id));
      const rule = ruleByStrategy.get(offer.strategyId);
      return lastNotifiedAt && rule?.updatedAt &&
        new Date(rule.updatedAt) > new Date(lastNotifiedAt);
    });
    const sendable = candidates.filter((offer) =>
      offer.user &&
      offer.user.appIsInstalled !== false &&
      Expo.isExpoPushToken(offer.user.expo_token),
    );
    const byStrategy = {};
    for (const offer of sendable) {
      byStrategy[offer.strategyId] = (byStrategy[offer.strategyId] || 0) + 1;
    }

    console.log(JSON.stringify({
      mode: shouldApply ? "apply" : "dry-run",
      candidates: candidates.length,
      sendable: sendable.length,
      skippedWithoutValidPushToken: candidates.length - sendable.length,
      byStrategy,
    }, null, 2));
    if (!shouldApply || sendable.length === 0) return;

    const expo = new Expo({ useFcmV1: true });
    const messages = sendable.map((offer) => ({
      to: offer.user.expo_token,
      sound: "default",
      title: personalize(offer.notificationTitle, offer),
      body: personalize(offer.notificationBody, offer),
      priority: "high",
      data: {
        type: "smart_offer",
        offerId: String(offer._id),
        userId: String(offer.user._id),
      },
    }));
    const chunks = expo.chunkPushNotifications(messages);
    let cursor = 0;
    let accepted = 0;
    let rejected = 0;
    let invalidDevices = 0;

    for (const chunk of chunks) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      const events = [];
      const invalidUserIds = [];
      for (let index = 0; index < tickets.length; index++) {
        const ticket = tickets[index];
        const offer = sendable[cursor + index];
        if (ticket?.status === "ok") {
          accepted++;
          events.push({
            personalizedOffer: offer._id,
            user: offer.user._id,
            eventType: "notified",
            timestamp: new Date(),
          });
        } else {
          rejected++;
          if (ticket?.details?.error === "DeviceNotRegistered") {
            invalidDevices++;
            invalidUserIds.push(offer.user._id);
          }
        }
      }
      if (events.length > 0) {
        await PersonalizedOfferEvent.insertMany(events, { ordered: false });
      }
      if (invalidUserIds.length > 0) {
        await User.updateMany(
          { _id: { $in: invalidUserIds } },
          { $set: { expo_token: null, appIsInstalled: false, appUninstalledAt: new Date() } },
        );
      }
      cursor += chunk.length;
    }

    console.log(JSON.stringify({ accepted, rejected, invalidDevices }));
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
