const { default: mongoose } = require("mongoose");
const Order = require("../../models/Order");
const { ON_GOING } = require("../../utils/constants");
const { Expo } = require("expo-server-sdk");
const generateRandomCode = require("../../utils/generateOrderCode");
const { default: Stripe } = require("stripe");

require("dotenv/config");

const stripe = Stripe(process.env.STRIPE_PRIVATE_KEY, {
  apiVersion: "2023-08-16",
});
const createOrderService = async (order) => {
  try {
    const rewardsList = order.order.rewards.map((item) => item.id);
    const code = generateRandomCode(8).toUpperCase();
    await stripe.paymentIntents.retrieve(order.order.paymentIntentId);

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
      code,
      address: order.address,
      instructions: order.order.instructions,
      status: ON_GOING,
      offers: order.order.offers,
      rewards: rewardsList,
      createdAt: new Date().toISOString(),
      restaurant: order.restaurant,
      discount: order.order.discount || 0,
      sub_total_after_discount: parseFloat(order.order.subTotalAfterDiscount),
      tip: parseFloat(order.order.tip),
      paymentIntentId: order.order.paymentIntentId,
    });

    const response = await newOrder.save();

    // Fetch user and restaurant
    const user = await mongoose.models.User.findById(order.order.user_id);
    const restaurant = await mongoose.models.Restaurant.findById(
      order.restaurant
    );

    // Calculate points to remove and earned points
    const pointsToremove = order.order.rewards.reduce(
      (acc, item) => acc + item.points,
      0
    );
    const pointsEarned = calculatePoints(order);

    const totalPoints = Math.floor(pointsEarned * 10 - pointsToremove);

    // Update user's fidelity points and orders
    user.fidelity_points += totalPoints;
    user.orders.push(response._id);

    // Apply first order discount if not yet applied
    if (!user.firstOrderDiscountApplied) {
      user.firstOrderDiscountApplied = true;
    }

    const newUser = await user.save();

    // Update restaurant's orders
    restaurant.orders.push(response._id);
    await restaurant.save();

    await sendPushNotifications(
      user,
      restaurant,
      response._id,
      code,
      pointsEarned
    );

    return { response, user: newUser };
  } catch (err) {
    console.error(err.message);
    return { error: err.message };
  }
};

const calculatePoints = (order) => {
  let points = 0;

  if (order.order.offers.length > 0) {
    points += order.order.offers.reduce((acc, item) => acc + item.price, 0);
  }

  if (order.order.orderItems.length > 0) {
    points += order.order.orderItems.reduce((acc, item) => acc + item.price, 0);
  }

  if (order.order.discount) {
    points -= (points * order.order.discount) / 100;
  }

  return points;
};

const sendPushNotifications = async (
  user,
  restaurant,
  orderId,
  code,
  pointsEarned
) => {
  const expo = new Expo();

  const userMessage = {
    to: user.expo_token,
    sound: "default",
    body: `Bienvenue chez Le Courteau ! Votre commande est en préparation et félicitations, vous avez remporté ${
      pointsEarned * 10
    } points de fidélité.`,
    data: { order_id: orderId },
    title: "Nouvelle Commande",
    priority: "high",
  };

  const dashboardMessage = {
    to: restaurant.expo_token,
    body: `Nouvelle commande en attente, code:${code}`,
    channel: "default",
    data: { order_id: orderId },
    title: "Nouvelle Commande",
    priority: "high",
  };

  // Send push notifications if tokens are available
  if (user.expo_token?.length > 0) {
    await expo.sendPushNotificationsAsync([userMessage]);
  }
  if (restaurant.expo_token?.length > 0) {
    await expo.sendPushNotificationsAsync([dashboardMessage]);
  }
};
module.exports = createOrderService;
