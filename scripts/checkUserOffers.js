const mongoose = require("mongoose");
require("dotenv").config({ path: "/Users/hedilarbi/Desktop_Local/courteaux/lecourteau-server/.env" });
const User = require("../models/User");
const Order = require("../models/Order");
const PersonalizedOffer = require("../models/PersonalizedOffer");

const run = async () => {
  try {
    await mongoose.connect(process.env.DEV_DB_CONNECTION);
    const user = await User.findOne({ phone_number: "+15550000099" }).lean();
    if (user) {
        console.log("User:", user._id);
        const orders = await Order.find({ user: user._id }).lean();
        console.log(`Orders found: ${orders.length}`);
        const offers = await PersonalizedOffer.find({ user: user._id }).lean();
        console.log(`Offers found: ${offers.length}, Status: ${offers[0]?.status}`);
        
        // Let's check how the active offers API endpoint fetches offers
        // It's in personalizedOffer.js controller getActiveOffer
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
run();
