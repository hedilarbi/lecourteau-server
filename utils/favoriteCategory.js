// Catégorie remisée par une offre Smart Offers V2 « catégorie favorite » (useFavoriteCategory).
// Les catégories ci-dessous ne sont jamais retenues : leurs articles sont déjà des promotions
// (poutine à 5 $, hot-dog à 1 $…). Un client qui y achète le plus se voit remiser la catégorie
// qui vient ensuite ; s'il n'achète que ça, l'offre ne lui est pas proposée.
// Le critère de règle « catégorie favorite » n'utilise PAS cette exclusion : il garde la vraie
// favorite, pour pouvoir viser les clients dont c'est PROMOS.
const EXCLUDED_FAVORITE_CATEGORY_NAMES = ["promos", "promo", "promotions"];

const normalizeCategoryName = (name) =>
  String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const isExcludedFavoriteCategoryName = (name) =>
  EXCLUDED_FAVORITE_CATEGORY_NAMES.includes(normalizeCategoryName(name));

/** Identifiants (chaînes) des catégories exclues, à partir de la liste des catégories. */
const getExcludedFavoriteCategoryIds = (categories = []) =>
  new Set(
    (categories || [])
      .filter((category) => isExcludedFavoriteCategoryName(category?.name))
      .map((category) => String(category._id)),
  );

/**
 * Catégorie la plus achetée hors catégories exclues, ou null.
 * `counts` : Map ou objet { categoryId: nombre d'articles }. À égalité, la première rencontrée gagne.
 */
const pickFavoriteCategoryId = (counts, excludedIds = new Set()) => {
  const entries = counts instanceof Map ? [...counts.entries()] : Object.entries(counts || {});
  let favoriteId = null;
  let favoriteCount = 0;
  for (const [categoryId, count] of entries) {
    if (excludedIds.has(String(categoryId))) continue;
    if (count > favoriteCount) {
      favoriteCount = count;
      favoriteId = String(categoryId);
    }
  }
  return favoriteId;
};

module.exports = {
  EXCLUDED_FAVORITE_CATEGORY_NAMES,
  isExcludedFavoriteCategoryName,
  getExcludedFavoriteCategoryIds,
  pickFavoriteCategoryId,
};
