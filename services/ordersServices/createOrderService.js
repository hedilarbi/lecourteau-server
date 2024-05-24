const { default: mongoose } = require("mongoose");
const Order = require("../../models/Order");
const { ON_GOING } = require("../../utils/constants");
const { Expo } = require("expo-server-sdk");
const generateRandomCode = require("../../utils/generateOrderCode");

const createOrderService = async (order) => {
  let rewardsList = [];
  console.log(order);
  if (order.order.rewards.length > 0) {
    order.order.rewards.map((item) => rewardsList.push(item.id));
  }

  try {
    const code = generateRandomCode(8);
    const newOrder = new Order({
      user: order.order.user_id,
      orderItems: order.order.orderItems,
      total_price: parseFloat(order.order.total),
      sub_total: parseFloat(order.order.subTotal),
      delivery_fee: parseFloat(order.order.deliveryFee),
      type: order.type,
      coords: {
        latitude: order.coords.latitude,
        longitude: order.coords.longitude,
      },
      code: code.toUpperCase(),
      address: order.address,
      istructions: order.order.istructions,
      status: ON_GOING,
      offers: order.order.offers,
      rewards: rewardsList,
      createdAt: new Date().toISOString(),
      restaurant: order.restaurant,
      discount: order.order.discount ? order.order.discount : 0,
    });
    const response = await newOrder.save();

    const user = await mongoose.models.User.findById(order.order.user_id);

    let pointsToremove = 0;
    if (order.order.rewards.length > 0) {
      order.order.rewards.map((item) => (pointsToremove += item.points));
    }
    let points = 0;
    if (order.order.offers.length > 0) {
      order.order.offers.map((item) => (points += item.price));
    }
    if (order.order.orderItems.length > 0) {
      order.order.orderItems.map((item) => (points += item.price));
    }

    points = points - (points * order.order.discount) / 100;

    const totalPoints = parseInt(points) * 10 - parseInt(pointsToremove);

    user.fidelity_points = user.fidelity_points + totalPoints;

    user.orders.push(response._id);
    if (user.firstOrderDiscountApplied === false) {
      user.firstOrderDiscountApplied = true;
    }
    const newUser = await user.save();
    const restaurant = await mongoose.models.Restaurant.findById(
      order.restaurant
    );

    restaurant.orders.push(response._id);

    await restaurant.save();

    const expo_token = user.expo_token;
    const expo = new Expo();
    const userMessage = {
      to: expo_token,
      sound: "default",
      body: `
            Bienvenue chez Le Courteau ! Votre commande est en préparation et félicitations, vous avez remporté ${
              points * 10
            } points de fidélité.`,

      data: {
        order_id: response._id,
      },
      title: "Nouvelle Commande",
      priority: "high",
    };
    const dashboardMessage = {
      to: restaurant.expo_token,

      body: `Nouvelle commande en attente, code:${code.toUpperCase()}`,
      channel: "default",
      data: {
        order_id: response._id,
      },
      title: "Nouvelle Commande",
      priority: "high",
    };

    if (expo_token.length > 0) {
      const ticket = await expo.sendPushNotificationsAsync([userMessage]);
    }
    if (restaurant.expo_token?.length > 0) {
      await expo.sendPushNotificationsAsync([dashboardMessage]);
    }
    return { response, user: newUser };
  } catch (err) {
    console.log(err);
    return { error: err.message };
  }
};

module.exports = createOrderService;
