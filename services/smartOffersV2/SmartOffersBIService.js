// BI & ROI des smart offers V2, calculé sur les VRAIES données (offres, événements, commandes).
//
// Cohorte : les offres ENVOYÉES pendant la période (date d'activation). Leurs commandes sont
// rattachées à l'offre quelle que soit leur date (une offre envoyée le 30 peut être utilisée le 1er).
//
// - CA généré     : sous-total après rabais (avant taxes) des commandes confirmées, non annulées,
//                   qui ont utilisé l'offre. C'est le CA DES commandes avec offre, pas un CA
//                   supplémentaire (sans groupe témoin, impossible de savoir qui aurait commandé).
// - Coût          : rabais réellement appliqué + valeur des articles offerts + livraison offerte
//                   + points bonus (10 points = 1 $). La part Hedi n'est pas comptée.
// - Cashback      : la récompense (commande suivante) est rattachée à l'offre cashback d'origine.
// - Panier        : comparé aux MÊMES clients (ceux qui ont utilisé l'offre) sur leurs commandes
//                   SANS offre. « Commandé » = sous-total avant rabais (le client a-t-il commandé
//                   plus ?), « payé » = après rabais. Comparer au panier de tous les destinataires,
//                   ou après rabais seulement, faussait l'écart.
// - Verdict       : « Trop tôt pour juger » tant que l'offre n'a pas VERDICT.minDays jours ET
//                   VERDICT.minResolved offres terminées (utilisées, ignorées ou expirées).
const mongoose = require("mongoose");
const PersonalizedOffer = require("../../models/PersonalizedOffer");
const PersonalizedOfferEvent = require("../../models/PersonalizedOfferEvent");
const Order = require("../../models/Order");
const DynamicRule = require("../../models/DynamicRule");
const Campaign = require("../../models/Campaign");
const MenuItem = require("../../models/MenuItem");
const { CANCELED } = require("../../utils/constants");

const POINTS_PER_DOLLAR = 10;
const DELETED_RULES_KEY = "deleted";
const TIMEZONE = "America/Toronto";
const DAY_MS = 86400000;
// Types dont l'avantage n'est PAS une remise sur le sous-total : l'écart sous-total / après
// rabais vient alors d'une autre remise (abonnement, 1re commande) et n'est pas imputé à l'offre.
const NO_SUBTOTAL_DISCOUNT_TYPES = ["deferred_cashback", "free_delivery", "loyalty_points", "free_item", "buy_one_get_one", "mystery_gift"];

// Verdict d'une offre / règle (seuils par défaut, réglables plus tard).
const VERDICT = { goodRoi: 3, goodRate: 15, badRoi: 1.5, badRate: 5, minDays: 7, minResolved: 20 };

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const pct = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);
const toNumber = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

const OFFER_TYPE_LABELS = {
  discount_order: "Rabais sur la commande",
  discount_category: "Rabais sur une catégorie",
  discount_product: "Rabais sur un produit",
  bonus_basket: "Rabais fixe sur le panier",
  split_discount: "Rabais divisé",
  tiered_discount: "Rabais par paliers",
  free_item: "Article offert",
  buy_one_get_one: "1 acheté = 1 offert",
  mystery_gift: "Cadeau mystère",
  free_delivery: "Livraison offerte",
  loyalty_points: "Points bonus",
  deferred_cashback: "Cashback",
};
const METHOD_LABELS = {
  weighted_random: "Aléatoire pondéré",
  multi_armed_bandit: "Bandit (auto-optimisé)",
  scenario_journey: "Scénario",
  priority: "Priorité",
  waterfall: "Cascade",
  success_sequence: "Suite après succès",
  fatigue_control: "Anti-lassitude",
  engagement_split: "Selon l'engagement",
};

const fmtNum = (v) => String(Math.round((Number(v) || 0) * 100) / 100).replace(".", ",");
const fromThreshold = (v) => (Number(v) > 0 ? ` dès ${fmtNum(v)} $` : "");

