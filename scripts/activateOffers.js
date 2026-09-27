const mongoose = require("mongoose");
require("dotenv").config({ path: "/Users/hedilarbi/Desktop_Local/courteaux/lecourteau-server/.env" });
const User = require("../models/User");
const PersonalizedOffer = require("../models/PersonalizedOffer");
const { calculateSmartOfferValidUntil } = require("../utils/smartOfferNotificationBody");

const run = async () => {
  try {
    await mongoose.connect(process.env.DEV_DB_CONNECTION);
    const user = await User.findOne({ phone_number: "+15550000099" }).lean();
    if (user) {
        const now = new Date();
        const validUntil = calculateSmartOfferValidUntil(now, 24);
        
        const result = await PersonalizedOffer.updateMany(
            { user: user._id, status: "active" }, // it's already active from previous script
            { $set: { validFrom: now, validUntil: validUntil } }
        );
        console.log(`Updated ${result.modifiedCount} active offers with validDates.`);
        
        // Also just to be safe, update any prepared offers just in case
        await PersonalizedOffer.updateMany(
            { user: user._id, status: "prepared" },
            { $set: { status: "active", validFrom: now, validUntil: validUntil } }
        );
    } else {
        console.log("User not found!");
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
run();
