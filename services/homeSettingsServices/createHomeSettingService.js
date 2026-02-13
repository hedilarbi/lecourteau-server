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
  description,
  image,
  menuItemId,
  offerId,
  codePromoId,
) => {
  try {
    const existingHomeSetting = await HomeSetting.findOne();
    if (existingHomeSetting) {
      return { error: "Home setting already exists" };
    }

    const normalizedMenuItemId = normalizeOptionalObjectId(menuItemId);
    const normalizedOfferId = normalizeOptionalObjectId(offerId);
    const normalizedCodePromoId = normalizeOptionalObjectId(codePromoId);

    if (normalizedMenuItemId && !isValidObjectId(normalizedMenuItemId)) {
      return { error: "Invalid menu item id" };
    }

    if (normalizedOfferId && !isValidObjectId(normalizedOfferId)) {
      return { error: "Invalid offer id" };
    }

    if (normalizedCodePromoId && !isValidObjectId(normalizedCodePromoId)) {
      return { error: "Invalid promo code id" };
    }

    const newHomeSetting = new HomeSetting({
      title,
      subTitle,
      description,
      image,
      menuItemId: normalizedMenuItemId,
      offerId: normalizedOfferId,
      codePromoId: normalizedCodePromoId,
    });

    const savedHomeSetting = await newHomeSetting.save();
    const response = await HomeSetting.findById(savedHomeSetting._id)
      .populate("menuItemId")
      .populate("offerId")
      .populate("codePromoId");

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = createHomeSettingService;
