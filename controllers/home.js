const Category = require("../models/Category");
const Offer = require("../models/Offer");
const Vedette = require("../models/Vedette");
const HomeSetting = require("../models/HomeSetting");
const Setting = require("../models/Setting");
const normalizeOffersOrderService = require("../services/offersServices/normalizeOffersOrderService");

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveMenuItemBasePrice = (menuItem) => {
  if (!Array.isArray(menuItem?.prices) || menuItem.prices.length === 0) return 0;
  const normalizedPrices = menuItem.prices
    .map((entry) => toSafeNumber(entry?.price, NaN))
    .filter((entry) => Number.isFinite(entry));
  if (!normalizedPrices.length) return 0;
  return Math.min(...normalizedPrices);
};

const formatSubscriptionFreeItem = (setting) => {
  const freeItemDoc = setting?.subscription?.freeItemMenuItemId || null;
  const freeItemMenuItemId = freeItemDoc?._id
    ? String(freeItemDoc._id)
    : setting?.subscription?.freeItemMenuItemId
      ? String(setting.subscription.freeItemMenuItemId)
      : "";
  const freeItemMenuItemName = String(
    setting?.subscription?.freeItemMenuItemName ||
      freeItemDoc?.name ||
      "",
  ).trim();

  if (!freeItemMenuItemId) return null;

  return {
    menuItemId: freeItemMenuItemId,
    menuItemName: freeItemMenuItemName,
    image: freeItemDoc?.image || null,
    basePrice: resolveMenuItemBasePrice(freeItemDoc),
  };
};

const formatBirthdayFreeItem = (setting) => {
  const freeItemDoc = setting?.birthday?.freeItemMenuItemId || null;
  const freeItemMenuItemId = freeItemDoc?._id
    ? String(freeItemDoc._id)
    : setting?.birthday?.freeItemMenuItemId
      ? String(setting.birthday.freeItemMenuItemId)
      : "";
  const freeItemMenuItemName = String(
    setting?.birthday?.freeItemMenuItemName ||
      freeItemDoc?.name ||
      "",
  ).trim();

  if (!freeItemMenuItemId) return null;

  return {
    menuItemId: freeItemMenuItemId,
    menuItemName: freeItemMenuItemName,
    image: freeItemDoc?.image || null,
    basePrice: resolveMenuItemBasePrice(freeItemDoc),
  };
};

const getHomeContent = async (req, res) => {
  try {
    const { error: normalizeError } = await normalizeOffersOrderService();
    if (normalizeError) {
      return res.status(500).json({
        success: false,
        message: normalizeError,
      });
    }

    const [categories, offers, vedettes, homeSettings, settings] = await Promise.all([
      Category.find().sort({ order: 1 }),
      Offer.find().sort({ order: 1, createdAt: 1 }).populate("items.item"),
      Vedette.find().sort({ order: 1 }).populate("menuItem"),
      HomeSetting.findOne()
        .sort({ createdAt: -1 })
        .populate("menuItemId")
        .populate("offerId")
        .populate({
          path: "codePromoId",
          populate: {
            path: "freeItem",
            select: "name",
          },
        }),
      Setting.findOne()
        .populate("subscription.freeItemMenuItemId", "name image prices")
        .populate("birthday.freeItemMenuItemId", "name image prices"),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        categories,
        offers,
        vedettes,
        homeSettings: homeSettings || null,
        subscriptionFreeItem: formatSubscriptionFreeItem(settings),
        birthdayFreeItem: formatBirthdayFreeItem(settings),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getHomeContent,
};
