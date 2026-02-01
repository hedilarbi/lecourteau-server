const { default: mongoose } = require("mongoose");
const Order = require("../../models/Order");
const { ON_GOING, SCHEDULED } = require("../../utils/constants");
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

    if (order.order.paymentMethod !== "card") {
      return { error: "Payment method not supported" };
    }
    if (order.order.paymentMethod === "card" && order.order.paymentIntentId) {
      await stripe.paymentIntents.retrieve(order.order.paymentIntentId);
    }
    let coords = order.coords || {};
    if (!order.coords?.latitude || !order.coords?.longitude) {
      coords = {
        latitude: 0,
        longitude: 0,
      };
    }

    const newOrder = new Order({
      user: order.order.user_id,
      orderItems: order.order.orderItems,
      total_price: parseFloat(order.order.total),
      sub_total: parseFloat(order.order.subTotal),
      delivery_fee: parseFloat(order.order.deliveryFee),
      type: order.type,
      coords: coords,
      code,
      address: order.address || "",
      instructions: order.order.instructions,
      status: order.order.scheduled.isScheduled ? SCHEDULED : ON_GOING,
      offers: order.order.offers,
      rewards: rewardsList,
      createdAt: new Date().toISOString(),
      restaurant: order.restaurant,
      discount: order.order.discount || 0,
      sub_total_after_discount: parseFloat(order.order.subTotalAfterDiscount),
      tip: parseFloat(order.order.tip),
      paymentIntentId: order.order.paymentIntentId,
      payment_method: order.order.paymentMethod,
      promoCode: order.order.promoCode
        ? order.order.promoCode.promoCodeId
        : null,
      scheduled: {
        isScheduled: order.order.scheduled.isScheduled || false,
        scheduledFor: order.order.scheduled.scheduledFor || null,
      },
    });

    // Fetch user and restaurant
    const user = await mongoose.models.User.findById(
      order.order.user_id
    ).populate("orders");
    if (user.orders.length > 0) {
      const lastOrder = user.orders[user.orders.length - 1];
      const lastOrderTime = new Date(lastOrder.createdAt).getTime();
      const currentTime = new Date().getTime();
      const timeDifference = (currentTime - lastOrderTime) / 1000 / 60; // time difference in minutes

      if (timeDifference <= 1) {
        return {
          error:
            "You cannot place another order within 1 minutes of your last order.",
        };
      }
    }

    const existingOrderWithPaymentIntent = user.orders.find(
      (userOrder) => userOrder.paymentIntentId === order.order.paymentIntentId
    );

    if (existingOrderWithPaymentIntent) {
      return {
        error: "This payment intent has already been used for another order.",
      };
    }

    const response = await newOrder.save();
    user.orders.push(response._id);
    await user.save();
    const restaurant = await mongoose.models.Restaurant.findById(
      order.restaurant
    );

    const responseData = { response };
    process.nextTick(() => sendNotifications(restaurant, response._id, code));

    return responseData;
  } catch (err) {
    return { error: err.message };
  }
};

const sendNotifications = async (restaurant, orderId, code) => {
  const expo = new Expo({ useFcmV1: true });

  const dashboardMessage = {
    to: restaurant.expo_token,
    body: `Nouvelle commande en attente, code:${code}`,
    channel: "default",
    data: { order_id: orderId },
    title: "Nouvelle Commande",
    priority: "high",
  };

  try {
    if (restaurant.expo_token) {
      const response = await expo.sendPushNotificationsAsync([
        dashboardMessage,
      ]);
    }
  } catch (err) {
    console.error(`Error sending notifications: ${err.message}`);
  }
};
module.exports = createOrderService;
