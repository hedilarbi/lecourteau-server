const { default: mongoose } = require("mongoose");
const Order = require("../../models/Order");
const PromoCode = require("../../models/PromoCode");
const PersonalizedOffer = require("../../models/PersonalizedOffer");
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
const {
  checkRestaurantOrderAvailabilityService,
} = require("../restaurantsServices/checkRestaurantOrderAvailabilityService");

require("dotenv/config");

const stripe = Stripe(process.env.STRIPE_PRIVATE_KEY, {
  apiVersion: "2023-08-16",
});

const logWithTimestamp = (message, meta = {}) => {
  const timestamp = new Date().toISOString();
  if (meta && Object.keys(meta).length) {
    console.log(
      `[CreateOrderService] ${timestamp} - ${message} ${JSON.stringify(meta)}`,
    );
    return;
  }
  console.log(`[CreateOrderService] ${timestamp} - ${message}`);
};

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value, fallback = 0) => {
  const normalized = toSafeNumber(value, fallback);
  return Math.round(normalized * 100) / 100;
};

const normalizeId = (value) => String(value || "").trim();

const buildOrderItemsSubtotal = (orderItems = []) =>
  orderItems.reduce((acc, item) => acc + toSafeNumber(item?.price, 0), 0);

const buildOrderOffersSubtotal = (offers = []) =>
  offers.reduce((acc, offer) => acc + toSafeNumber(offer?.price, 0), 0);

// Le client n'envoie que l'id de la récompense et ses personnalisations.
// L'article, la taille et les points sont relus en base (le client ne doit
// pas pouvoir décider du coût en points), puis dénormalisés sur la commande
// pour qu'elle reste lisible si la récompense est retirée du catalogue.
const buildOrderRewards = async (rewards = []) => {
  const rewardIds = rewards
    .map((entry) => normalizeId(entry?.id))
    .filter(Boolean);

  if (!rewardIds.length) return [];

  const rewardDocuments = await mongoose.models.Reward.find({
    _id: { $in: rewardIds },
  });
  const rewardsById = new Map(
    rewardDocuments.map((document) => [String(document._id), document]),
  );

  return rewards.reduce((acc, entry) => {
    const rewardDocument = rewardsById.get(normalizeId(entry?.id));
    if (!rewardDocument) return acc;

    const customizations = Array.isArray(entry?.customizations)
      ? entry.customizations.map(normalizeId).filter(Boolean)
      : [];

    acc.push({
      reward: rewardDocument._id,
      item: rewardDocument.item,
      size: rewardDocument.size || entry?.size || "",
      customizations,
      points: toSafeNumber(rewardDocument.points, 0),
      extraPrice: roundMoney(entry?.extraPrice, 0),
      comment: entry?.comment || "",
    });

    return acc;
  }, []);
};

const getPromoExcludedCategoryIds = (promoCode) => {
  if (!Array.isArray(promoCode?.excludedCategories)) return [];

  return [
    ...new Set(
      promoCode.excludedCategories
        .map((category) => normalizeId(category?._id || category))
        .filter(Boolean),
    ),
  ];
};

const getPromoLegacyIncludedCategoryId = (promoCode) =>
  normalizeId(promoCode?.category?._id || promoCode?.category);

// Offers are excluded upstream because this subtotal contains order items only.
// Menu items are excluded only when their category is explicitly configured.
const calculatePromoEligibleSubtotal = (promoCode, orderItems, menuItemsById) => {
  const promoExcludedCategoryIds = getPromoExcludedCategoryIds(promoCode);
  const legacyIncludedCategoryId = getPromoLegacyIncludedCategoryId(promoCode);

  const itemsEligibleSubtotal = orderItems.reduce((sum, orderItem) => {
    if (orderItem?.isSmartOfferFreeItem) return sum;
    const menuItem = menuItemsById.get(normalizeId(orderItem?.item));
    if (!menuItem) return sum;
    const menuItemCategoryId = normalizeId(
      menuItem?.category?._id || menuItem?.category,
    );
    if (promoExcludedCategoryIds.length) {
      if (promoExcludedCategoryIds.includes(menuItemCategoryId)) {
        return sum;
      }
    } else if (
      legacyIncludedCategoryId &&
      menuItemCategoryId !== legacyIncludedCategoryId
    ) {
      return sum;
    }

    return sum + toSafeNumber(orderItem?.price, 0);
  }, 0);

  return roundMoney(itemsEligibleSubtotal, 0);
};

