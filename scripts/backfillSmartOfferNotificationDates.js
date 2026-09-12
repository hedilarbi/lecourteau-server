require("dotenv").config();
const mongoose = require("mongoose");

const LIVE_STATUSES = ["active", "viewed", "clicked"];

const run = async () => {
  const apply = process.argv.includes("--apply");
  const uri = process.env.DEV_DB_CONNECTION;
  if (!uri) throw new Error("DEV_DB_CONNECTION is missing.");

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const rows = await db.collection("personalizedofferevents").aggregate([
    { $match: { eventType: "notified" } },
    { $sort: { timestamp: 1 } },
    { $group: { _id: "$personalizedOffer", notifiedAt: { $first: "$timestamp" } } },
    {
      $lookup: {
        from: "personalizedoffers",
        localField: "_id",
        foreignField: "_id",
        as: "offer",
      },
    },
    { $unwind: "$offer" },
    {
      $match: {
        "offer.status": { $in: LIVE_STATUSES },
        "offer.initialNotificationSentAt": null,
      },
    },
    { $project: { notifiedAt: 1 } },
  ]).toArray();

  console.log(`[backfillSmartOfferNotificationDates] ${rows.length} offers to backfill.`);
  if (!apply) {
    console.log("[backfillSmartOfferNotificationDates] Dry run. Pass --apply to update.");
    return;
  }

  if (rows.length > 0) {
    const result = await db.collection("personalizedoffers").bulkWrite(
      rows.map((row) => ({
        updateOne: {
          filter: { _id: row._id, initialNotificationSentAt: null },
          update: { $set: { initialNotificationSentAt: row.notifiedAt } },
        },
      })),
      { ordered: false },
    );
    console.log(`[backfillSmartOfferNotificationDates] Updated ${result.modifiedCount} offers.`);
  }
};

run()
  .catch((error) => {
    console.error("[backfillSmartOfferNotificationDates] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
