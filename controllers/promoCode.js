const PromoCode = require("../models/PromoCode");
const Category = require("../models/Category");
const User = require("../models/User");
const { default: Expo } = require("expo-server-sdk");
const { default: mongoose } = require("mongoose");
const {
  isSubscriptionCurrentlyActive,
} = require("../services/subscriptionServices/subscriptionHelpers");
const logWithTimestamp = (message) => {
  const timestamp = new Date().toISOString();
  console.error(`${timestamp} - ${message}`);
};

const normalizeOptionalId = (value) => {
  const rawValue =
    value && typeof value === "object" ? value?._id || value?.value || "" : value;
  const normalized = String(rawValue || "").trim();
  return normalized || null;
};

const normalizeOptionalIds = (values) => {
  if (!Array.isArray(values)) return [];

  return [...new Set(values.map((value) => normalizeOptionalId(value)).filter(Boolean))];
};

const preparePromoCodePayload = async (payload = {}, existingPromoCode = null) => {
  const effectiveType = String(payload?.type || existingPromoCode?.type || "")
    .trim()
    .toLowerCase();

  const nextCode =
    payload?.code !== undefined
      ? String(payload.code || "").trim().toUpperCase()
      : existingPromoCode?.code;

  const nextFreeItem =
    effectiveType === "free_item"
      ? normalizeOptionalId(payload?.freeItem ?? existingPromoCode?.freeItem)
      : null;
  const nextCategory =
    effectiveType === "free_item"
      ? null
      : normalizeOptionalId(payload?.category ?? existingPromoCode?.category);
  const nextExcludedCategories =
    effectiveType === "free_item"
      ? []
      : payload?.excludedCategories !== undefined
        ? normalizeOptionalIds(payload.excludedCategories)
        : payload?.categories !== undefined
          ? normalizeOptionalIds(payload.categories)
          : Array.isArray(existingPromoCode?.excludedCategories)
            ? normalizeOptionalIds(existingPromoCode.excludedCategories)
            : [];
  const nextAmount =
    effectiveType === "amount"
      ? Number(payload?.amount ?? existingPromoCode?.amount ?? 0)
      : null;
  const nextPercent =
    effectiveType === "percent"
      ? Number(payload?.percent ?? existingPromoCode?.percent ?? 0)
      : null;

  if (nextCategory) {
    if (!mongoose.Types.ObjectId.isValid(nextCategory)) {
      throw new Error("Catégorie invalide.");
    }

    const categoryExists = await Category.exists({ _id: nextCategory });
    if (!categoryExists) {
      throw new Error("Catégorie invalide.");
    }
  }

  for (const categoryId of nextExcludedCategories) {
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      throw new Error("Catégorie invalide.");
    }

    const categoryExists = await Category.exists({ _id: categoryId });
    if (!categoryExists) {
      throw new Error("Catégorie invalide.");
    }
  }

  return {
    ...payload,
    code: nextCode,
    type: effectiveType,
    freeItem: nextFreeItem,
    category: nextCategory,
    excludedCategories: nextExcludedCategories,
    amount: nextAmount,
    percent: nextPercent,
  };
};

const createPromoCode = async (req, res) => {
  try {
    const promoCodeData = await preparePromoCodePayload(req.body);
    const notifContent = promoCodeData.notifContent || {};
    const existingPromoCode = await PromoCode.findOne({
      code: promoCodeData.code,
    });
    if (existingPromoCode) {
      return res.status(400).json({
        success: false,
        error: "Code promo déjà utilisé.",
      });
    }
    const promoCode = new PromoCode(promoCodeData);
    await promoCode.save();
    const populatedPromoCode = await promoCode.populate([
      "freeItem",
      "category",
      "excludedCategories",
    ]);
    res.status(201).json({
      success: true,
      data: populatedPromoCode,
    });
    if (
      promoCodeData?.notifContent?.body &&
      promoCodeData?.notifContent?.title
    ) {
      let messages = [];
      let expo = new Expo();
      const users = await mongoose.models.User.find();

      const usersTokens = users.map((user) => user.expo_token);

      for (let pushToken of usersTokens) {
        if (!Expo.isExpoPushToken(pushToken)) {
          continue;
        }

        messages.push({
          to: pushToken,
          sound: "default",
          body: notifContent.body,
          title: notifContent.title,
          priority: "high",
        });
      }

      let chunks = expo.chunkPushNotifications(messages);
      let tickets = [];

      for (let chunk of chunks) {
        try {
          let ticketChunk = await expo.sendPushNotificationsAsync(chunk);

          tickets.push(...ticketChunk);
        } catch (error) {
          console.error("Error sending chunk:", error);
        }
      }
    }
  } catch (error) {
    logWithTimestamp(`Error creating promo code: ${error}`);
    res.status(500).json({
      success: false,
      error:
        error.message || "An error occurred while creating the promo code.",
    });
  }
};

