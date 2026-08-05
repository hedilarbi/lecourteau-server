const Reward = require("../../models/Reward");
const MenuItem = require("../../models/MenuItem");

const REWARD_POPULATE = {
  path: "item",
  select: "name image slug prices",
};

const DUPLICATE_MESSAGE =
  "Une récompense existe déjà pour cet article avec cette taille.";

// Vérifie que l'article existe, que la taille lui appartient et qu'aucune
// autre récompense n'utilise déjà ce couple article/taille.
// `excludedRewardId` permet de s'exclure soi-même lors d'une modification.
const validateItemAndSize = async (item, size, excludedRewardId = null) => {
  const menuItem = await MenuItem.findById(item).select("name prices");
  if (!menuItem) {
    return { error: "Article introuvable.", statusCode: 404 };
  }

  const matchedSize = (menuItem.prices || []).find(
    (price) => price.size === size
  );
  if (!matchedSize) {
    return {
      error: "Cette taille n'existe pas pour cet article.",
      statusCode: 400,
    };
  }

  const duplicateQuery = { item, size };
  if (excludedRewardId) {
    duplicateQuery._id = { $ne: excludedRewardId };
  }

  const duplicate = await Reward.findOne(duplicateQuery);
  if (duplicate) {
    return { error: DUPLICATE_MESSAGE, statusCode: 409 };
  }

  return {};
};

module.exports = {
  REWARD_POPULATE,
  DUPLICATE_MESSAGE,
  validateItemAndSize,
};
