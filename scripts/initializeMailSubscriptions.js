require("dotenv/config");
const mongoose = require("mongoose");
const User = require("../models/User");

const run = async () => {
  await mongoose.connect(process.env.DEV_DB_CONNECTION);
  const unsubscribedResult = await User.updateMany(
    { ismailsubscribed: { $exists: false }, emailUnsubscribed: true },
    { $set: { ismailsubscribed: false } },
  );
  const subscribedResult = await User.updateMany(
    { ismailsubscribed: { $exists: false }, emailUnsubscribed: { $ne: true } },
    { $set: { ismailsubscribed: true } },
  );
  console.log(
    `${subscribedResult.modifiedCount} utilisateur(s) abonné(s) et ${unsubscribedResult.modifiedCount} utilisateur(s) désabonné(s) initialisés.`,
  );
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
