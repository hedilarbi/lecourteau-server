const { isValidObjectId } = require("mongoose");
const HomeSetting = require("../../models/HomeSetting");

const normalizeOptionalObjectId = (value) => {
  if (typeof value === "undefined") return null;
  if (value === null) return null;
  if (typeof value === "object" && value._id) return value._id;
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") {
    return null;
  }

  return trimmed;
};

const createHomeSettingService = async (
  title,
  subTitle,
  image,
  menuItemId,
  offerId,
  codePromoId,
  codePromoTitle,
) => {
  try {
    const existingHomeSetting = await HomeSetting.findOne();
    if (existingHomeSetting) {
      return { error: "Home setting already exists" };
    }

    const normalizedMenuItemId = normalizeOptionalObjectId(menuItemId);
    const normalizedOfferId = normalizeOptionalObjectId(offerId);
    const normalizedCodePromoId = normalizeOptionalObjectId(codePromoId);
    const normalizedCodePromoTitle =
      typeof codePromoTitle === "string" ? codePromoTitle.trim() : "";

    if (normalizedMenuItemId && normalizedOfferId) {
      return { error: "Select either a menu item or an offer" };
    }

    if (normalizedMenuItemId && !isValidObjectId(normalizedMenuItemId)) {
      return { error: "Invalid menu item id" };
    }

    if (normalizedOfferId && !isValidObjectId(normalizedOfferId)) {
      return { error: "Invalid offer id" };
    }

    if (normalizedCodePromoId && !isValidObjectId(normalizedCodePromoId)) {
      return { error: "Invalid promo code id" };
    }

    if (normalizedCodePromoId && !normalizedCodePromoTitle) {
      return { error: "Promo code title is required when promo code is selected" };
    }

    const newHomeSetting = new HomeSetting({
      title,
      subTitle,
      image,
      menuItemId: normalizedMenuItemId,
      offerId: normalizedOfferId,
      codePromoId: normalizedCodePromoId,
      codePromoTitle: normalizedCodePromoTitle,
    });

    const savedHomeSetting = await newHomeSetting.save();
    const response = await HomeSetting.findById(savedHomeSetting._id)
      .populate("menuItemId")
      .populate("offerId")
      .populate({
        path: "codePromoId",
        populate: {
          path: "freeItem",
          select: "name",
        },
      });

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = createHomeSettingService;