const calculatePromoDiscountAmount = (promoCode, eligibleSubtotal) => {
  if (!promoCode) return 0;

  if (promoCode.type === "percent") {
    return roundMoney(
      eligibleSubtotal * (toSafeNumber(promoCode?.percent, 0) / 100),
      0,
    );
  }

  if (promoCode.type === "amount") {
    return roundMoney(
      Math.min(eligibleSubtotal, toSafeNumber(promoCode?.amount, 0)),
      0,
    );
  }

  return 0;
};

const normalizeOrderType = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const isPickupOrderType = (value) => {
  const normalizedType = normalizeOrderType(value);
  return normalizedType === "pick up" || normalizedType === "pickup";
};

const normalizePaymentMethod = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizeCoords = (coords) => {
  const latitude = Number(coords?.latitude);
  const longitude = Number(coords?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
};

const buildDetailedAddress = (address = {}) => ({
  street_address:
    address.street_address || address.streetAddress || address.street || "",
  city: address.city || "",
  state: address.state || "",
  postal_code:
    address.postal_code || address.postalCode || address.zipCode || "",
  country: address.country || "",
});

const normalizeAddressText = (address) =>
  String(address || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const resolveOrderAddressSelection = ({ order, user }) => {
  const requestedAddressId = normalizeId(order?.addressId);
  const userAddresses = Array.isArray(user?.addresses) ? user.addresses : [];

  if (requestedAddressId) {
    const savedAddress = userAddresses.find(
      (address) => String(address?._id || "") === requestedAddressId,
    );

    if (!savedAddress) {
      return {
        error:
          "Adresse de livraison introuvable. Veuillez sélectionner votre adresse à nouveau.",
      };
    }

    return {
      address: String(savedAddress.address || "").trim(),
      coords: normalizeCoords(savedAddress.coords),
      detailedAddress: buildDetailedAddress(savedAddress),
      fromSavedAddress: true,
    };
  }

  return {
    address: String(order?.address || "").trim(),
    coords: normalizeCoords(order?.coords),
    detailedAddress: buildDetailedAddress(
      order?.detailedAddress || order?.detailed_address || {},
    ),
    fromSavedAddress: false,
  };
};

const appendDeliveryAddressIfMissing = (user, resolvedOrderAddress) => {
  if (!user || resolvedOrderAddress?.fromSavedAddress) return false;

  const normalizedOrderAddress = normalizeAddressText(
    resolvedOrderAddress?.address,
  );
  if (!normalizedOrderAddress) return false;

  const alreadyExists = (user.addresses || []).some(
    (savedAddress) =>
      normalizeAddressText(savedAddress?.address) === normalizedOrderAddress,
  );

  if (alreadyExists) return false;

  const detailedAddress = resolvedOrderAddress?.detailedAddress || {};
  const addressEntry = {
    address: resolvedOrderAddress.address,
    street_address: detailedAddress.street_address || "",
    city: detailedAddress.city || "",
    state: detailedAddress.state || "",
    postal_code: detailedAddress.postal_code || "",
    country: detailedAddress.country || "",
  };

  if (resolvedOrderAddress?.coords) {
    addressEntry.coords = resolvedOrderAddress.coords;
  }

  user.addresses.push(addressEntry);
  return true;
};

const buildAvailabilityErrorMessage = ({
  unavailableItems = [],
  unavailableOffers = [],
} = {}) => {
  const parts = [];

  if (unavailableItems.length > 0) {
    parts.push(
      `Articles indisponibles: ${unavailableItems
        .map((item) => item?.name)
        .filter(Boolean)
        .join(", ")}`,
    );
  }

  if (unavailableOffers.length > 0) {
    parts.push(
      `Offres indisponibles: ${unavailableOffers
        .map((offer) => offer?.name)
        .filter(Boolean)
        .join(", ")}`,
    );
  }

  if (!parts.length) {
    return "Certains articles de cette commande ne sont plus disponibles pour cette succursale.";
  }

  return `${parts.join(" • ")}. Veuillez mettre à jour votre panier.`;
};

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
    const allowZeroTotalReferralOrder = Boolean(
      options?.allowZeroTotalReferralOrder,
    );
    const allowAnyZeroTotalOrder =
      allowZeroTotalSubscriptionOrder || allowZeroTotalReferralOrder;
    const orderItems = Array.isArray(orderPayload.orderItems)
      ? orderPayload.orderItems
      : [];
    const offers = Array.isArray(orderPayload.offers) ? orderPayload.offers : [];
    const rewards = Array.isArray(orderPayload.rewards)
      ? orderPayload.rewards
      : [];
    const rewardsList = await buildOrderRewards(rewards);
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
    const normalizedOrderTypeValue = normalizeOrderType(order?.type);
    const normalizedPaymentMethod = normalizePaymentMethod(
      orderPayload.paymentMethod,
    );
    const isPickupCounterPayment =
      isPickupOrderType(normalizedOrderTypeValue) &&
      normalizedPaymentMethod === "cash_at_counter";
    const resolvedOrderAddress = resolveOrderAddressSelection({ order, user });
    if (resolvedOrderAddress.error) {
      return { error: resolvedOrderAddress.error };
    }
    if (
      !isPickupOrderType(normalizedOrderTypeValue) &&
      !resolvedOrderAddress.address
    ) {
      return {
        error:
          "Adresse de livraison invalide. Veuillez sélectionner votre adresse à nouveau.",
      };
    }

    const totalPrice = roundMoney(orderPayload.total, 0);
    const isZeroTotalOrder = totalPrice <= 0;

    if (allowAnyZeroTotalOrder && !isZeroTotalOrder) {
      return {
        error:
          "Cette route est réservée aux commandes avec total 0.",
      };
    }

    if (!allowAnyZeroTotalOrder && isZeroTotalOrder) {
      return {
        error:
          "Les commandes avec total 0 doivent utiliser la route dédiée.",
      };
    }

    if (allowAnyZeroTotalOrder && orderPayload.paymentIntentId) {
      return {
        error: "Aucun paiement Stripe ne doit être envoyé pour une commande à 0.",
      };
    }

    if (!allowAnyZeroTotalOrder) {
      if (normalizedPaymentMethod !== "card" && !isPickupCounterPayment) {
        return { error: "Payment method not supported" };
      }

      if (isPickupCounterPayment && orderPayload.paymentIntentId) {
        return {
          error:
            "Aucun paiement Stripe ne doit être envoyé pour un paiement au comptoir.",
        };
      }

      if (normalizedPaymentMethod === "card" && !orderPayload.paymentIntentId) {
        return {
          error:
            "Un paiement Stripe est requis pour les commandes avec total supérieur à 0.",
        };
      }

      if (normalizedPaymentMethod === "card") {
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
          logWithTimestamp("Payment amount mismatch", {
            userId: String(user?._id || ""),
            platform: normalizedPlatform,
            paymentIntentId: String(paymentIntent?.id || ""),
            paymentIntentStatus,
            paymentIntentAmountCents,
            expectedAmountCents,
            paymentIntentAmount: roundMoney(paymentIntentAmountCents / 100, 0),
            expectedOrderTotal: roundMoney(orderPayload.total, 0),
            rawOrderTotal: orderPayload.total,
            subTotal: roundMoney(orderPayload.subTotal, 0),
            subTotalAfterDiscount: roundMoney(
              orderPayload.subTotalAfterDiscount,
              0,
            ),
            deliveryFee: roundMoney(orderPayload.deliveryFee, 0),
            tip: roundMoney(orderPayload.tip, 0),
            orderItemsCount: orderItems.length,
            offersCount: offers.length,
            rewardsCount: rewards.length,
            promoCodeId: normalizeId(orderPayload?.promoCode?.promoCodeId),
            promoCode: String(orderPayload?.promoCode?.code || ""),
            scheduled: Boolean(orderPayload?.scheduled?.isScheduled),
          });
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
    }

    const { response: availabilityResponse, error: availabilityError } =
      await checkRestaurantOrderAvailabilityService(order.restaurant, {
        orderItems,
        offers,
      });

    if (availabilityError) {
      return {
        error:
          String(availabilityError?.message || availabilityError) ===
          "Restaurant not found"
            ? "Restaurant not found."
            : String(availabilityError?.message || availabilityError),
      };
    }

    if (!availabilityResponse?.isValid) {
      return {
        error: buildAvailabilityErrorMessage(availabilityResponse),
      };
    }

    const subscriptionActive = isSubscriptionCurrentlyActive(user);
    const firstOrderDiscountEligible = !Boolean(user?.firstOrderDiscountApplied);
    const requestedPromoCodeId = orderPayload.promoCode
      ? normalizeId(orderPayload.promoCode.promoCodeId)
      : null;
    const promoCodeRequested = Boolean(requestedPromoCodeId);
    const firstOrderDiscountApplies =
      firstOrderDiscountEligible && !(subscriptionActive && promoCodeRequested) && !Boolean(orderPayload.personalizedOfferId || orderPayload.personalizedOffer);
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
      shouldApplySubscriptionBenefits &&
      !firstOrderDiscountApplies &&
      !promoCodeRequested &&
      !Boolean(orderPayload.personalizedOfferId || orderPayload.personalizedOffer)
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
      Boolean(requestedBirthdayBenefits?.isApplied) && !Boolean(orderPayload.personalizedOfferId || orderPayload.personalizedOffer);
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

    const personalizedOfferId = orderPayload.personalizedOfferId || orderPayload.personalizedOffer;
    let personalizedOfferDocument = null;
    let personalizedDiscountAmount = 0;
    let personalizedFreeItemBenefitAmount = 0;

    if (personalizedOfferId) {
      if (requestedPromoCodeId) {
        return {
          error: "Vous ne pouvez pas combiner un code promo et une offre personnalisée.",
        };
      }
      
      const now = new Date();
      personalizedOfferDocument = await PersonalizedOffer.findById(personalizedOfferId);
      if (!personalizedOfferDocument || String(personalizedOfferDocument.user) !== String(user._id)) {
        return {
          error: "Offre personnalisée invalide.",
        };
      }

      if (!["active", "viewed", "clicked"].includes(personalizedOfferDocument.status) || (personalizedOfferDocument.validUntil && personalizedOfferDocument.validUntil < now)) {
        return {
          error: "Cette offre personnalisée a expiré ou n'est plus active.",
        };
      }

      const existingOrderWithOffer = await Order.findOne({
        personalizedOffer: personalizedOfferDocument._id,
        status: { $ne: CANCELED },
      });

      if (existingOrderWithOffer) {
        return {
          error: "Cette offre personnalisée est déjà en cours d'utilisation dans une commande.",
        };
      }

      if (personalizedOfferDocument.bonusThreshold > 0) {
        const subtotalForBonus = buildOrderItemsSubtotal(orderItems) + buildOrderOffersSubtotal(offers);
        if (subtotalForBonus < personalizedOfferDocument.bonusThreshold) {
          return {
            error: `Le sous-total de votre commande doit être d'au moins $${personalizedOfferDocument.bonusThreshold} pour bénéficier de cette offre.`,
          };
        }
      }

      if (personalizedOfferDocument.offerType === "discount_category") {
        const targetCatId = String(personalizedOfferDocument.targetCategory);
        const itemIds = orderItems.map(i => i.item).filter(Boolean);
        const dbItems = await mongoose.models.MenuItem.find({ _id: { $in: itemIds } });
        const catMap = {};
        const promoLockedMap = {};
        dbItems.forEach(i => {
          catMap[String(i._id)] = String(i.category);
          promoLockedMap[String(i._id)] = !!i.promo_locked;
        });
        
        orderItems.forEach(item => {
          if (catMap[String(item.item)] === targetCatId && !promoLockedMap[String(item.item)]) {
            personalizedDiscountAmount += toSafeNumber(item.price, 0) * (personalizedOfferDocument.discountValue / 100);
          }
        });
      } else if (personalizedOfferDocument.offerType === "discount_product") {
        const targetItemId = String(personalizedOfferDocument.targetMenuItem);
        const dbItem = await mongoose.models.MenuItem.findById(targetItemId);
        const isLocked = dbItem ? !!dbItem.promo_locked : false;
        
        if (!isLocked) {
          orderItems.forEach(item => {
            if (String(item.item) === targetItemId) {
              personalizedDiscountAmount += toSafeNumber(item.price, 0) * (personalizedOfferDocument.discountValue / 100);
            }
          });
        }
      } else if (personalizedOfferDocument.offerType === "free_item") {
        const subtotal = buildOrderItemsSubtotal(orderItems) + buildOrderOffersSubtotal(offers);
        if (personalizedOfferDocument.bonusThreshold && subtotal < personalizedOfferDocument.bonusThreshold) {
          return {
            error: `Le sous-total de votre commande doit être d'au moins $${personalizedOfferDocument.bonusThreshold} pour bénéficier de l'article offert.`,
          };
        }
        const freeItemId = personalizedOfferDocument.freeItem ? String(personalizedOfferDocument.freeItem) : "";
        const targetCatId = personalizedOfferDocument.targetCategory ? String(personalizedOfferDocument.targetCategory) : "";
        const configuredFreeItems = Array.isArray(personalizedOfferDocument.freeItems)
          ? personalizedOfferDocument.freeItems
          : [];
        let matchingItem = orderItems.find(item => {
          if (!item.isSmartOfferFreeItem) return false;
          if (configuredFreeItems.length === 0) {
            return freeItemId ? String(item.item) === freeItemId : false;
          }

          const itemId = String(item.item || "");
          const itemSize = String(item.size || "").trim().toLowerCase();
          return configuredFreeItems.some(configuredItem => {
            const configuredItemId = String(
              configuredItem?.item?._id || configuredItem?.item || "",
            );
            const configuredSize = String(configuredItem?.size || "")
              .trim()
              .toLowerCase();
            return configuredItemId === itemId && configuredSize === itemSize;
          });
        });
        if (!matchingItem && freeItemId) {
          matchingItem = orderItems.find(item => String(item.item) === freeItemId);
        }
        if (!matchingItem && targetCatId) {
          const itemIds = orderItems.map(i => i.item).filter(Boolean);
          const dbItems = await mongoose.models.MenuItem.find({ _id: { $in: itemIds } });
          const catMap = {};
          dbItems.forEach(i => {
            catMap[String(i._id)] = String(i.category);
          });
          matchingItem = orderItems.find(item => catMap[String(item.item)] === targetCatId);
        }
        if (matchingItem) {
          let freeItemBasePrice = toSafeNumber(matchingItem.basePrice, 0);
          if (freeItemBasePrice <= 0) {
            const dbMenuItem = await mongoose.models.MenuItem.findById(matchingItem.item);
            freeItemBasePrice = toSafeNumber(dbMenuItem?.price, toSafeNumber(matchingItem.price, 0));
          }
          // The free item's base price is already removed from orderItem.price;
          // that price contains only paying extras. Keep the saved benefit for
          // analytics, but do not subtract it from the subtotal a second time.
          personalizedFreeItemBenefitAmount =
            freeItemBasePrice > 0
              ? freeItemBasePrice
              : toSafeNumber(matchingItem.price, 0);
          personalizedDiscountAmount = 0;
        } else {
          return {
            error: "L'article gratuit de l'offre personnalisée n'est pas dans votre panier.",
          };
        }
      } else if (personalizedOfferDocument.offerType === "bonus_basket") {
        const subtotal = buildOrderItemsSubtotal(orderItems) + buildOrderOffersSubtotal(offers);
        if (subtotal >= personalizedOfferDocument.bonusThreshold) {
          personalizedDiscountAmount = personalizedOfferDocument.discountValue;
        } else {
          return {
            error: `Le sous-total doit être d'au moins $${personalizedOfferDocument.bonusThreshold} pour bénéficier de cette offre.`,
          };
        }
      } else if (personalizedOfferDocument.offerType === "discount_order") {
        // Exclude promo_locked items from the subtotal discount base (R06)
        const itemIds = orderItems.map(i => i.item).filter(Boolean);
        const dbItems = await mongoose.models.MenuItem.find({ _id: { $in: itemIds } });
        const promoLockedMap = {};
        dbItems.forEach(i => {
          promoLockedMap[String(i._id)] = !!i.promo_locked;
        });

        let discountableBase = 0;
        orderItems.forEach(item => {
          if (!promoLockedMap[String(item.item)]) {
            discountableBase += toSafeNumber(item.price, 0);
          }
        });
        
        personalizedDiscountAmount = discountableBase * (personalizedOfferDocument.discountValue / 100);
      } else if (personalizedOfferDocument.offerType === "free_delivery") {
        personalizedDiscountAmount = 0; // Discount applied directly to delivery fee, not subtotal
      } else if (personalizedOfferDocument.offerType === "loyalty_points") {
        const bonusPoints = Math.floor(
          toSafeNumber(personalizedOfferDocument.bonusPoints, 0),
        );
        if (bonusPoints <= 0) {
          return { error: "Le nombre de points bonus configuré est invalide." };
        }
        personalizedDiscountAmount = 0;
      }

      personalizedDiscountAmount = roundMoney(personalizedDiscountAmount, 0);

      const expectedSubTotalAfterDiscount = roundMoney(
        Math.max(0, toSafeNumber(orderPayload.subTotal, 0) - personalizedDiscountAmount),
        0,
      );
      const receivedSubTotalAfterDiscount = roundMoney(
        orderPayload.subTotalAfterDiscount,
        0,
      );

      console.log("[PersonalizedOffer] subTotal:", orderPayload.subTotal, "| discountValue:", personalizedOfferDocument.discountValue, "| offerType:", personalizedOfferDocument.offerType, "| personalizedDiscountAmount:", personalizedDiscountAmount, "| expected subTotalAfterDiscount:", expectedSubTotalAfterDiscount, "| received subTotalAfterDiscount:", receivedSubTotalAfterDiscount);

      if (Math.abs(expectedSubTotalAfterDiscount - receivedSubTotalAfterDiscount) > 0.01) {
        return {
          error: "Le montant de l'offre personnalisée ne correspond pas aux articles du panier.",
        };
      }
    }


    let promoCodeId = requestedPromoCodeId;

    let promoCodeDocument = null;
    let promoDiscountAmount = 0;

    if (promoCodeId && (firstOrderDiscountEligible || personalizedOfferId) && !subscriptionActive) {
      return {
        error:
          "Une autre réduction est déjà appliquée à cette commande. Le code promo ne peut pas être utilisé.",
      };
    }

    if (promoCodeId) {
      promoCodeDocument = await PromoCode.findById(promoCodeId)
        .populate("freeItem")
        .populate("category");

      if (!promoCodeDocument) {
        return {
          error: "Code promo invalide.",
        };
      }

      const currentDate = new Date();
      if (
        promoCodeDocument.startDate > currentDate ||
        promoCodeDocument.endDate < currentDate
      ) {
        return {
          error: "Code promo invalide.",
        };
      }

      const usedPromo = user.usedPromoCodes.find(
        (used) =>
          normalizeId(used?.promoCode) === normalizeId(promoCodeDocument?._id),
      );

      if (
        usedPromo &&
        typeof promoCodeDocument.usagePerUser === "number" &&
        usedPromo.numberOfUses >= promoCodeDocument.usagePerUser
      ) {
        return {
          error:
            "Ce code promo a déjà été utilisé le nombre maximum de fois autorisé.",
        };
      }

      if (
        promoCodeDocument.type === "percent" ||
        promoCodeDocument.type === "amount"
      ) {
        const orderMenuItemIds = [
          ...new Set(
            orderItems
              .map((item) => normalizeId(item?.item))
              .filter((itemId) => Boolean(itemId)),
          ),
        ];
        const relatedMenuItems = orderMenuItemIds.length
          ? await mongoose.models.MenuItem.find({
              _id: { $in: orderMenuItemIds },
            })
              .select("_id category")
              .populate({ path: "category", select: "name" })
              .lean()
          : [];
        const menuItemsById = new Map(
          relatedMenuItems.map((item) => [normalizeId(item?._id), item]),
        );
        const eligibleSubtotal = calculatePromoEligibleSubtotal(
          promoCodeDocument,
          orderItems,
          menuItemsById,
        );

        if (eligibleSubtotal <= 0) {
          const promoExcludedCategoryIds =
            getPromoExcludedCategoryIds(promoCodeDocument);
          logWithTimestamp("Promo code has no eligible items", {
            userId: String(user?._id || ""),
            platform: normalizedPlatform,
            promoCodeId: normalizeId(promoCodeDocument?._id),
            promoCode: String(promoCodeDocument?.code || ""),
            promoType: String(promoCodeDocument?.type || ""),
            promoExcludedCategoryIds,
            promoCategoryId: normalizeId(
              promoCodeDocument?.category?._id || promoCodeDocument?.category,
            ),
            eligibleSubtotal,
            orderItemsCount: orderItems.length,
            offersCount: offers.length,
            orderItemIds: orderItems.map((item) => normalizeId(item?.item)),
            offerIds: offers.map((offer) => normalizeId(offer?.offer)),
          });
          return {
            error:
              "Ce code promo ne s'applique à aucun article ou offre de cette commande.",
          };
        }

        promoDiscountAmount = calculatePromoDiscountAmount(
          promoCodeDocument,
          eligibleSubtotal,
        );

        const expectedSubTotalAfterDiscount = roundMoney(
          Math.max(0, toSafeNumber(orderPayload.subTotal, 0) - promoDiscountAmount),
          0,
        );
        const receivedSubTotalAfterDiscount = roundMoney(
          orderPayload.subTotalAfterDiscount,
          0,
        );

        if (
          Math.abs(expectedSubTotalAfterDiscount - receivedSubTotalAfterDiscount) >
          0.01
        ) {
          const promoExcludedCategoryIds =
            getPromoExcludedCategoryIds(promoCodeDocument);
          logWithTimestamp("Promo discount mismatch", {
            userId: String(user?._id || ""),
            platform: normalizedPlatform,
            promoCodeId: normalizeId(promoCodeDocument?._id),
            promoCode: String(promoCodeDocument?.code || ""),
            promoType: String(promoCodeDocument?.type || ""),
            promoPercent: toSafeNumber(promoCodeDocument?.percent, 0),
            promoAmount: toSafeNumber(promoCodeDocument?.amount, 0),
            promoExcludedCategoryIds,
            promoCategoryId: normalizeId(
              promoCodeDocument?.category?._id || promoCodeDocument?.category,
            ),
            subTotal: roundMoney(orderPayload.subTotal, 0),
            eligibleSubtotal,
            promoDiscountAmount,
            expectedSubTotalAfterDiscount,
            receivedSubTotalAfterDiscount,
            orderItemsCount: orderItems.length,
            offersCount: offers.length,
            orderItemIds: orderItems.map((item) => normalizeId(item?.item)),
            offerIds: offers.map((offer) => normalizeId(offer?.offer)),
          });
          return {
            error:
              "Le montant du code promo ne correspond plus aux articles éligibles de la commande.",
          };
        }
      }
    }

    const requestedDiscount = toSafeNumber(orderPayload.discount, 0);
    const normalizedDiscount = firstOrderDiscountApplies
      ? 20
      : subscriptionBenefits.isApplied &&
          toSafeNumber(subscriptionBenefits?.discountPercent, 0) > 0
        ? toSafeNumber(subscriptionBenefits.discountPercent, 0)
      : subscriptionActive
        ? 0
      : requestedDiscount;

    const requestedDeliveryFee = toSafeNumber(orderPayload.deliveryFee, 0);
    const normalizedDeliveryFee =
      (subscriptionBenefits.isApplied && subscriptionBenefits.freeDeliveryApplied) ||
      (personalizedOfferDocument && personalizedOfferDocument.offerType === "free_delivery")
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

    if (allowZeroTotalReferralOrder) {
      const referralBalanceForValidation = toSafeNumber(user.referralBalance, 0);
      const requestedReferralDiscount = toSafeNumber(
        orderPayload.referralDiscountApplied,
        0,
      );
      if (requestedReferralDiscount <= 0) {
        return {
          error:
            "Un crédit de parrainage est requis pour passer une commande à total 0 via cette route.",
        };
      }
      if (requestedReferralDiscount > referralBalanceForValidation + 0.01) {
        return {
          error: "Solde de parrainage insuffisant pour couvrir le total de la commande.",
        };
      }
    }

    let coords = resolvedOrderAddress.coords || {};
    if (!coords?.latitude || !coords?.longitude) {
      coords = {
        latitude: 0,
        longitude: 0,
      };
    }

    const referralDiscountApplied = toSafeNumber(
      orderPayload.referralDiscountApplied,
      0,
    );
    if (referralDiscountApplied > 0) {
      const availableBalance = toSafeNumber(user.referralBalance, 0);
      if (referralDiscountApplied > availableBalance + 0.01) {
        return {
          error: "Solde de parrainage insuffisant.",
        };
      }
      user.referralBalance = Math.max(0, roundMoney(availableBalance - referralDiscountApplied, 0));
    }

    const personalizedOfferApplied = Boolean(
      personalizedOfferDocument &&
        (personalizedOfferDocument.offerType === "free_delivery"
          ? order.type === "delivery" &&
            requestedDeliveryFee > 0 &&
            normalizedDeliveryFee === 0
          : personalizedOfferDocument.offerType === "free_item"
            ? personalizedFreeItemBenefitAmount > 0
            : personalizedOfferDocument.offerType === "loyalty_points"
              ? Math.floor(toSafeNumber(personalizedOfferDocument.bonusPoints, 0)) > 0
            : personalizedDiscountAmount > 0),
    );
    // The Hedi share is credited only when the restaurant confirms the order.
    // Keep it at zero while the order is awaiting confirmation.
    const hediSharePercent = 0;
    const hediShareAmount = 0;

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
      address: resolvedOrderAddress.address || "",
      detailed_address: resolvedOrderAddress.detailedAddress,
      instructions: orderPayload.instructions,
      status: orderPayload.scheduled?.isScheduled ? SCHEDULED : ON_GOING,
      offers: orderPayload.offers,
      rewards: rewardsList,
      createdAt: new Date().toISOString(),
      restaurant: order.restaurant,
      discount: normalizedDiscount,
      sub_total_after_discount: parseFloat(orderPayload.subTotalAfterDiscount),
      tip: parseFloat(orderPayload.tip),
      paymentIntentId: allowAnyZeroTotalOrder
        ? null
        : orderPayload.paymentIntentId,
      payment_method: allowZeroTotalSubscriptionOrder
        ? "subscription_free_item"
        : allowZeroTotalReferralOrder
          ? "referral_credit"
          : normalizedPaymentMethod || "card",
      promoCode: promoCodeId,
      personalizedOffer: personalizedOfferId || null,
      personalizedOfferApplied,
      smartOfferBonusPoints:
        personalizedOfferApplied &&
        personalizedOfferDocument?.offerType === "loyalty_points"
          ? Math.floor(toSafeNumber(personalizedOfferDocument.bonusPoints, 0))
          : 0,
      subscriptionBenefits,
      birthdayBenefits,
      scheduled: {
        isScheduled: orderPayload.scheduled?.isScheduled || false,
        scheduledFor: orderPayload.scheduled?.scheduledFor || null,
      },
      referralDiscountApplied,
      hediSharePercent,
      hediShareAmount,
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
    if (!isPickupOrderType(normalizedOrderTypeValue)) {
      appendDeliveryAddressIfMissing(user, resolvedOrderAddress);
    }
    user.orders.push(response._id);
    await user.save();

    // Expire/Apply smart offers for this user (Rule R15)
    if (personalizedOfferId) {
      await PersonalizedOffer.findByIdAndUpdate(personalizedOfferId, {
        status: "applied"
      }).catch(() => {});
      await PersonalizedOffer.updateMany(
        {
          user: user._id,
          status: { $in: ["prepared", "active", "viewed", "clicked"] },
          _id: { $ne: personalizedOfferId }
        },
        { $set: { status: "expired" } }
      ).catch(() => {});
    } else {
      await PersonalizedOffer.updateMany(
        {
          user: user._id,
          status: { $in: ["prepared", "active", "viewed", "clicked"] }
        },
        { $set: { status: "expired" } }
      ).catch(() => {});
    }
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
