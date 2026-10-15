// Variables des textes de notification Smart Offers V2, remplacées à la création de l'offre :
//   {name} / {{name}}  nom du client (« cher client » s'il n'en a pas)
//   {category}         catégorie visée (ou catégorie favorite)
//   {item}             article de l'offre (produit remisé, article offert, cadeau du 1 acheté = 1 offert)
//   {discount}         valeur du rabais, selon le type (« 20 % », « 5 $ ») ; cashback : le % de la récompense
//   {points}           points bonus
//   {threshold}        minimum d'achat, selon le type (cashback, cadeau mystère, 1er palier…)
// Une variable sans valeur pour l'offre est retirée du texte, jamais laissée telle quelle.

const formatNumber = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(".", ",");
};

const positive = (value) => (Number(value) > 0 ? Number(value) : null);

const getItemName = (offer, menuItemsById) => {
  const nameOf = (id) => (id ? String(menuItemsById.get(String(id?._id || id)) || "").trim() : "");
  switch (offer.offerType) {
    case "discount_product":
      return nameOf(offer.targetMenuItem);
    case "free_item":
      return nameOf(offer.freeItems?.[0]?.item) || nameOf(offer.freeItem);
    case "buy_one_get_one":
      return nameOf(offer.freeItem) || nameOf(offer.triggerItem);
    case "mystery_gift":
      return "un cadeau surprise"; // le cadeau reste une surprise
    default:
      return "";
  }
};

const getDiscountText = (offer) => {
  const percent = (value) => (positive(value) ? `${formatNumber(value)} %` : "");
  switch (offer.offerType) {
    case "bonus_basket":
      return positive(offer.discountValue) ? `${formatNumber(offer.discountValue)} $` : "";
    case "deferred_cashback":
      return percent(offer.deferredDiscountValue);
    case "split_discount":
      return percent(offer.discountSteps?.[0]);
    case "tiered_discount":
      return percent(Math.max(0, ...(offer.tieredDiscounts || []).map((tier) => Number(tier?.discountValue) || 0)));
    case "discount_order":
    case "discount_category":
    case "discount_product":
      return percent(offer.discountValue);
    default:
      return "";
  }
};

const getThreshold = (offer) => {
  switch (offer.offerType) {
    case "deferred_cashback":
      return positive(offer.deferredThreshold) || positive(offer.bonusThreshold) || 0;
    case "mystery_gift":
      return positive(offer.mysteryThreshold) || positive(offer.bonusThreshold) || 0;
    case "tiered_discount": {
      const thresholds = (offer.tieredDiscounts || []).map((tier) => Number(tier?.threshold)).filter((t) => t > 0);
      return thresholds.length ? Math.min(...thresholds) : 0;
    }
    default:
      return positive(offer.bonusThreshold) || 0;
  }
};

/** Valeurs des variables pour une configuration d'offre. */
const getOfferTextValues = (offer, { categoryName = "", menuItemsById = new Map() } = {}) => ({
  category: String(categoryName || "").trim(),
  item: getItemName(offer, menuItemsById),
  discount: getDiscountText(offer),
  points: positive(offer.bonusPoints) ? formatNumber(offer.bonusPoints) : "",
  threshold: formatNumber(getThreshold(offer)),
});

/** Remplace les variables dans un titre ou un texte de notification. */
const personalizeOfferText = (text, user, values = {}) => {
  if (!text) return "";
  const name = String(user?.name || "").trim() || "cher client";
  return String(text)
    .replace(/\{\{name\}\}|\{name\}/g, name)
    .replace(/\{(category|item|discount|points|threshold)\}/g, (_, key) => values[key] || "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
};

module.exports = { getOfferTextValues, personalizeOfferText };
