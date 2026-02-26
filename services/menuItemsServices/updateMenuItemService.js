const { isValidObjectId } = require("mongoose");
const MenuItem = require("../../models/MenuItem");

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

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updateMenuItemService;
