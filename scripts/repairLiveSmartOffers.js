require("dotenv").config();
const mongoose = require("mongoose");

require("../models/User");
require("../models/Category");
require("../models/MenuItem");
const PersonalizedOffer = require("../models/PersonalizedOffer");

const LIVE_STATUSES = ["prepared", "active", "viewed", "clicked"];
const PLACEHOLDER_PATTERN = /{{?(name|category|item|discount|points|threshold)}?}/g;

const renderTemplate = (template, offer) => {
  const userName = String(offer.user?.name || "cher client").trim();
  const categoryName = String(offer.targetCategory?.name || "").trim();
  const itemName = String(
    offer.targetMenuItem?.name || offer.freeItem?.name || offer.triggerItem?.name || "",
  ).trim();
  const discount = offer.discountValue
    ? offer.offerType === "bonus_basket"
      ? `${offer.discountValue}$`
      : `${offer.discountValue}%`
    : "";
  const values = {
    name: userName,
    category: categoryName,
    item: itemName,
    discount,
    points: offer.bonusPoints ? String(offer.bonusPoints) : "",
    threshold: String(offer.bonusThreshold || 0),
  };

  return String(template || "").replace(
    PLACEHOLDER_PATTERN,
    (_match, key) => values[key] || "",
  );
};

const run = async () => {
  const apply = process.argv.includes("--apply");
  const uri = process.env.DEV_DB_CONNECTION;
  if (!uri) throw new Error("DEV_DB_CONNECTION is missing.");

  await mongoose.connect(uri);

  const offers = await PersonalizedOffer.find({
    status: { $in: LIVE_STATUSES },
    $or: [
      { notificationTitle: { $regex: "\\{.+\\}" } },
      { notificationBody: { $regex: "\\{.+\\}" } },
    ],
  })
    .populate("user", "name")
    .populate("targetCategory", "name")
    .populate("targetMenuItem", "name")
    .populate("freeItem", "name")
    .populate("triggerItem", "name")
    .lean();

  const operations = offers.map((offer) => ({
    updateOne: {
      filter: { _id: offer._id, status: { $in: LIVE_STATUSES } },
      update: {
        $set: {
          notificationTitle: renderTemplate(offer.notificationTitle, offer),
          notificationBody: renderTemplate(offer.notificationBody, offer),
        },
      },
    },
  }));

  console.log(
    `[repairLiveSmartOffers] ${operations.length} live offers require rendered notification text.`,
  );

  if (!apply) {
    console.log("[repairLiveSmartOffers] Dry run only. Pass --apply to update the database.");
    return;
  }

  if (operations.length > 0) {
    const result = await PersonalizedOffer.bulkWrite(operations, { ordered: false });
    console.log(`[repairLiveSmartOffers] Updated ${result.modifiedCount} offers.`);
  }
};

run()
  .catch((error) => {
    console.error("[repairLiveSmartOffers] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
