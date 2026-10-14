// Offres (combos) à choix : l'admin fixe `itemsToChoose` = nombre d'articles que le client
// choisit parmi les articles de l'offre (prix de l'offre inchangé). Règles :
//   - vide / 0 → null : tous les articles sont inclus (fonctionnement historique) ;
//   - sinon un entier entre 1 et (nombre d'articles - 1) : « choisir 4 parmi 4 » = tout inclus ;
//   - le client choisit des articles DIFFÉRENTS ; un article à quantité > 1 (Frites ×2) compte
//     pour un seul choix et donne toute sa quantité.

const parseItemsToChoose = (rawValue, itemCount) => {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "" || String(rawValue) === "null") {
    return { value: null };
  }
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 0) {
    return { error: "Le nombre d'articles à choisir doit être un nombre entier." };
  }
  if (value === 0) return { value: null };
  if (value >= itemCount) {
    return {
      error: `Le nombre d'articles à choisir doit être inférieur au nombre d'articles de l'offre (${itemCount}). Laissez le champ vide pour inclure tous les articles.`,
    };
  }
  return { value };
};

const normalizeId = (value) => String(value?._id || value || "").trim();

/**
 * Vérifie, pour chaque offre du panier configurée avec `itemsToChoose`, que le client a choisi
 * exactement ce nombre d'articles différents, tous issus de l'offre, sans dépasser leur quantité.
 * Les offres sans `itemsToChoose` ne sont pas concernées (comportement inchangé).
 * @returns {string|null} message d'erreur, ou null si tout est valide
 */
const validateOrderOfferChoices = async (orderOffers = [], OfferModel) => {
  const offerIds = [...new Set(orderOffers.map((entry) => normalizeId(entry?.offer)).filter(Boolean))];
  if (!offerIds.length) return null;

  const offers = await OfferModel.find({ _id: { $in: offerIds }, itemsToChoose: { $gt: 0 } })
    .select("name items itemsToChoose")
    .lean();
  if (!offers.length) return null;
  const offersById = new Map(offers.map((offer) => [String(offer._id), offer]));

  for (const entry of orderOffers) {
    const offer = offersById.get(normalizeId(entry?.offer));
    if (!offer) continue;

    const allowedQuantity = new Map();
    (offer.items || []).forEach((line) => {
      const id = normalizeId(line.item);
      allowedQuantity.set(id, (allowedQuantity.get(id) || 0) + Math.max(1, Number(line.quantity) || 1));
    });

    const chosenCount = new Map();
    for (const line of entry?.items || []) {
      const id = normalizeId(line?.item);
      if (!allowedQuantity.has(id)) {
        return `L'offre « ${offer.name} » contient un article qui n'en fait pas partie.`;
      }
      chosenCount.set(id, (chosenCount.get(id) || 0) + 1);
    }

    for (const [id, count] of chosenCount) {
      if (count > allowedQuantity.get(id)) {
        return `L'offre « ${offer.name} » contient trop d'exemplaires d'un même article.`;
      }
    }

    if (chosenCount.size !== offer.itemsToChoose) {
      return `Choisissez ${offer.itemsToChoose} article${offer.itemsToChoose > 1 ? "s" : ""} différent${offer.itemsToChoose > 1 ? "s" : ""} pour l'offre « ${offer.name} ».`;
    }
  }
  return null;
};

module.exports = { parseItemsToChoose, validateOrderOfferChoices };
