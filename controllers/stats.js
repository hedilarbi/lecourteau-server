const { default: mongoose } = require("mongoose");
const { ON_GOING, SCHEDULED } = require("../utils/constants");
const { Expo } = require("expo-server-sdk");
const getInititalStats = async (req, res) => {
  try {
    const { date, from, to, restaurantId } = req.query;

    const usersCount = await mongoose.models.User.countDocuments();
    let startDate;
    let endDate;
    if (date) {
      startDate = new Date(date);
      startDate.setUTCHours(0, 0, 0, 0);
      endDate = new Date(date);
      endDate.setUTCHours(23, 59, 59, 999);
    } else if (from && to) {
      startDate = new Date(from);
      startDate.setUTCHours(0, 0, 0, 0);
      endDate = new Date(to);
      endDate.setUTCHours(23, 59, 59, 999);
    }

    if (restaurantId) {
      const restaurant = await mongoose.models.Restaurant.findById(
        restaurantId,
        { name: 1 },
      ).lean();
      if (!restaurant) {
        return res
          .status(404)
          .json({ success: false, message: "Restaurant not found" });
      }
      let restaurantStats = [
        {
          restaurantId: restaurant._id,
          restaurantName: restaurant.name,
          ordersCount: 0,
          revenue: "0.00",
        },
      ];
      if (startDate && endDate) {
        const orderStats = await mongoose.models.Order.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate },
              status: { $ne: "Annulé" },
              confirmed: true,
              restaurant: new mongoose.Types.ObjectId(restaurantId),
            },
          },
          {
            $group: {
              _id: "$restaurant",
              ordersCount: { $sum: 1 },
              revenue: { $sum: "$total_price" },
            },
          },
        ]);

        if (orderStats.length > 0) {
          const stat = orderStats[0];
          restaurantStats[0].ordersCount = stat.ordersCount;
          restaurantStats[0].revenue = stat.revenue.toFixed(2);
        }
      }

      return res.status(200).json({ usersCount, restaurantStats });
    }

    const restaurants = await mongoose.models.Restaurant.find(
      {},
      { name: 1 },
    ).lean();

    let restaurantStats = restaurants.map((restaurant) => ({
      restaurantId: restaurant._id,
      restaurantName: restaurant.name,
      ordersCount: 0,
      revenue: "0.00",
    }));

    if (startDate && endDate) {
      const orderStats = await mongoose.models.Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $ne: "Annulé" },
            confirmed: true,
            restaurant: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$restaurant",
            ordersCount: { $sum: 1 },
            revenue: { $sum: "$total_price" },
          },
        },
      ]);

      const statsByRestaurantId = new Map(
        orderStats.map((stat) => [String(stat._id), stat]),
      );

      restaurantStats = restaurants.map((restaurant) => {
        const stat = statsByRestaurantId.get(String(restaurant._id));
        const revenue = stat ? stat.revenue : 0;

        return {
          restaurantId: restaurant._id,
          restaurantName: restaurant.name,
          ordersCount: stat ? stat.ordersCount : 0,
          revenue: revenue.toFixed(2),
        };
      });
    }

    res.status(200).json({ usersCount, restaurantStats });
  } catch (err) {
    console.error("Error fetching initial stats:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getRestaurantStats = async (req, res) => {
  try {
    const { id } = req.params;

    const [onGoingOrders, nonConfirmedOrders] = await Promise.all([
      mongoose.models.Order.find({
        restaurant: id,
        status: ON_GOING,
        confirmed: true,
      })
        .sort({ createdAt: -1 })
        .lean(),
      mongoose.models.Order.find({
        restaurant: id,
        confirmed: false,
        status: { $in: [ON_GOING, SCHEDULED] },
      })
        .sort({ createdAt: -1 })
        .lean(),
    ]);
    res.status(200).json({
      onGoingOrders,
      nonConfirmedOrders,
    });
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

        for (let receiptId in receipts) {
          let { status, message, details } = receipts[receiptId];
          if (status === "ok") {
            continue;
          } else if (status === "error") {
            console.error(
              `There was an error sending a notification: ${message}`,
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
