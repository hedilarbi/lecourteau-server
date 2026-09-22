const mongoose = require("mongoose");
require("dotenv").config({ path: "/Users/hedilarbi/Desktop_Local/courteaux/lecourteau-server/.env" });
const User = require("../models/User");
const PersonalizedOffer = require("../models/PersonalizedOffer");

const run = async () => {
  try {
    await mongoose.connect(process.env.DEV_DB_CONNECTION);
    const user = await User.findOne({ phone_number: "+15550000099" }).lean();
    if (user) {
        const offers = await PersonalizedOffer.find({ user: user._id }).lean();
        offers.forEach(o => {
            console.log(`OfferType: ${o.offerType}, bonusThreshold: ${o.bonusThreshold}`);
        });
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
run();
