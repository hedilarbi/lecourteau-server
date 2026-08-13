const mongoose = require("mongoose");
const { isValidObjectId } = mongoose;
const MenuItem = require("../../models/MenuItem");

// Une récompense pointe vers un couple article/taille : si la taille
// disparaît des prix de l'article, la récompense n'a plus de sens.
// `$type: "string"` protège les anciennes récompenses sans taille,
// qui doivent être reprises via scripts/backfillRewardSizes.js.
const deleteRewardsWithRemovedSizes = async (itemId, prices) => {
  const remainingSizes = (prices || [])
    .map((price) => price?.size)
    .filter((size) => typeof size === "string");

  await mongoose.models.Reward.deleteMany({
    item: itemId,
    size: { $type: "string", $nin: remainingSizes },
  });
};

const normalizeCustomizationGroupIds = (value) => {
  if (typeof value === "undefined") return undefined;
  if (value === null || value === "") return [];

  const rawList = Array.isArray(value) ? value : [value];
  const normalized = rawList
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === "object" && entry._id) return String(entry._id).trim();
      if (typeof entry === "string") {
        const trimmed = entry.trim();
        if (
          !trimmed ||
          trimmed === "null" ||
          trimmed === "undefined"
        ) {
          return null;
        }
        return trimmed;
      }
      return String(entry).trim();
    })
    .filter(Boolean);

  return [...new Set(normalized)];
};

const updateMenuItemService = async (
  id,
  name,
  firebaseUrl,
  newPrices,
  description,
  category,
  customization,
  customizationGroup,
) => {
  try {
    const updateData = {
      name,
      prices: newPrices,
      description,
      category,
      customization,
    };

  if (firebaseUrl) {
      updateData.image = firebaseUrl;
    }

    const normalizedCustomizationGroups =
      normalizeCustomizationGroupIds(customizationGroup);
    if (typeof normalizedCustomizationGroups !== "undefined") {
      const hasInvalidCustomizationGroup = normalizedCustomizationGroups.some(
        (groupId) => !isValidObjectId(groupId),
      );
      if (hasInvalidCustomizationGroup) {
        return { error: "Invalid customization group id" };
      }
      updateData.customization_group = normalizedCustomizationGroups;
    }

    const response = await MenuItem.findByIdAndUpdate(id, updateData, {
      new: true,
    })
      .populate("customization category")
      .populate({
        path: "customization_group",
        populate: { path: "toppings" },
      });

    if (response) {
      await deleteRewardsWithRemovedSizes(response._id, response.prices);
    }

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updateMenuItemService;
