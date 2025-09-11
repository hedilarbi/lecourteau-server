const PromoCode = require("../models/PromoCode");
const User = require("../models/User");
const { default: Expo } = require("expo-server-sdk");
const { default: mongoose } = require("mongoose");
const logWithTimestamp = (message) => {
  const timestamp = new Date().toISOString();
  console.error(`${timestamp} - ${message}`);
};
const createPromoCode = async (req, res) => {
  try {
    const promoCodeData = req.body;
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
    res.status(201).json({
      success: true,
      data: promoCode,
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
    const promoCodes = await PromoCode.find().populate("freeItem");
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
    const promoCode = await PromoCode.findById(id);
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
  const updateData = req.body;

  try {
    const promoCode = await PromoCode.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
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
    const promoCode = await PromoCode.findOne({ code }).populate("freeItem");
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
