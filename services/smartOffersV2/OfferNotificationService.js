const { Expo } = require("expo-server-sdk");
const User = require("../../models/User");
const PersonalizedOffer = require("../../models/PersonalizedOffer");
const PersonalizedOfferEvent = require("../../models/PersonalizedOfferEvent");
const SystemStat = require("../../models/SystemStat");
const { sendSmartOfferUninstalledEmail } = require("../offersServices/smartOfferMailService");
const {
  buildSmartOfferNotificationBody,
  calculateSmartOfferValidUntil,
} = require("../../utils/smartOfferNotificationBody");

const TRIGGER_BATCH_SIZE = 1000;
const TRIGGER_BATCH_DELAY = 100;
const REMINDER_BATCH_SIZE = 50;

// Shared in-memory state across jobs
const pendingReceiptMap = {};
let triggerJobRunning = false;

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const triggerScheduledOffersJob = async () => {
  if (triggerJobRunning) {
    console.log("[triggerScheduledOffersJob] Previous activation still running; skipping overlap.");
    return;
  }
  triggerJobRunning = true;
  console.log("[triggerScheduledOffersJob] Starting periodic Smart Offers activation job...");
  
  try {
    const now = new Date();
    const preparedOffers = await PersonalizedOffer.find({
      status: "prepared",
      scheduledNotifyAt: { $lte: now }
    })
      .sort({ scheduledNotifyAt: 1, _id: 1 })
      .limit(TRIGGER_BATCH_SIZE)
      .populate("user rule")
      .lean();

    if (preparedOffers.length > 0) {
      console.log(`[triggerScheduledOffersJob] Found ${preparedOffers.length} offers to activate.`);
      const expo = new Expo({ useFcmV1: true });
      const messages = [];
      const tokenInfos = [];
      const emailQueue = [];

      for (const offer of preparedOffers) {
        const ruleValidityHours = offer.validityHours ?? offer.rule?.validityHours;
        if (!Number.isFinite(ruleValidityHours) || ruleValidityHours <= 0) {
          console.error(`[triggerScheduledOffersJob] Invalid validity for offer ${offer._id}`);
          continue;
        }
        
        const validFrom = new Date();
        const validUntil = calculateSmartOfferValidUntil(validFrom, ruleValidityHours);
        const notificationBody = buildSmartOfferNotificationBody(offer.notificationBody, validUntil);

        if (offer.user && offer.user.expo_token && Expo.isExpoPushToken(offer.user.expo_token) && offer.user.appIsInstalled !== false) {
          messages.push({
            to: offer.user.expo_token,
            sound: "default",
            title: offer.notificationTitle,
            body: notificationBody,
            priority: "high",
            data: { type: "smart_offer", offerId: String(offer._id), userId: String(offer.user._id || offer.user) },
          });
          tokenInfos.push({ offerId: offer._id, userId: offer.user._id, offerTitle: offer.notificationTitle, offerBody: notificationBody, validFrom, validUntil });
        } else {
          if (offer.user && offer.user.email && !offer.user.emailUnsubscribed) {
            emailQueue.push({ userEmail: offer.user.email, userName: offer.user.name, offerTitle: offer.notificationTitle, offerBody: notificationBody, userId: String(offer.user._id || offer.user) });
          }
          await PersonalizedOffer.findByIdAndUpdate(offer._id, { status: "active", validFrom, validUntil });
          await new PersonalizedOfferEvent({ personalizedOffer: offer._id, user: offer.user?._id, eventType: "created" }).save();
        }
      }

      if (messages.length > 0) {
        const chunks = expo.chunkPushNotifications(messages);
        let cursor = 0;
        for (const chunk of chunks) {
          const tickets = await expo.sendPushNotificationsAsync(chunk);
          const offerActivations = [];
          const eventInserts = [];

          for (let i = 0; i < tickets.length; i++) {
            const tokenInfo = tokenInfos[cursor + i];
            const ticket = tickets[i];

            if (ticket?.status === "ok") {
              if (ticket.id) pendingReceiptMap[ticket.id] = { offerId: tokenInfo.offerId, userId: tokenInfo.userId };
              offerActivations.push({ updateOne: { filter: { _id: tokenInfo.offerId }, update: { $set: { status: "active", validFrom: tokenInfo.validFrom, validUntil: tokenInfo.validUntil, initialNotificationSentAt: new Date() } } } });
              eventInserts.push({ personalizedOffer: tokenInfo.offerId, user: tokenInfo.userId, eventType: "notified" });
            } else {
              const errCode = ticket?.details?.error;
              if (errCode === "DeviceNotRegistered") {
                console.log(`[triggerScheduledOffersJob] DeviceNotRegistered for user ${tokenInfo.userId}`);
                const uninstalledUser = await User.findByIdAndUpdate(tokenInfo.userId, { expo_token: null, appIsInstalled: false, appUninstalledAt: new Date() }, { new: true }).lean();
                if (uninstalledUser?.email && !uninstalledUser.emailUnsubscribed) {
                  emailQueue.push({ userEmail: uninstalledUser.email, userName: uninstalledUser.name, offerTitle: tokenInfo.offerTitle, offerBody: tokenInfo.offerBody, userId: String(uninstalledUser._id) });
                }
              }
              offerActivations.push({ updateOne: { filter: { _id: tokenInfo.offerId }, update: { $set: { status: "active", validFrom: tokenInfo.validFrom, validUntil: tokenInfo.validUntil } } } });
            }
          }

          if (offerActivations.length > 0) await PersonalizedOffer.bulkWrite(offerActivations, { ordered: false });
          if (eventInserts.length > 0) await PersonalizedOfferEvent.insertMany(eventInserts, { ordered: false });
          cursor += chunk.length;
          await sleep(TRIGGER_BATCH_DELAY);
        }
      }

      for (let i = 0; i < emailQueue.length; i += 5) {
        await Promise.all(emailQueue.slice(i, i + 5).map(async (emailPayload) => {
          try {
            await sendSmartOfferUninstalledEmail(emailPayload);
          } catch (emailErr) {
            console.error(`[triggerScheduledOffersJob] Email error for ${emailPayload.userId}:`, emailErr.message);
          }
        }));
      }
    }

    const expiredResult = await PersonalizedOffer.updateMany(
      { status: { $in: ["active", "viewed", "clicked"] }, validUntil: { $lt: now } },
      { $set: { status: "expired" } }
    );

    if (expiredResult.modifiedCount > 0) {
      console.log(`[triggerScheduledOffersJob] Expired ${expiredResult.modifiedCount} active/viewed/clicked offers.`);
      const expiredOfferDocs = await PersonalizedOffer.find({ status: "expired", validUntil: { $lt: now }, updatedAt: { $gte: new Date(Date.now() - 60000) } }).select("_id user").lean();
      if (expiredOfferDocs.length > 0) {
        // Mongoose insertMany valide chaque document avant d'envoyer quoi que ce soit au
        // serveur : un seul document sans `user` (ref cassée/donnée historique orpheline)
        // fait échouer TOUT le lot avec une ValidationError, y compris pour les offres
        // valides du même tick de cron — d'où le filtre défensif ci-dessous.
        const orphanOfferIds = [];
        const expiredEvents = [];
        for (const o of expiredOfferDocs) {
          if (!o.user) {
            orphanOfferIds.push(o._id);
            continue;
          }
          expiredEvents.push({ personalizedOffer: o._id, user: o.user, eventType: "expired" });
        }
        if (orphanOfferIds.length > 0) {
          console.error(`[triggerScheduledOffersJob] ${orphanOfferIds.length} offre(s) expirée(s) sans user, événement "expired" ignoré:`, orphanOfferIds.map(String));
        }
        if (expiredEvents.length > 0) {
          await PersonalizedOfferEvent.insertMany(expiredEvents, { ordered: false });
        }
      }
    }
    console.log("[triggerScheduledOffersJob] ✅ Periodic activation job finished.");
  } catch (error) {
    console.error("[triggerScheduledOffersJob] Error:", error);
  } finally {
    triggerJobRunning = false;
  }
};

