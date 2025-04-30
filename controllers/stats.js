const { default: mongoose } = require("mongoose");
const { ON_GOING } = require("../utils/constants");
const { Expo } = require("expo-server-sdk");
const getInititalStats = async (req, res) => {
  try {
    const usersCount = await mongoose.models.User.countDocuments();

    const startOfYesterday = new Date();
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    startOfYesterday.setHours(0, 0, 0, 0);

    const endOfYesterday = new Date();
    endOfYesterday.setDate(endOfYesterday.getDate() - 1);
    endOfYesterday.setHours(23, 59, 59, 999);

    const restaurants = await mongoose.models.Restaurant.find().populate(
      "orders"
    );

    const restaurantStats = restaurants.map((restaurant) => {
      const yesterdayOrders = restaurant.orders.filter(
        (order) =>
          order.createdAt >= startOfYesterday &&
          order.createdAt <= endOfYesterday &&
          order.status !== "Annulé" &&
          order.confirmed === true
      );

      const ordersCount = yesterdayOrders.length;

      const revenue = yesterdayOrders.reduce(
        (acc, order) => acc + order.total_price,
        0
      );

      return {
        restaurantId: restaurant._id,
        restaurantName: restaurant.name,
        ordersCount,
        revenue: revenue.toFixed(2),
      };
    });
    res.status(200).json({ usersCount, restaurantStats });
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

    // const ordersCount = restaurent.orders.length;

    // const revenue = restaurent.orders.reduce(
    //   (acc, order) => acc + order.total_price,
    //   0
    // );

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todayOrders = restaurent.orders.filter(
      (order) =>
        order.createdAt >= startOfDay &&
        order.createdAt <= endOfDay &&
        order.status !== "Annulé" &&
        order.confirmed === true
    );

    const ordersCount = todayOrders.length;

    const revenue = todayOrders.reduce(
      (acc, order) => acc + order.total_price,
      0
    );

    let onGoingOrders = restaurent.orders.filter(
      (order) => order.status === ON_GOING
    );
    onGoingOrders = onGoingOrders.reverse();
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
        console.log("ticketChunk", ticketChunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error(error);
      }
    }
    let receiptIds = [];
    for (let ticket of tickets) {
      if (ticket.status === "ok") {
        receiptIds.push(ticket.id);
      }
    }
    let receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
    for (let chunk of receiptIdChunks) {
      try {
        let receipts = await expo.getPushNotificationReceiptsAsync(chunk);
        console.log("receips", receipts);

        for (let receiptId in receipts) {
          let { status, message, details } = receipts[receiptId];
          if (status === "ok") {
            continue;
          } else if (status === "error") {
            console.error(
              `There was an error sending a notification: ${message}`
            );
            if (details && details.error) {
              console.error(`The error code is ${details.error}`);
            }
          }
        }
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
