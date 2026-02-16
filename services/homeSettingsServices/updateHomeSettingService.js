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
  firebaseUrl,
  menuItemId,
  offerId,
  codePromoId,
  codePromoTitle,
) => {
  try {
    const updateData = {};

    if (typeof title !== "undefined") {
      updateData.title = title;
    }

    if (typeof subTitle !== "undefined") {
      updateData.subTitle = subTitle;
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
      if (normalizedMenuItemId) {
        updateData.offerId = null;
      }
    }

    const normalizedOfferId = normalizeOptionalObjectId(offerId);
    if (typeof normalizedOfferId !== "undefined") {
      if (normalizedOfferId && !isValidObjectId(normalizedOfferId)) {
        return { error: "Invalid offer id" };
      }
      updateData.offerId = normalizedOfferId;
      if (normalizedOfferId) {
        updateData.menuItemId = null;
      }
    }

    const normalizedCodePromoId = normalizeOptionalObjectId(codePromoId);
    if (typeof normalizedCodePromoId !== "undefined") {
      if (normalizedCodePromoId && !isValidObjectId(normalizedCodePromoId)) {
        return { error: "Invalid promo code id" };
      }
      updateData.codePromoId = normalizedCodePromoId;
    }

    if (typeof codePromoTitle !== "undefined") {
      updateData.codePromoTitle =
        typeof codePromoTitle === "string" ? codePromoTitle.trim() : "";
    }

    if (
      normalizedMenuItemId &&
      typeof normalizedOfferId !== "undefined" &&
      normalizedOfferId
    ) {
      return { error: "Select either a menu item or an offer" };
    }

    if (
      normalizedCodePromoId &&
      typeof updateData.codePromoTitle !== "undefined" &&
      !updateData.codePromoTitle
    ) {
      return { error: "Promo code title is required when promo code is selected" };
    }

    const response = await HomeSetting.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("menuItemId")
      .populate("offerId")
      .populate({
        path: "codePromoId",
        populate: {
          path: "freeItem",
          select: "name",
        },
      });

    if (!response) {
      return { error: "Home setting not found" };
    }

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updateHomeSettingService;