const sendSmartOfferRemindersJob = async () => {
  const now = new Date();
  try {
    const cronStat = await SystemStat.findOne({ key: "smartOfferCronEnabled" }).lean();
    const cronEnabled = cronStat?.value !== undefined ? Boolean(cronStat.value) : true;
    if (!cronEnabled) return;

    const candidates = await PersonalizedOffer.find({
      status: { $in: ["active", "viewed", "clicked"] },
      initialNotificationSentAt: { $ne: null },
      reminderSentAt: null,
      reminderSkippedAt: null,
      reminderClaimedAt: null,
      validFrom: { $ne: null },
      validUntil: { $gt: now },
      $expr: { $gte: [now, { $add: ["$validFrom", { $multiply: [{ $subtract: ["$validUntil", "$validFrom"] }, 2 / 3] }] }] },
    }).populate("user", "expo_token appIsInstalled").sort({ validUntil: 1 }).limit(REMINDER_BATCH_SIZE).lean();

    if (candidates.length === 0) return;

    const expo = new Expo({ useFcmV1: true });
    for (const offer of candidates) {
      const token = offer.user?.expo_token;
      if (!token || offer.user?.appIsInstalled === false || !Expo.isExpoPushToken(token)) {
        await PersonalizedOffer.updateOne({ _id: offer._id, reminderSentAt: null, reminderSkippedAt: null }, { $set: { reminderSkippedAt: now } });
        continue;
      }

      const claimedOffer = await PersonalizedOffer.findOneAndUpdate(
        { _id: offer._id, status: { $in: ["active", "viewed", "clicked"] }, validUntil: { $gt: now }, reminderSentAt: null, reminderSkippedAt: null, reminderClaimedAt: null },
        { $set: { reminderClaimedAt: now }, $inc: { reminderAttemptCount: 1 } },
        { new: true }
      ).lean();
      
      if (!claimedOffer) continue;

      let pushAccepted = false;
      try {
        const [ticket] = await expo.sendPushNotificationsAsync([{
          to: token, sound: "default", title: `⏰ Rappel : ${offer.notificationTitle}`, body: buildSmartOfferNotificationBody(offer.notificationBody, offer.validUntil), priority: "high",
          data: { type: "smart_offer", offerId: String(offer._id), userId: String(offer.user._id || offer.user), isReminder: true },
        }]);

        if (ticket?.status !== "ok") {
          if (ticket?.details?.error === "DeviceNotRegistered") {
            await User.updateOne({ _id: offer.user._id }, { $set: { expo_token: null, appIsInstalled: false, appUninstalledAt: new Date() } });
          }
          await PersonalizedOffer.updateOne(
            { _id: offer._id, reminderSentAt: null },
            { $set: (claimedOffer.reminderAttemptCount || 0) >= 3 ? { reminderClaimedAt: null, reminderSkippedAt: new Date() } : { reminderClaimedAt: null } }
          );
          continue;
        }
        
        pushAccepted = true;
        const sentAt = new Date();
        await PersonalizedOffer.updateOne({ _id: offer._id, reminderSentAt: null }, { $set: { reminderSentAt: sentAt, reminderClaimedAt: null } });
        await PersonalizedOfferEvent.create({ personalizedOffer: offer._id, user: offer.user._id, eventType: "reminder_notified", timestamp: sentAt });
      } catch (error) {
        if (!pushAccepted) {
          await PersonalizedOffer.updateOne(
            { _id: offer._id, reminderSentAt: null },
            { $set: (claimedOffer.reminderAttemptCount || 0) >= 3 ? { reminderClaimedAt: null, reminderSkippedAt: new Date() } : { reminderClaimedAt: null } }
          ).catch(() => {});
        }
        console.error(`[sendSmartOfferRemindersJob] Reminder failed for offer ${offer._id}:`, error.message);
      }
    }
  } catch (error) {
    console.error("[sendSmartOfferRemindersJob] Fatal error:", error);
  }
};