/** Ce que donne une offre, en clair : « Rabais 25 % sur la commande dès 15 $ ». */
const describeOfferConfig = (c, itemNameById) => {
  const item = (id) => itemNameById.get(String(id?._id || id)) || "";
  switch (c.offerType) {
    case "discount_order": return `Rabais ${fmtNum(c.discountValue)} % sur la commande${fromThreshold(c.bonusThreshold)}`;
    case "discount_category": return `Rabais ${fmtNum(c.discountValue)} % sur ${c.useFavoriteCategory ? "sa catégorie favorite" : "une catégorie"}${fromThreshold(c.bonusThreshold)}`;
    case "discount_product": return `Rabais ${fmtNum(c.discountValue)} % sur ${item(c.targetMenuItem) || "un produit"}${fromThreshold(c.bonusThreshold)}`;
    case "bonus_basket": return `Rabais de ${fmtNum(c.discountValue)} $${fromThreshold(c.bonusThreshold)}`;
    case "free_item": {
      const gifts = (c.freeItems || []).map((f) => item(f?.item)).filter(Boolean);
      const label = gifts.length > 1 ? "Article au choix" : gifts[0] || item(c.freeItem) || "Article";
      return `${label} offert${fromThreshold(c.bonusThreshold)}`;
    }
    case "buy_one_get_one": return `1 acheté = 1 offert${item(c.freeItem) ? ` (${item(c.freeItem)})` : ""}`;
    case "mystery_gift": return `Cadeau mystère${fromThreshold(c.mysteryThreshold)}`;
    case "loyalty_points": return `${fmtNum(c.bonusPoints)} points bonus${fromThreshold(c.bonusThreshold)}`;
    case "deferred_cashback": return `Cashback −${fmtNum(c.deferredDiscountValue)} % sur la commande suivante${fromThreshold(c.deferredThreshold)}`;
    case "split_discount": return `Rabais en ${(c.discountSteps || []).length || "plusieurs"} commandes (${(c.discountSteps || []).map(fmtNum).join(" / ")} %)`;
    case "tiered_discount": return "Rabais par paliers";
    case "free_delivery": return "Livraison offerte";
    default: return OFFER_TYPE_LABELS[c.offerType] || c.offerType;
  }
};

/** Nom d'une offre dans sa règle : position (étape, version) + ce qu'elle donne. */
const getOfferConfigLabel = (rule, config, offerType, itemNameById) => {
  if (!config) return `${OFFER_TYPE_LABELS[offerType] || offerType} (retirée de la règle)`;
  const index = (rule.offers || []).findIndex((c) => String(c._id) === String(config._id));
  const count = (rule.offers || []).length;
  const what = describeOfferConfig(config, itemNameById);
  if (rule.distributionMethod === "scenario_journey") return `Étape ${index + 1}${config.isRoot ? " (départ)" : ""} · ${what}`;
  if (["multi_armed_bandit", "weighted_random"].includes(rule.distributionMethod)) return `Version ${index + 1} · ${what}`;
  return count > 1 ? `Offre ${index + 1} · ${what}` : what;
};

const sentDateOf = (offer) => offer.initialNotificationSentAt || offer.validFrom || offer.scheduledNotifyAt || offer.createdAt;
// En attente, ou remplacée avant son activation : jamais envoyée.
const isSent = (offer) => !["prepared", "replaced"].includes(offer.status);

const dayKey = (date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date));
const hourOf = (date) =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, hour: "numeric", hourCycle: "h23" }).format(new Date(date)));

const getVerdict = ({ sent, used, roi, cost, ageDays, resolved }) => {
  if (ageDays < VERDICT.minDays || resolved < VERDICT.minResolved) {
    const days = Math.max(0, Math.floor(ageDays));
    return {
      level: "pending",
      label: "Trop tôt pour juger",
      reason: `Envoyée depuis ${days} jour${days > 1 ? "s" : ""}, ${resolved} offre${resolved > 1 ? "s" : ""} terminée${resolved > 1 ? "s" : ""} (il faut ${VERDICT.minDays} jours et ${VERDICT.minResolved} offres terminées).`,
    };
  }
  const rate = pct(used, sent);
  if (used === 0) return { level: "bad", label: "À revoir", reason: "Aucune offre utilisée." };
  if (cost > 0 && roi < 1) return { level: "bad", label: "À revoir", reason: "Elle coûte plus qu'elle ne rapporte." };
  if (rate < VERDICT.badRate) return { level: "bad", label: "À revoir", reason: "Très peu utilisée." };
  if (cost > 0 && roi < VERDICT.badRoi) return { level: "bad", label: "À revoir", reason: "Rapporte peu pour ce qu'elle coûte." };
  if ((cost === 0 || roi >= VERDICT.goodRoi) && rate >= VERDICT.goodRate) return { level: "good", label: "Rentable", reason: "Bien utilisée et rentable." };
  return {
    level: "watch",
    label: "À surveiller",
    reason: rate < VERDICT.goodRate ? "Utilisation moyenne." : "Rentabilité moyenne.",
  };
};

