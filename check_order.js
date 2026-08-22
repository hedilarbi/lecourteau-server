const mongoose = require('mongoose');
const Order = require('./models/Order');

async function run() {
  await mongoose.connect('mongodb+srv://hedilarbi:aqwxcvbn12@cluster0.x4gpucm.mongodb.net/LeCourteau?retryWrites=true&w=majority&appName=Cluster0', { useNewUrlParser: true, useUnifiedTopology: true });
  const latestOrders = await Order.find({ promoCode: { $ne: null } }).sort({ createdAt: -1 }).limit(3);
  for (let order of latestOrders) {
    console.log("-------------------");
    console.log("SubTotal:", order.sub_total);
    console.log("SubTotal After Discount:", order.sub_total_after_discount);
    console.log("Promo Code:", order.promoCode);
    console.log("Order Items:");
    console.log(JSON.stringify(order.orderItems, null, 2));
  }
  process.exit(0);
}
run();
