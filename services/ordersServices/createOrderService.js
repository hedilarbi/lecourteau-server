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

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isUserSubscriptionActive = (user) => {
  const status = String(user?.subscriptionStatus || "").toLowerCase();
  const statusActive = status === "active" || status === "trialing";
  const hasStripeSubscriptionId = Boolean(user?.subscriptionStripeSubscriptionId);
  const periodEnd = user?.subscriptionCurrentPeriodEnd
    ? new Date(user.subscriptionCurrentPeriodEnd)
    : null;
  const hasValidPeriodEnd =
    periodEnd instanceof Date && !Number.isNaN(periodEnd.getTime());
  const periodNotExpired = !hasValidPeriodEnd || periodEnd.getTime() > Date.now();
  const activeFromFuturePeriod =
    hasStripeSubscriptionId && hasValidPeriodEnd && periodEnd.getTime() > Date.now();

  return (
    (statusActive && periodNotExpired) ||
    (Boolean(user?.subscriptionIsActive) && periodNotExpired) ||
    activeFromFuturePeriod
  );
};

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

    const user = await mongoose.models.User.findById(
      order.order.user_id,
    ).populate("orders");
    if (!user) {
      return { error: "User not found" };
    }

    const subscriptionActive = isUserSubscriptionActive(user);
    const requestedSubscriptionBenefits = order?.order?.subscriptionBenefits || {};
    const shouldApplySubscriptionBenefits =
      subscriptionActive && Boolean(requestedSubscriptionBenefits?.isApplied);

    const subscriptionBenefits = shouldApplySubscriptionBenefits
      ? {
          isApplied: true,
          discountPercent: toSafeNumber(
            requestedSubscriptionBenefits.discountPercent,
            20,
          ),
          discountAmount: toSafeNumber(
            requestedSubscriptionBenefits.discountAmount,
            0,
          ),
          freeDeliveryApplied: Boolean(
            requestedSubscriptionBenefits.freeDeliveryApplied,
          ),
          freeDeliveryAmount: toSafeNumber(
            requestedSubscriptionBenefits.freeDeliveryAmount,
            0,
          ),
          freeItemApplied: Boolean(requestedSubscriptionBenefits.freeItemApplied),
          freeItemAmount: toSafeNumber(
            requestedSubscriptionBenefits.freeItemAmount,
            0,
          ),
          freeItemBasePrice: toSafeNumber(
            requestedSubscriptionBenefits.freeItemBasePrice,
            0,
          ),
          freeItemMenuItemId:
            requestedSubscriptionBenefits.freeItemMenuItemId || null,
          freeItemLabel: String(requestedSubscriptionBenefits.freeItemLabel || ""),
          cycleKey: String(requestedSubscriptionBenefits.cycleKey || ""),
          monthlyPriceSnapshot: toSafeNumber(
            requestedSubscriptionBenefits.monthlyPriceSnapshot,
            user.subscriptionMonthlyPrice || 11.99,
          ),
        }
      : {
          isApplied: false,
          discountPercent: 0,
          discountAmount: 0,
          freeDeliveryApplied: false,
          freeDeliveryAmount: 0,
          freeItemApplied: false,
          freeItemAmount: 0,
          freeItemBasePrice: 0,
          freeItemMenuItemId: null,
          freeItemLabel: "",
          cycleKey: "",
          monthlyPriceSnapshot: 0,
        };

    let promoCodeId = order.order.promoCode ? order.order.promoCode.promoCodeId : null;
    if (subscriptionActive) {
      promoCodeId = null;
    }

    const requestedDiscount = toSafeNumber(order.order.discount, 0);
    const normalizedDiscount = subscriptionBenefits.isApplied
      ? toSafeNumber(subscriptionBenefits.discountPercent, 20)
      : subscriptionActive
        ? 0
        : requestedDiscount;

    const requestedDeliveryFee = toSafeNumber(order.order.deliveryFee, 0);
    const normalizedDeliveryFee =
      subscriptionBenefits.isApplied && subscriptionBenefits.freeDeliveryApplied
        ? 0
        : requestedDeliveryFee;

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
      delivery_fee: normalizedDeliveryFee,
      type: order.type,
      coords: coords,
      code,
      address: order.address || "",
      instructions: order.order.instructions,
      status: order.order.scheduled?.isScheduled ? SCHEDULED : ON_GOING,
      offers: order.order.offers,
      rewards: rewardsList,
      createdAt: new Date().toISOString(),
      restaurant: order.restaurant,
      discount: normalizedDiscount,
      sub_total_after_discount: parseFloat(order.order.subTotalAfterDiscount),
      tip: parseFloat(order.order.tip),
      paymentIntentId: order.order.paymentIntentId,
      payment_method: order.order.paymentMethod,
      promoCode: promoCodeId,
      subscriptionBenefits,
      scheduled: {
        isScheduled: order.order.scheduled?.isScheduled || false,
        scheduledFor: order.order.scheduled?.scheduledFor || null,
      },
    });

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
      (userOrder) => userOrder.paymentIntentId === order.order.paymentIntentId,
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
      order.restaurant,
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
