const { isValidObjectId } = require("mongoose");
const MenuItem = require("../../models/MenuItem");

const normalizeOptionalObjectId = (value) => {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;
  if (typeof value === "object" && value._id) return value._id;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
  return trimmed;
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

    const normalizedCustomizationGroup =
      normalizeOptionalObjectId(customizationGroup);
    if (typeof normalizedCustomizationGroup !== "undefined") {
      if (
        normalizedCustomizationGroup !== null &&
        !isValidObjectId(normalizedCustomizationGroup)
      ) {
        return { error: "Invalid customization group id" };
      }
      updateData.customization_group = normalizedCustomizationGroup;
    }

    const response = await MenuItem.findByIdAndUpdate(id, updateData, {
      new: true,
    }).populate("customization category");

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updateMenuItemService;