const checkPushReceiptsJob = async () => {
  const ticketIds = Object.keys(pendingReceiptMap);
  if (ticketIds.length === 0) return;

  console.log(`[checkPushReceiptsJob] Checking ${ticketIds.length} pending Expo push receipts...`);
  const expo = new Expo({ useFcmV1: true });

  try {
    const receiptIdChunks = expo.chunkPushNotificationReceiptIds(ticketIds);
    for (const chunk of receiptIdChunks) {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      for (const [receiptId, receipt] of Object.entries(receipts)) {
        const info = pendingReceiptMap[receiptId];
        if (!info) continue;

        if (receipt.status === "ok") {
          delete pendingReceiptMap[receiptId];
        } else if (receipt.status === "error") {
          const errCode = receipt.details?.error;
          console.log(`[checkPushReceiptsJob] Receipt error for user ${info.userId}: ${errCode}`);
          if (errCode === "DeviceNotRegistered") {
            await User.findByIdAndUpdate(info.userId, { expo_token: null, appIsInstalled: false, appUninstalledAt: new Date() });
            console.log(`[checkPushReceiptsJob] User ${info.userId} marked as uninstalled.`);
          }
          delete pendingReceiptMap[receiptId];
        }
      }
    }
  } catch (err) {
    console.error("[checkPushReceiptsJob] Error fetching receipts:", err);
  }
};

module.exports = {
  triggerScheduledOffersJob,
  sendSmartOfferRemindersJob,
  checkPushReceiptsJob,
};