/** Coût et CA d'une commande pour l'offre qu'elle a utilisée. */
const getOrderEconomics = (order, offerType, restaurantDeliveryFee) => {
  const subtotal = toNumber(order.sub_total);
  const afterDiscount = toNumber(order.sub_total_after_discount, subtotal);
  const revenue = Math.max(0, afterDiscount);
  let discountCost = 0;
  let giftCost = 0;
  let deliveryCost = 0;
  let pointsCost = 0;

  if (!NO_SUBTOTAL_DISCOUNT_TYPES.includes(offerType)) {
    discountCost = Math.max(0, subtotal - afterDiscount);
  }
  (order.orderItems || []).forEach((line) => {
    if (line?.isSmartOfferFreeItem) {
      // Le client ne paie que les suppléments : la valeur offerte est le prix de base de l'article.
      giftCost += toNumber(line.basePrice);
    }
  });
  if (offerType === "free_delivery" && ["delivery", "devliery"].includes(String(order.type || "").toLowerCase())) {
    deliveryCost = Math.max(0, toNumber(restaurantDeliveryFee) - toNumber(order.delivery_fee));
  }
  if (offerType === "loyalty_points") {
    pointsCost = toNumber(order.smartOfferBonusPoints) / POINTS_PER_DOLLAR;
  }
  return {
    revenue: round2(revenue),
    ordered: round2(Math.max(0, subtotal)),
    discountCost: round2(discountCost),
    giftCost: round2(giftCost),
    deliveryCost: round2(deliveryCost),
    pointsCost: round2(pointsCost),
    cost: round2(discountCost + giftCost + deliveryCost + pointsCost),
  };
};

const emptyBucket = () => ({
  sent: 0, viewed: 0, clicked: 0, used: 0, ignored: 0, expired: 0,
  orders: 0, revenue: 0, ordered: 0, cost: 0, discountCost: 0, giftCost: 0, deliveryCost: 0, pointsCost: 0,
  delaysHours: [], buyers: new Set(), firstSentAt: null,
});

const addOfferToBucket = (bucket, offerStats) => {
  bucket.sent += 1;
  if (offerStats.viewed) bucket.viewed += 1;
  if (offerStats.clicked) bucket.clicked += 1;
  if (offerStats.used) bucket.used += 1;
  if (offerStats.status === "ignored") bucket.ignored += 1;
  if (offerStats.status === "expired") bucket.expired += 1;
  if (!bucket.firstSentAt || offerStats.sentAt < bucket.firstSentAt) bucket.firstSentAt = offerStats.sentAt;
};

const addOrderToBucket = (bucket, economics, delayHours, userId) => {
  bucket.orders += 1;
  bucket.buyers.add(userId);
  ["revenue", "ordered", "cost", "discountCost", "giftCost", "deliveryCost", "pointsCost"].forEach((k) => {
    bucket[k] = round2(bucket[k] + economics[k]);
  });
  if (Number.isFinite(delayHours) && delayHours >= 0) bucket.delaysHours.push(delayHours);
};

const finalizeBucket = (bucket, usualBasketByUser, now = new Date()) => {
  const roi = bucket.cost > 0 ? round2(bucket.revenue / bucket.cost) : null;
  const avgBasket = bucket.orders > 0 ? round2(bucket.revenue / bucket.orders) : 0;
  const avgOrdered = bucket.orders > 0 ? round2(bucket.ordered / bucket.orders) : 0;
  // Habitude des clients qui ont utilisé l'offre, pas de tous ceux qui l'ont reçue.
  const usualBaskets = [...bucket.buyers].map((u) => usualBasketByUser.get(u)).filter((v) => Number.isFinite(v) && v > 0);
  const usualBasket = usualBaskets.length ? round2(usualBaskets.reduce((a, b) => a + b, 0) / usualBaskets.length) : null;
  const delays = bucket.delaysHours.sort((a, b) => a - b);
  const medianDelayHours = delays.length ? round2(delays[Math.floor(delays.length / 2)]) : null;
  const out = {
    sent: bucket.sent,
    viewed: bucket.viewed,
    clicked: bucket.clicked,
    used: bucket.used,
    ignored: bucket.ignored,
    expired: bucket.expired,
    orders: bucket.orders,
    viewRate: pct(bucket.viewed, bucket.sent),
    clickRate: pct(bucket.clicked, bucket.sent),
    useRate: pct(bucket.used, bucket.sent),
    revenue: bucket.revenue,
    cost: bucket.cost,
    costBreakdown: {
      discount: bucket.discountCost,
      gifts: bucket.giftCost,
      delivery: bucket.deliveryCost,
      points: bucket.pointsCost,
    },
    roi,
    avgBasket,
    avgOrdered,
    usualBasket,
    orderedLift: usualBasket && avgOrdered ? pct(avgOrdered - usualBasket, usualBasket) : null,
    paidLift: usualBasket && avgBasket ? pct(avgBasket - usualBasket, usualBasket) : null,
    medianDelayHours,
    ageDays: bucket.firstSentAt ? round2((now - bucket.firstSentAt) / DAY_MS) : 0,
    resolved: bucket.used + bucket.ignored + bucket.expired,
  };
  out.verdict = getVerdict({ sent: out.sent, used: out.used, roi: roi ?? Infinity, cost: out.cost, ageDays: out.ageDays, resolved: out.resolved });
  return out;
};

