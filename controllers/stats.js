const { default: mongoose } = require("mongoose");
const { ON_GOING } = require("../utils/constants");
const { Expo } = require("expo-server-sdk");
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
    const expo = new Expo({
      useFcmV1: true,
    });
    const dashboardMessage = {
      to: "ExponentPushToken[3oAbv4L8LcFgGj5hk7kSfW]",
      body: `Nouvelle commande en attente,`,
      channel: "default",
      title: "Nouvelle Commande",
      priority: "high",
    };
    const chunks = expo.chunkPushNotifications([dashboardMessage]);
    const tickets = [];
    for (let chunk of chunks) {
      try {
        let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error(error);
      }
    }
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { getInititalStats, getRestaurantStats, testNotif };
