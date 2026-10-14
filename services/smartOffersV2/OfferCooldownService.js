// Délai entre deux offres personnalisées (user.smartOfferCooldownEndsAt) :
//   1. à l'attribution d'une offre  → date d'expiration de l'offre (23:59 Toronto) + cooldown de l'offre ;
//   2. à la confirmation d'une commande qui UTILISE l'offre ou l'IGNORE
//      → date de confirmation + cooldown de cette offre (remplace le délai précédent).
// Le cooldown d'une offre est celui de sa configuration dans la règle (offerConfig.cooldownDays).
const DynamicRule = require("../../models/DynamicRule");
const PersonalizedOffer = require("../../models/PersonalizedOffer");
const User = require("../../models/User");
const { calculateSmartOfferValidUntil } = require("../../utils/smartOfferNotificationBody");

const DEFAULT_COOLDOWN_DAYS = 7; // défaut du schéma DynamicRule.offers[].cooldownDays
const DEFAULT_VALIDITY_HOURS = 48; // défaut du schéma DynamicRule.offers[].validityHours
const DAY_MS = 86400000;

/** Cooldown configuré (0 accepté = aucun délai) ; défaut du schéma sinon. */
const resolveCooldownDays = (offerConfig) => {
  const days = Number(offerConfig?.cooldownDays);
  return Number.isFinite(days) && days >= 0 ? days : DEFAULT_COOLDOWN_DAYS;
};

/** Règle 1 : fin de validité réelle de l'offre (23:59 Toronto) + cooldown. */
const computeAssignmentCooldownEnd = (scheduledNotifyAt, validityHours, cooldownDays) => {
  const hours = Number(validityHours) > 0 ? Number(validityHours) : DEFAULT_VALIDITY_HOURS;
  const expiry =
    calculateSmartOfferValidUntil(scheduledNotifyAt, hours) ||
    new Date(new Date(scheduledNotifyAt).getTime() + hours * 3600000);
  return new Date(expiry.getTime() + cooldownDays * DAY_MS);
};

const findOfferConfig = (rule, offer) =>
  (rule?.offers || []).find((config) => String(config._id) === String(offer.offerConfigId)) || null;

/**
 * Règle 2 : à appeler à la confirmation d'une commande, APRÈS la mise à jour des statuts
 * (applied / ignored). Renvoie la nouvelle fin de cooldown, ou null si la commande ne
 * concerne aucune offre (le délai en cours reste inchangé).
 */
const recalculateCooldownAfterOrder = async (order, confirmedAt = new Date()) => {
  const userId = order?.user?._id || order?.user;
  if (!userId) return null;

  const concernedOffers = [];

  // Offre utilisée par la commande. Un rabais divisé encore en cours (étapes restantes) n'est
  // pas terminé : son cooldown partira de la commande qui consommera la dernière étape.
  if (order.personalizedOffer && order.personalizedOfferApplied) {
    const used = await PersonalizedOffer.findById(order.personalizedOffer)
      .select("status dynamicRule offerConfigId")
      .lean();
    if (used?.status === "applied") concernedOffers.push(used);
  }

  // Offres ignorées par CETTE commande : passées à "ignored" à sa création
  // (createOrderService) ou à sa confirmation (R15 de confirmOrderService).
  const orderCreatedAt = new Date(order.createdAt || confirmedAt);
  const ignored = await PersonalizedOffer.find({
    user: userId,
    status: "ignored",
    _id: { $ne: order.personalizedOffer || null },
    updatedAt: { $gte: new Date(orderCreatedAt.getTime() - 60000) },
  })
    .select("status dynamicRule offerConfigId")
    .lean();
  concernedOffers.push(...ignored);

  if (!concernedOffers.length) return null;

  const ruleIds = [...new Set(concernedOffers.map((offer) => String(offer.dynamicRule || "")).filter(Boolean))];
  const rules = ruleIds.length
    ? await DynamicRule.find({ _id: { $in: ruleIds } }).select("offers._id offers.cooldownDays").lean()
    : [];
  const rulesById = new Map(rules.map((rule) => [String(rule._id), rule]));

  // Plusieurs offres concernées (utilisée + ignorées) : le délai le plus long l'emporte.
  const cooldownDays = Math.max(
    ...concernedOffers.map((offer) =>
      resolveCooldownDays(findOfferConfig(rulesById.get(String(offer.dynamicRule)), offer)),
    ),
  );
  const cooldownEndsAt = new Date(confirmedAt.getTime() + cooldownDays * DAY_MS);
  await User.updateOne({ _id: userId }, { $set: { smartOfferCooldownEndsAt: cooldownEndsAt } });
  return cooldownEndsAt;
};

module.exports = {
  DEFAULT_COOLDOWN_DAYS,
  resolveCooldownDays,
  computeAssignmentCooldownEnd,
  recalculateCooldownAfterOrder,
};
