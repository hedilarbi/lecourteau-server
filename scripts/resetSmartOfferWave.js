require("dotenv").config();
const mongoose = require("mongoose");

const OPEN_STATUSES = ["prepared", "active", "viewed", "clicked"];
const apply = process.argv.includes("--apply");

const main = async () => {
  const uri = process.env.DEV_DB_CONNECTION;
  if (!uri) throw new Error("DEV_DB_CONNECTION est absent du .env.");
  const connection = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 }).asPromise();
  try {
    const offers = connection.collection("personalizedoffers");
    const resets = connection.collection("smartofferwaveresets");
    const byStatus = await offers.aggregate([
      { $match: { status: { $in: OPEN_STATUSES } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).toArray();
    console.log(JSON.stringify({ database: connection.db.databaseName, openOffers: byStatus, mode: apply ? "apply" : "dry-run" }));
    if (!apply) return;

    const session = await connection.startSession();
    try {
      await session.withTransaction(async () => {
        const resetAt = new Date();
        const planned = await offers.updateMany(
          { status: "prepared" },
          { $set: { status: "expired", updatedAt: resetAt } },
          { session },
        );
        const open = await offers.updateMany(
          { status: { $in: ["active", "viewed", "clicked"] } },
          { $set: { status: "expired", validUntil: resetAt, updatedAt: resetAt } },
          { session },
        );
        const expiredOffersCount = planned.modifiedCount + open.modifiedCount;
        await resets.insertOne({ createdAt: resetAt, expiredOffersCount }, { session });
        console.log(JSON.stringify({ resetAt, expiredOffersCount }));
      });
    } finally {
      await session.endSession();
    }
  } finally {
    await connection.close();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