const getPromoCodes = async (req, res) => {
  try {
    const promoCodes = await PromoCode.find()
      .populate("freeItem")
      .populate("category")
      .populate("excludedCategories");
    res.status(200).json(promoCodes);
  } catch (error) {
    logWithTimestamp(`Error fetching promo codes: ${error}`);
    res.status(500).json({
      success: false,
      error:
        error.message || "An error occurred while fetching the promo codes.",
    });
  }
};

const getPromoCodeById = async (req, res) => {
  const { id } = req.params;

  try {
    const promoCode = await PromoCode.findById(id)
      .populate("freeItem")
      .populate("category")
      .populate("excludedCategories");
    if (!promoCode) {
      return res.status(404).json({
        success: false,
        error: "Promo code not found.",
      });
    }
    res.status(200).json({
      success: true,
      data: promoCode,
    });
  } catch (error) {
    logWithTimestamp(`Error fetching promo code by ID: ${error}`);
    res.status(500).json({
      success: false,
      error:
        error.message || "An error occurred while fetching the promo code.",
    });
  }
};

const updatePromoCode = async (req, res) => {
  const { id } = req.params;

  try {
    const promoCode = await PromoCode.findById(id);
    if (!promoCode) {
      return res.status(404).json({
        success: false,
        error: "Promo code not found.",
      });
    }

    const updateData = await preparePromoCodePayload(req.body, promoCode);

    Object.assign(promoCode, updateData);
    await promoCode.save();

    res.status(200).json({
      success: true,
      data: await promoCode.populate(["freeItem", "category", "excludedCategories"]),
    });
  } catch (error) {
    logWithTimestamp(`Error updating promo code: ${error}`);
    res.status(500).json({
      success: false,
      error:
        error.message || "An error occurred while updating the promo code.",
    });
  }
};

const deletePromoCode = async (req, res) => {
  const { id } = req.params;

  try {
    const promoCode = await PromoCode.findByIdAndDelete(id);
    if (!promoCode) {
      return res.status(404).json({
        success: false,
        error: "Promo code not found.",
      });
    }
    res.status(200).json({
      success: true,
      data: promoCode,
    });
  } catch (error) {
    logWithTimestamp(`Error deleting promo code: ${error}`);
    res.status(500).json({
      success: false,
      error:
        error.message || "An error occurred while deleting the promo code.",
    });
  }
};
const verifyPromoCode = async (req, res) => {
  const { code, userId } = req.body;

  try {
    const promoCode = await PromoCode.findOne({
      code: String(code || "").trim().toUpperCase(),
    })
      .populate("freeItem")
      .populate("category")
      .populate("excludedCategories");
    if (!promoCode) {
      return res.status(404).json({
        success: false,
        error: "Code promo n'existe pas.",
      });
    }
    // Vérification de la date de validité
    const currentDate = new Date();
    if (promoCode.startDate > currentDate || promoCode.endDate < currentDate) {
      return res.status(400).json({
        success: false,
        error: "Code promo invalide.",
      });
    }
    // Vérification si l'utilisateur a déjà utilisé ce code
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Utilisateur non trouvé.",
      });
    }

    const hasActiveSubscription = isSubscriptionCurrentlyActive(user);
    if (hasActiveSubscription) {
      return res.status(400).json({
        success: false,
        error:
          "Un abonnement actif est déjà appliqué à votre compte. Les codes promo ne sont pas cumulables.",
      });
    }

    const usedPromo = user.usedPromoCodes.find(
      (used) => used.promoCode?.toString() === promoCode._id.toString()
    );

    if (usedPromo) {
      if (
        typeof promoCode.usagePerUser === "number" &&
        usedPromo.numberOfUses >= promoCode.usagePerUser
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Ce code promo a déjà été utilisé le nombre maximum de fois autorisé.",
        });
      }
    }
    res.status(200).json(promoCode);
  } catch (error) {
    logWithTimestamp(`Error verifying promo code: ${error}`);
    res.status(500).json({
      success: false,
      error:
        error.message || "An error occurred while verifying the promo code.",
    });
  }
};

module.exports = {
  createPromoCode,
  getPromoCodes,
  getPromoCodeById,
  updatePromoCode,
  deletePromoCode,
  verifyPromoCode,
};