/**
 * @param {object} p
 * @param {Date} p.from début de période (inclus)
 * @param {Date} p.to fin de période (exclue)
 * @param {string} [p.campaignId]
 * @param {boolean} [p.includeTests] inclure les campagnes de test (nom contenant « TEST »)
 * @param {boolean} [p.withDetails] séries, détail par règle/offre, comparaisons (sinon KPI seuls)
 */
const computeBI = async ({ from, to, campaignId = null, includeTests = false, withDetails = true }) => {
  const campaigns = await Campaign.find({}).select("name").lean();
  const testCampaignIds = new Set(campaigns.filter((c) => /test/i.test(c.name || "")).map((c) => String(c._id)));
  const campaignNameById = new Map(campaigns.map((c) => [String(c._id), c.name]));

  // Offres V2 « source » (hors récompenses de cashback, rattachées à leur offre d'origine).
  const offerFilter = { dynamicRule: { $ne: null }, isDeferredReward: { $ne: true } };
  if (campaignId) offerFilter.campaign = new mongoose.Types.ObjectId(String(campaignId));
  const candidateOffers = await PersonalizedOffer.find(offerFilter)
    .select("user status offerType dynamicRule campaign offerConfigId notifClicked currentStep initialNotificationSentAt validFrom scheduledNotifyAt createdAt")
    .lean();
  const offers = candidateOffers.filter((o) => {
    if (!isSent(o)) return false;
    if (!includeTests && testCampaignIds.has(String(o.campaign))) return false;
    const sentAt = new Date(sentDateOf(o));
    return sentAt >= from && sentAt < to;
  });
  const offerIds = offers.map((o) => o._id);

  // Récompenses de cashback rattachées aux offres de la cohorte.
  const rewards = offerIds.length
    ? await PersonalizedOffer.find({ deferredSourceOffer: { $in: offerIds } }).select("_id deferredSourceOffer status").lean()
    : [];
  const sourceByReward = new Map(rewards.map((r) => [String(r._id), String(r.deferredSourceOffer)]));

  // Événements (vue, clic) : une offre vue puis utilisée compte bien comme vue.
  const events = offerIds.length
    ? await PersonalizedOfferEvent.aggregate([
        { $match: { personalizedOffer: { $in: offerIds }, eventType: { $in: ["viewed", "clicked", "notif_clicked"] } } },
        { $group: { _id: { offer: "$personalizedOffer", type: "$eventType" } } },
      ])
    : [];
  const eventsByOffer = new Map();
  events.forEach(({ _id }) => {
    const key = String(_id.offer);
    if (!eventsByOffer.has(key)) eventsByOffer.set(key, new Set());
    eventsByOffer.get(key).add(_id.type);
  });

  // Commandes ayant utilisé une offre de la cohorte (ou sa récompense de cashback).
  const orderOfferIds = [...offerIds, ...rewards.map((r) => r._id)];
  const orders = orderOfferIds.length
    ? await Order.find({
        personalizedOffer: { $in: orderOfferIds },
        personalizedOfferApplied: true,
        confirmed: true,
        status: { $ne: CANCELED },
      })
        .select("code user personalizedOffer sub_total sub_total_after_discount total_price delivery_fee type orderItems.isSmartOfferFreeItem orderItems.basePrice orderItems.price smartOfferBonusPoints createdAt restaurant")
        .populate("restaurant", "settings.delivery_fee name")
        .populate("user", "name")
        .lean()
    : [];

  // Panier habituel : commandes SANS offre des clients qui ont utilisé une offre, avant rabais.
  const buyerIds = [...new Set(orders.map((o) => String(o.user?._id || o.user)))].map((id) => new mongoose.Types.ObjectId(id));
  const usualAgg = buyerIds.length
    ? await Order.aggregate([
        { $match: { user: { $in: buyerIds }, confirmed: true, status: { $ne: CANCELED }, personalizedOfferApplied: { $ne: true } } },
        { $group: { _id: "$user", avg: { $avg: "$sub_total" } } },
      ])
    : [];
  const usualBasketByUser = new Map(usualAgg.map((u) => [String(u._id), round2(u.avg)]));

  // Règles (noms, configurations d'offres, méthode).
  const ruleIds = [...new Set(offers.map((o) => String(o.dynamicRule)))];
  const rules = ruleIds.length ? await DynamicRule.find({ _id: { $in: ruleIds } }).select("name distributionMethod campaign offers").lean() : [];
  const ruleById = new Map(rules.map((r) => [String(r._id), r]));
  const itemIds = new Set();
  rules.forEach((r) => (r.offers || []).forEach((c) => {
    [c.targetMenuItem, c.freeItem, ...(c.freeItems || []).map((f) => f?.item)].forEach((id) => id && itemIds.add(String(id)));
  }));
  const itemNameById = itemIds.size
    ? new Map((await MenuItem.find({ _id: { $in: [...itemIds] } }).select("name").lean()).map((i) => [String(i._id), String(i.name || "").trim()]))
    : new Map();

  const offerById = new Map(offers.map((o) => [String(o._id), o]));
  const ordersByOffer = new Map();
  orders.forEach((order) => {
    const usedId = String(order.personalizedOffer);
    const sourceId = sourceByReward.get(usedId) || usedId;
    if (!offerById.has(sourceId)) return;
    if (!ordersByOffer.has(sourceId)) ordersByOffer.set(sourceId, []);
    ordersByOffer.get(sourceId).push({ order, isReward: sourceByReward.has(usedId) });
  });

  const global = emptyBucket();
  const byRule = new Map();
  const byConfig = new Map();
  const byType = new Map();
  const byMethod = new Map();
  const sentPerDay = new Map();
  const usedPerDay = new Map();
  const hours = Array(24).fill(0);
  const recentOrdersByConfig = new Map();

  const bucketFor = (map, key, init) => {
    if (!map.has(key)) map.set(key, { ...init, bucket: emptyBucket() });
    return map.get(key).bucket;
  };

  offers.forEach((offer) => {
    const id = String(offer._id);
    const evts = eventsByOffer.get(id) || new Set();
    const offerOrders = ordersByOffer.get(id) || [];
    // « Utilisée » = au moins une commande confirmée, non annulée, qui l'a utilisée : le taux
    // d'utilisation et le CA reposent ainsi sur les mêmes commandes.
    const used = offerOrders.length > 0;
    const offerStats = {
      status: offer.status,
      sentAt: new Date(sentDateOf(offer)),
      userId: String(offer.user),
      viewed: evts.has("viewed") || ["viewed", "clicked", "applied"].includes(offer.status) || used,
      clicked: evts.has("clicked") || evts.has("notif_clicked") || offer.notifClicked || ["clicked", "applied"].includes(offer.status),
      used,
    };
    const rule = ruleById.get(String(offer.dynamicRule));
    const config = rule?.offers?.find((c) => String(c._id) === String(offer.offerConfigId));
    // Règle supprimée depuis l'envoi : toutes ces offres sont regroupées sur une seule ligne
    // « historique », détaillée par type d'offre (le nom de la règle n'existe plus).
    const ruleKey = rule ? String(offer.dynamicRule) : DELETED_RULES_KEY;
    const configKey = rule ? `${ruleKey}:${String(offer.offerConfigId)}` : `${DELETED_RULES_KEY}:${offer.offerType}`;
    const method = rule?.distributionMethod || "deleted";

    const buckets = [
      global,
      bucketFor(byRule, ruleKey, {
        id: ruleKey,
        name: rule?.name || "Règles supprimées (historique)",
        method,
        isDeleted: !rule,
        campaign: rule ? campaignNameById.get(String(offer.campaign)) || "" : "Règles qui n'existent plus",
      }),
      bucketFor(byConfig, configKey, {
        id: configKey,
        ruleId: ruleKey,
        offerType: offer.offerType,
        // Ordre de l'offre dans la règle (étape 1, 2…) ; offres retirées de la règle en dernier.
        position: rule && config ? rule.offers.findIndex((c) => String(c._id) === String(config._id)) : 999,
        name: rule ? getOfferConfigLabel(rule, config, offer.offerType, itemNameById) : OFFER_TYPE_LABELS[offer.offerType] || offer.offerType,
      }),
      bucketFor(byType, offer.offerType, { id: offer.offerType, name: OFFER_TYPE_LABELS[offer.offerType] || offer.offerType }),
      ...(rule ? [bucketFor(byMethod, method, { id: method, name: METHOD_LABELS[method] || method })] : []),
    ];
    buckets.forEach((b) => addOfferToBucket(b, offerStats));
    const sentDay = dayKey(sentDateOf(offer));
    sentPerDay.set(sentDay, (sentPerDay.get(sentDay) || 0) + 1);

    offerOrders.forEach(({ order, isReward }) => {
      const economics = getOrderEconomics(order, isReward ? "discount_order" : offer.offerType, order.restaurant?.settings?.delivery_fee);
      const delayHours = (new Date(order.createdAt) - new Date(sentDateOf(offer))) / 3600000;
      buckets.forEach((b) => addOrderToBucket(b, economics, isReward ? NaN : delayHours, String(order.user?._id || order.user)));
      const usedDay = dayKey(order.createdAt);
      usedPerDay.set(usedDay, (usedPerDay.get(usedDay) || 0) + 1);
      hours[hourOf(order.createdAt)] += 1;
      if (!recentOrdersByConfig.has(configKey)) recentOrdersByConfig.set(configKey, []);
      recentOrdersByConfig.get(configKey).push({
        code: order.code,
        date: order.createdAt,
        customer: order.user?.name || "",
        revenue: economics.revenue,
        cost: economics.cost,
        isCashbackReward: isReward,
      });
    });
  });

  const now = new Date();
  const kpis = finalizeBucket(global, usualBasketByUser, now);
  if (!withDetails) return { kpis };

  const finalizeMap = (map) =>
    [...map.values()].map(({ bucket, ...meta }) => ({ ...meta, ...finalizeBucket(bucket, usualBasketByUser, now) }));

  const configs = finalizeMap(byConfig);
  const rulesOut = finalizeMap(byRule)
    .map((r) => ({
      ...r,
      offers: configs
        .filter((c) => c.ruleId === r.id)
        .map((c) => ({
          ...c,
          recentOrders: (recentOrdersByConfig.get(c.id) || []).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10),
        }))
        .sort((a, b) => a.position - b.position || b.revenue - a.revenue),
    }))
    // Les règles supprimées restent tout en bas, quel que soit le tri.
    .sort((a, b) => Number(a.isDeleted || 0) - Number(b.isDeleted || 0) || b.revenue - a.revenue);

  // Série jour par jour sur toute la période.
  const series = [];
  for (let t = from.getTime(); t < to.getTime(); t += DAY_MS) {
    const key = dayKey(new Date(t));
    if (series.length && series[series.length - 1].date === key) continue;
    series.push({ date: key, sent: sentPerDay.get(key) || 0, used: usedPerDay.get(key) || 0 });
  }

  return {
    kpis,
    funnel: [
      { key: "sent", label: "Envoyées", value: kpis.sent },
      { key: "viewed", label: "Vues", value: kpis.viewed },
      { key: "clicked", label: "Cliquées", value: kpis.clicked },
      { key: "used", label: "Utilisées", value: kpis.used },
    ],
    outcomes: { ignored: kpis.ignored, expired: kpis.expired },
    series,
    usageHours: hours,
    rules: rulesOut,
    byType: finalizeMap(byType).sort((a, b) => b.revenue - a.revenue),
    byMethod: finalizeMap(byMethod).sort((a, b) => b.useRate - a.useRate),
    settings: { pointsPerDollar: POINTS_PER_DOLLAR, verdict: VERDICT, includeTests, hediShareIncluded: false },
  };
};

/** BI de la période + KPI de la période précédente de même durée (pour les évolutions). */
const getSmartOffersBI = async ({ from, to, campaignId, includeTests }) => {
  const current = await computeBI({ from, to, campaignId, includeTests, withDetails: true });
  const span = to.getTime() - from.getTime();
  const previous = await computeBI({
    from: new Date(from.getTime() - span),
    to: from,
    campaignId,
    includeTests,
    withDetails: false,
  });
  return { period: { from, to }, ...current, previousKpis: previous.kpis };
};

module.exports = { getSmartOffersBI, computeBI, getOrderEconomics, VERDICT, POINTS_PER_DOLLAR };
