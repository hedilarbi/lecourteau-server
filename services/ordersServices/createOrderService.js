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
    if (order.order.paymentMethod !== "card") {
      return { error: "Payment method not supported" };
    }
    if (order.order.paymentMethod === "card" && order.order.paymentIntentId) {
      await stripe.paymentIntents.retrieve(order.order.paymentIntentId);
    }

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
      payment_method: order.order.paymentMethod,
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

      if (timeDifference <= 10) {
        return {
          error:
            "You cannot place another order within 10 minutes of your last order.",
        };
      }
    }

    // Check if paymentIntentId of the last order already exists among the user's orders
    const existingOrderWithPaymentIntent = user.orders.find(
      (userOrder) => userOrder.paymentIntentId === order.order.paymentIntentId
    );

    if (existingOrderWithPaymentIntent) {
      return {
        error: "This payment intent has already been used for another order.",
      };
    }

    const response = await newOrder.save();
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
  const expo = new Expo({
    useFcmV1: true,
  });

  const dashboardMessage = {
    to: restaurant.expo_token,
    body: `Nouvelle commande en attente, code:${code}`,
    channel: "default",
    data: { order_id: orderId },
    title: "Nouvelle Commande",
    priority: "high",
  };
  if (restaurant.expo_token) {
    const chunks = expo.chunkPushNotifications([dashboardMessage]);
    const tickets = [];
    for (let chunk of chunks) {
      try {
        let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        console.log("ticketChunk", ticketChunk, "order Code", code);
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
  }
  // const userMessage = {
  //   to: user.expo_token,
  //   sound: "default",
  //   body: `Bienvenue chez Le Courteau ! Votre commande est en préparation et félicitations, vous avez remporté ${
  //     pointsEarned * 10
  //   } points de fidélité.`,
  //   data: { order_id: orderId },
  //   title: "Nouvelle Commande",
  //   priority: "high",
  // };
  // Send push notifications if tokens are available
  // if (user.expo_token?.length > 0) {
  //   await expo.sendPushNotificationsAsync([userMessage]);
  // }
};
module.exports = createOrderService;
