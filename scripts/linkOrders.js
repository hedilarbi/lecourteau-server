const mongoose = require("mongoose");
require("dotenv").config({ path: "/Users/hedilarbi/Desktop_Local/courteaux/lecourteau-server/.env" });
const User = require("../models/User");
const Order = require("../models/Order");

const run = async () => {
  try {
    await mongoose.connect(process.env.DEV_DB_CONNECTION);
    const user = await User.findOne({ phone_number: "+15550000099" });
    if (user) {
        const orders = await Order.find({ user: user._id }).lean();
        user.orders = orders.map(o => o._id);
        await user.save();
        console.log(`Linked ${orders.length} orders to user's profile.`);
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
