const { default: mongoose } = require("mongoose");
const { ON_GOING } = require("../utils/constants");

const getInititalStats = async (req, res) => {
  try {
    const usersCount = await mongoose.models.User.countDocuments();
    const ordersCount = await mongoose.models.Order.countDocuments();

    let onGoingOrders = await mongoose.models.Order.find({
      status: ON_GOING,
    });
    onGoingOrders = onGoingOrders.reverse();
    const income = await mongoose.models.Order.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$total_price" },
        },
      },
    ]);

    const revenue = income.length ? income[0].total.toFixed(2) : 0;
    res.status(200).json({ usersCount, ordersCount, onGoingOrders, revenue });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getRestaurantStats = async (req, res) => {
  try {
    const { id } = req.params;

    const restaurent = await mongoose.models.Restaurant.findById(id).populate(
      "orders"
    );

    const ordersCount = restaurent.orders.length;
    let onGoingOrders = restaurent.orders.filter(
      (order) => order.status === ON_GOING
    );
    onGoingOrders = onGoingOrders.reverse();
    const revenue = restaurent.orders.reduce(
      (acc, order) => acc + order.total_price,
      0
    );
    res
      .status(200)
      .json({ ordersCount, onGoingOrders, revenue: revenue.toFixed(2) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const testNotif = async (req, res) => {
  try {
    const response = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=AAAAf0XCO7U:APA91bHqRonFXY9hWDOL5QttkvvLAJtMnAL2AK5jOERXOak1DRFYDdhEDpsYOh4pjAfG3ZDmhOlO49M-s7KDjPvlE6xNz1KqpQcQUnC2BjTukPZiX31ADwGFCZXrXASo_oU46knX2euk`,
      },
      body: JSON.stringify({
        to: "dlIQp0RMQaC0DvCMa8wuCf:APA91bHjGvb3KbJUfvQgM0F_aTJyPUdjkEyrmBttZcwffHU4wkHtIdpfsP15k-tAtdFkDvmxa2S46o75r1UWwbA4Q0vfcQWkRlBQ7_gzvHNT2hk5OR2pSQLLrg06bvL3MSxgps3VRMPZ",
        priority: "normal",
        data: {
          experienceId: "@hedilarbi95/lecourteau-dashboard",
          scopeKey: "@hedilarbi95/lecourteau-dashboard",
          title: "📧 You've got mail",
          message: "Hello world! 🌐",
        },
      }),
    });

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { getInititalStats, getRestaurantStats, testNotif };
