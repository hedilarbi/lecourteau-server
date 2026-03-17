const { default: mongoose } = require("mongoose");
const Order = require("../../models/Order");
const { ON_GOING, SCHEDULED, CANCELED } = require("../../utils/constants");
const { Expo } = require("expo-server-sdk");
const generateRandomCode = require("../../utils/generateOrderCode");
const { default: Stripe } = require("stripe");
const {
  getBirthdayBenefitSummary,
} = require("../birthdayServices/birthdayBenefitsService");
const {
  getOrCreateSettingDocument,
  getSubscriptionFreeItemCycleKey,
  isSubscriptionCurrentlyActive,
  SUBSCRIPTION_DISCOUNT_PERCENT,
} = require("../subscriptionServices/subscriptionHelpers");

require("dotenv/config");

const stripe = Stripe(process.env.STRIPE_PRIVATE_KEY, {
  apiVersion: "2023-08-16",
});

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value, fallback = 0) => {
  const normalized = toSafeNumber(value, fallback);
  return Math.round(normalized * 100) / 100;
};

const normalizeId = (value) => String(value || "").trim();

const createOrderService = async (order, options = {}) => {
  try {
    const orderPayload = order?.order || {};
    const requestedPlatform = String(orderPayload.platform || "")
      .trim()
      .toLowerCase();
    const normalizedPlatform = requestedPlatform === "web" ? "web" : "app";
    const allowZeroTotalSubscriptionOrder = Boolean(
      options?.allowZeroTotalSubscriptionOrder,
    );
    const orderItems = Array.isArray(orderPayload.orderItems)
      ? orderPayload.orderItems
      : [];
    const offers = Array.isArray(orderPayload.offers) ? orderPayload.offers : [];
    const rewards = Array.isArray(orderPayload.rewards)
      ? orderPayload.rewards
      : [];
    const rewardsList = rewards.length
      ? rewards
          .map((item) => item?.id)
          .filter((rewardId) => Boolean(rewardId))
      : [];
    const code = generateRandomCode(8).toUpperCase();

    const user = await mongoose.models.User.findById(
      orderPayload.user_id,
    ).populate("orders");
    if (!user) {
      return { error: "User not found" };
    }

    const setting = await getOrCreateSettingDocument();
    const configuredFreeItemId = normalizeId(
      setting?.subscription?.freeItemMenuItemId,
    );
    const configuredFreeItemName = String(
      setting?.subscription?.freeItemMenuItemName || "",
    ).trim();
    const configuredBirthdayFreeItemId = normalizeId(
      setting?.birthday?.freeItemMenuItemId,
    );
    const configuredBirthdayFreeItemName = String(
      setting?.birthday?.freeItemMenuItemName || "",
    ).trim();

    const totalPrice = roundMoney(orderPayload.total, 0);
    const isZeroTotalOrder = totalPrice <= 0;

    if (allowZeroTotalSubscriptionOrder && !isZeroTotalOrder) {
      return {
        error:
          "Cette route est réservée aux commandes total 0 avec article gratuit éligible (abonnement ou anniversaire).",
      };
    }

    if (!allowZeroTotalSubscriptionOrder && isZeroTotalOrder) {
      return {
        error:
          "Les commandes avec total 0 doivent utiliser la route dédiée article gratuit.",
      };
    }

    if (allowZeroTotalSubscriptionOrder && orderPayload.paymentIntentId) {
      return {
        error: "Aucun paiement Stripe ne doit être envoyé pour une commande à 0.",
      };
    }

    if (!allowZeroTotalSubscriptionOrder) {
      if (orderPayload.paymentMethod !== "card") {
        return { error: "Payment method not supported" };
      }

      if (!orderPayload.paymentIntentId) {
        return {
          error:
            "Un paiement Stripe est requis pour les commandes avec total supérieur à 0.",
        };
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(
        orderPayload.paymentIntentId,
      );
      const expectedAmountCents = Math.round(
        toSafeNumber(orderPayload.total, 0) * 100,
      );
      const paymentIntentAmountCents = Math.round(
        toSafeNumber(paymentIntent?.amount, 0),
      );
      const paymentIntentStatus = String(paymentIntent?.status || "")
        .toLowerCase()
        .trim();
      const allowedStatuses = new Set([
        "requires_capture",
        "processing",
        "succeeded",
      ]);

      if (expectedAmountCents <= 0) {
        return {
          error:
            "Le montant de la commande est invalide. Veuillez relancer votre paiement.",
        };
      }

      if (paymentIntentAmountCents !== expectedAmountCents) {
        return {
          error:
            "Le montant du paiement ne correspond plus à la commande. Veuillez relancer le paiement.",
        };
      }

      if (!allowedStatuses.has(paymentIntentStatus)) {
        return {
          error:
            "Le paiement n'est plus valide pour cette commande. Veuillez relancer le paiement.",
        };
      }

      if (
        user?.stripe_id &&
        paymentIntent?.customer &&
        String(paymentIntent.customer) !== String(user.stripe_id)
      ) {
        return {
          error:
            "Le paiement ne correspond pas à ce compte utilisateur. Veuillez relancer le paiement.",
        };
      }
    }

    const subscriptionActive = isSubscriptionCurrentlyActive(user);
    const firstOrderDiscountEligible = !Boolean(user?.firstOrderDiscountApplied);
    const requestedSubscriptionBenefits = orderPayload.subscriptionBenefits || {};
    const shouldApplySubscriptionBenefits =
      subscriptionActive && Boolean(requestedSubscriptionBenefits?.isApplied);
    const currentSubscriptionCycleKey = getSubscriptionFreeItemCycleKey(
      user,
      new Date(),
    );
    const usedFreeItemCountThisCycle =
      String(user?.subscriptionFreeItemCycleKey || "").trim() ===
      currentSubscriptionCycleKey
        ? Math.max(0, Math.floor(toSafeNumber(user?.subscriptionFreeItemUsedCount, 0)))
        : 0;
    const freeItemRemaining = Math.max(0, 1 - usedFreeItemCountThisCycle);
    const requestedFreeItemId = normalizeId(
      requestedSubscriptionBenefits?.freeItemMenuItemId,
    );
    const requestedFreeItemApplied = Boolean(
      requestedSubscriptionBenefits?.freeItemApplied,
    );
    const configuredFreeItemSelected =
      Boolean(configuredFreeItemId) &&
      Boolean(requestedFreeItemId) &&
      configuredFreeItemId === requestedFreeItemId;
    const canApplyConfiguredFreeItem =
      shouldApplySubscriptionBenefits &&
      requestedFreeItemApplied &&
      configuredFreeItemSelected &&
      freeItemRemaining > 0;

    const appliedSubscriptionDiscountPercent =
      shouldApplySubscriptionBenefits && !firstOrderDiscountEligible
        ? SUBSCRIPTION_DISCOUNT_PERCENT
        : 0;
    const appliedSubscriptionDiscountAmount =
      appliedSubscriptionDiscountPercent > 0
        ? roundMoney(
            toSafeNumber(orderPayload.subTotal, 0) *
              (appliedSubscriptionDiscountPercent / 100),
            0,
          )
        : 0;

    const subscriptionBenefits = shouldApplySubscriptionBenefits
      ? {
          isApplied: true,
          discountPercent: appliedSubscriptionDiscountPercent,
          discountAmount: appliedSubscriptionDiscountAmount,
          freeDeliveryApplied: Boolean(
            requestedSubscriptionBenefits.freeDeliveryApplied,
          ),
          freeDeliveryAmount: toSafeNumber(
            requestedSubscriptionBenefits.freeDeliveryAmount,
            0,
          ),
          freeItemApplied: canApplyConfiguredFreeItem,
          freeItemAmount: canApplyConfiguredFreeItem
            ? toSafeNumber(requestedSubscriptionBenefits.freeItemAmount, 0)
            : 0,
          freeItemBasePrice: canApplyConfiguredFreeItem
            ? toSafeNumber(requestedSubscriptionBenefits.freeItemBasePrice, 0)
            : 0,
          freeItemMenuItemId: canApplyConfiguredFreeItem
            ? configuredFreeItemId
            : null,
          freeItemLabel: canApplyConfiguredFreeItem
            ? configuredFreeItemName ||
              String(requestedSubscriptionBenefits.freeItemLabel || "")
            : "",
          cycleKey: canApplyConfiguredFreeItem ? currentSubscriptionCycleKey : "",
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

    const birthdaySummary = getBirthdayBenefitSummary(user, new Date());
    const requestedBirthdayBenefits = orderPayload.birthdayBenefits || {};
    const shouldApplyBirthdayBenefits =
      birthdaySummary.canClaimFreeItem &&
      Boolean(requestedBirthdayBenefits?.isApplied);
    const requestedBirthdayFreeItemId = normalizeId(
      requestedBirthdayBenefits?.freeItemMenuItemId,
    );
    const requestedBirthdayFreeItemApplied = Boolean(
      requestedBirthdayBenefits?.freeItemApplied,
    );
    const containsBirthdayGiftInOrderItems = orderItems.some((item) => {
      if (Boolean(item?.isBirthdayFreeItem)) return true;
      const itemId = normalizeId(item?.item);
      if (!configuredBirthdayFreeItemId || itemId !== configuredBirthdayFreeItemId) {
        return false;
      }
      const basePrice = toSafeNumber(item?.basePrice, 0);
      const price = toSafeNumber(item?.price, 0);
      return basePrice > price;
    });
    const configuredBirthdayFreeItemSelected =
      Boolean(configuredBirthdayFreeItemId) &&
      Boolean(requestedBirthdayFreeItemId) &&
      configuredBirthdayFreeItemId === requestedBirthdayFreeItemId;
    const cycleYearStart = new Date(
      Date.UTC(birthdaySummary.cycleYear, 0, 1, 0, 0, 0, 0),
    );
    const cycleYearEnd = new Date(
      Date.UTC(birthdaySummary.cycleYear, 11, 31, 23, 59, 59, 999),
    );
    const hasExistingBirthdayGiftOrderThisCycle = containsBirthdayGiftInOrderItems
      ? Boolean(
          await Order.exists({
            user: user._id,
            status: { $ne: CANCELED },
            $or: [
              {
                "birthdayBenefits.isApplied": true,
                "birthdayBenefits.freeItemApplied": true,
                "birthdayBenefits.cycleYear": birthdaySummary.cycleYear,
              },
              {
                "orderItems.isBirthdayFreeItem": true,
                createdAt: {
                  $gte: cycleYearStart,
                  $lte: cycleYearEnd,
                },
              },
            ],
          }),
        )
      : false;

    if (containsBirthdayGiftInOrderItems && !birthdaySummary.canClaimFreeItem) {
      return {
        error:
          "Le cadeau anniversaire est disponible uniquement le jour de l'anniversaire et une seule fois par an.",
      };
    }

    if (hasExistingBirthdayGiftOrderThisCycle) {
      return {
        error:
          "Vous avez déjà une commande avec cadeau anniversaire pour cette année.",
      };
    }

    if (
      containsBirthdayGiftInOrderItems &&
      (!Boolean(requestedBirthdayBenefits?.isApplied) ||
        !requestedBirthdayFreeItemApplied ||
        !configuredBirthdayFreeItemSelected)
    ) {
      return {
        error:
          "Les informations du cadeau anniversaire sont invalides pour cette commande.",
      };
    }

    const canApplyConfiguredBirthdayFreeItem =
      shouldApplyBirthdayBenefits &&
      requestedBirthdayFreeItemApplied &&
      configuredBirthdayFreeItemSelected;

    const birthdayBenefits = shouldApplyBirthdayBenefits
      ? {
          isApplied: true,
          freeItemApplied: canApplyConfiguredBirthdayFreeItem,
          freeItemAmount: canApplyConfiguredBirthdayFreeItem
            ? toSafeNumber(requestedBirthdayBenefits.freeItemAmount, 0)
            : 0,
          freeItemBasePrice: canApplyConfiguredBirthdayFreeItem
            ? toSafeNumber(requestedBirthdayBenefits.freeItemBasePrice, 0)
            : 0,
          freeItemMenuItemId: canApplyConfiguredBirthdayFreeItem
            ? configuredBirthdayFreeItemId
            : null,
          freeItemLabel: canApplyConfiguredBirthdayFreeItem
            ? configuredBirthdayFreeItemName ||
              String(requestedBirthdayBenefits.freeItemLabel || "")
            : "",
          cycleYear: Math.floor(
            toSafeNumber(
              requestedBirthdayBenefits.cycleYear,
              birthdaySummary.cycleYear,
            ),
          ),
        }
      : {
          isApplied: false,
          freeItemApplied: false,
          freeItemAmount: 0,
          freeItemBasePrice: 0,
          freeItemMenuItemId: null,
          freeItemLabel: "",
          cycleYear: birthdaySummary.cycleYear,
      };

    let promoCodeId = orderPayload.promoCode
      ? orderPayload.promoCode.promoCodeId
      : null;
    if (subscriptionActive) {
      promoCodeId = null;
    }

    const requestedDiscount = toSafeNumber(orderPayload.discount, 0);
    const normalizedDiscount = firstOrderDiscountEligible
      ? 20
      : subscriptionBenefits.isApplied &&
          toSafeNumber(subscriptionBenefits?.discountPercent, 0) > 0
        ? toSafeNumber(subscriptionBenefits.discountPercent, 0)
      : subscriptionActive
        ? 0
        : requestedDiscount;

    const requestedDeliveryFee = toSafeNumber(orderPayload.deliveryFee, 0);
    const normalizedDeliveryFee =
      subscriptionBenefits.isApplied && subscriptionBenefits.freeDeliveryApplied
        ? 0
        : requestedDeliveryFee;

    if (allowZeroTotalSubscriptionOrder) {
      const canUseAnyConfiguredFreeItem =
        canApplyConfiguredFreeItem || canApplyConfiguredBirthdayFreeItem;
      if (!canUseAnyConfiguredFreeItem) {
        return {
          error:
            "Un article gratuit éligible (abonnement ou anniversaire) est requis pour une commande à total 0.",
        };
      }

      const hasOnlyEligibleFreeItems =
        orderItems.length > 0 &&
        orderItems.every((item) => {
          const itemId = normalizeId(item?.item);
          const isEligibleSubscriptionFreeItem =
            canApplyConfiguredFreeItem && itemId === configuredFreeItemId;
          const isEligibleBirthdayFreeItem =
            canApplyConfiguredBirthdayFreeItem &&
            itemId === configuredBirthdayFreeItemId;

          return (
            isEligibleSubscriptionFreeItem || isEligibleBirthdayFreeItem
          );
        });

      if (!hasOnlyEligibleFreeItems || offers.length > 0 || rewards.length > 0) {
        return {
          error:
            "La commande à total 0 doit contenir uniquement les articles gratuits éligibles configurés.",
        };
      }
    }

    let coords = order.coords || {};
    if (!order.coords?.latitude || !order.coords?.longitude) {
      coords = {
        latitude: 0,
        longitude: 0,
      };
    }

    const newOrder = new Order({
      user: orderPayload.user_id,
      orderItems: orderPayload.orderItems,
      total_price: parseFloat(orderPayload.total),
      sub_total: parseFloat(orderPayload.subTotal),
      delivery_fee: normalizedDeliveryFee,
      type: order.type,
      platform: normalizedPlatform,
      coords: coords,
      code,
      address: order.address || "",
      instructions: orderPayload.instructions,
      status: orderPayload.scheduled?.isScheduled ? SCHEDULED : ON_GOING,
      offers: orderPayload.offers,
      rewards: rewardsList,
      createdAt: new Date().toISOString(),
      restaurant: order.restaurant,
      discount: normalizedDiscount,
      sub_total_after_discount: parseFloat(orderPayload.subTotalAfterDiscount),
      tip: parseFloat(orderPayload.tip),
      paymentIntentId: allowZeroTotalSubscriptionOrder
        ? null
        : orderPayload.paymentIntentId,
      payment_method: allowZeroTotalSubscriptionOrder
        ? "subscription_free_item"
        : orderPayload.paymentMethod,
      promoCode: promoCodeId,
      subscriptionBenefits,
      birthdayBenefits,
      scheduled: {
        isScheduled: orderPayload.scheduled?.isScheduled || false,
        scheduledFor: orderPayload.scheduled?.scheduledFor || null,
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

    if (orderPayload.paymentIntentId) {
      const existingOrderWithPaymentIntent = user.orders.find(
        (userOrder) => userOrder.paymentIntentId === orderPayload.paymentIntentId,
      );

      if (existingOrderWithPaymentIntent) {
        return {
          error: "This payment intent has already been used for another order.",
        };
      }
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
    to: restaurant?.expo_token,
    body: `Nouvelle commande en attente, code:${code}`,
    channel: "default",
    data: { order_id: orderId },
    title: "Nouvelle Commande",
    priority: "high",
  };

  try {
    if (restaurant?.expo_token) {
      await expo.sendPushNotificationsAsync([dashboardMessage]);
    }
  } catch (err) {
    console.error(`Error sending notifications: ${err.message}`);
  }
};
module.exports = createOrderService;
