const { isValidObjectId } = require("mongoose");
const HomeSetting = require("../../models/HomeSetting");

const normalizeOptionalObjectId = (value) => {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;
  if (typeof value === "object" && value._id) return value._id;
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") {
    return null;
  }

  return trimmed;
};

const updateHomeSettingService = async (
  id,
  title,
  subTitle,
  description,
  firebaseUrl,
  menuItemId,
  offerId,
  codePromoId,
) => {
  try {
    const updateData = {};

    if (typeof title !== "undefined") {
      updateData.title = title;
    }

    if (typeof subTitle !== "undefined") {
      updateData.subTitle = subTitle;
    }

    if (typeof description !== "undefined") {
      updateData.description = description;
    }

    if (firebaseUrl) {
      updateData.image = firebaseUrl;
    }

    const normalizedMenuItemId = normalizeOptionalObjectId(menuItemId);
    if (typeof normalizedMenuItemId !== "undefined") {
      if (normalizedMenuItemId && !isValidObjectId(normalizedMenuItemId)) {
        return { error: "Invalid menu item id" };
      }
      updateData.menuItemId = normalizedMenuItemId;
    }

    const normalizedOfferId = normalizeOptionalObjectId(offerId);
    if (typeof normalizedOfferId !== "undefined") {
      if (normalizedOfferId && !isValidObjectId(normalizedOfferId)) {
        return { error: "Invalid offer id" };
      }
      updateData.offerId = normalizedOfferId;
    }

    const normalizedCodePromoId = normalizeOptionalObjectId(codePromoId);
    if (typeof normalizedCodePromoId !== "undefined") {
      if (normalizedCodePromoId && !isValidObjectId(normalizedCodePromoId)) {
        return { error: "Invalid promo code id" };
      }
      updateData.codePromoId = normalizedCodePromoId;
    }

    const response = await HomeSetting.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("menuItemId")
      .populate("offerId")
      .populate("codePromoId");

    if (!response) {
      return { error: "Home setting not found" };
    }

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updateHomeSettingService;
