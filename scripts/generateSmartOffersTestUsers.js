/**
 * Génère 36 utilisateurs de test — UN PAR RÈGLE (pas juste un par gabarit de conditions) — pour
 * que chaque règle ait un gagnant garanti lors d'un scan manuel, sans compétition de weight.
 *
 * Les 36 règles (3 distributionMethod x 12 offerType) partagent 24 gabarits de conditions
 * "métier" : un user qui matche l'une matcherait aussi l'autre règle du même gabarit. generateSmartOffersTestMatrix.js ajoute donc à CHAQUE règle une bande
 * fidelity_points unique et séquentielle (règle i → [100+i*20, 100+i*20+20)) qui garantit qu'AUCUNE
 * autre règle ne peut être satisfaite en même temps. Ce script réplique exactement le même mapping
 * ruleIndex -> (method, offerType, template, bande) et pousse chaque user dans SA bande précise.
 *
 * Convention : commande créée dans Order d'abord, puis son _id est poussé dans user.orders
 * (comme demandé), plutôt que de compter uniquement sur Order.user.
 *
 * Idempotent : supprime les users/orders/personalizedOffers de test précédents (même domaine
 * d'email) avant de regénérer. Ne touche à aucune donnée réelle.
 */
const mongoose = require("mongoose");
require("dotenv/config");

const User = require("../models/User");
const Order = require("../models/Order");
const MenuItem = require("../models/MenuItem");
const Category = require("../models/Category");
const SmartOfferRule = require("../models/SmartOfferRule");
const PersonalizedOffer = require("../models/PersonalizedOffer");

const TEST_EMAIL_DOMAIN = "@test-smart-matrix.com";

const FIRST_NAMES = [
  "Julie", "Marc", "Sophie", "Eric", "Isabelle", "Simon", "Chantal", "Mathieu",
  "Véronique", "Patrick", "Nathalie", "David", "Karine", "Sébastien", "Annie",
  "François", "Mélanie", "Alexandre", "Caroline", "Jonathan", "Sarah", "Louis",
  "Geneviève", "Maxime", "Josée", "Vincent", "Audrey", "Philippe", "Émilie", "Jean",
];
const LAST_NAMES = [
  "Tremblay", "Gagnon", "Roy", "Côté", "Bouchard", "Gauthier", "Morin", "Lavoie",
  "Fortin", "Gagné", "Ouellet", "Pelletier", "Bélanger", "Lévesque", "Bergeron",
  "Leblanc", "Paquette", "Girard", "Simard", "Boucher", "Caron", "Beaulieu",
];
const AREA_CODES = ["819", "514", "438", "450", "581", "367", "873"];

function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomName() {
  return `${randPick(FIRST_NAMES)} ${randPick(LAST_NAMES)}`;
}
let phoneCounter = 9000000 + Math.floor(Math.random() * 900000);
function nextPhone() {
  phoneCounter += 1;
  return `+1${randPick(AREA_CODES)}${String(phoneCounter).padStart(7, "0")}`;
}
const TORONTO_TZ = "America/Toronto";
const TORONTO_WEEKDAY_MAP = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

// Décalage UTC de America/Toronto (en heures, négatif) à un instant donné, ex: -4 en EDT, -5 en EST.
// RuleEvaluatorService.getPartsInTimezone lit preferred_hour/preferred_day dans ce fuseau : construire
// les dates en heure LOCALE de la machine (qui peut être n'importe quel fuseau, ex: Africa/Tunis en
// dev) donnerait des heures/jours faux une fois relus côté Toronto — d'où ce calcul explicite.
function torontoUtcOffsetHours(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TORONTO_TZ,
    timeZoneName: "shortOffset",
    hour: "numeric",
  }).formatToParts(date);
  const tzPart = parts.find((p) => p.type === "timeZoneName");
  const match = tzPart && /GMT([+-]\d+)/.exec(tzPart.value);
  return match ? parseInt(match[1], 10) : -4;
}
function torontoWeekday(date) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TORONTO_TZ, weekday: "long" }).format(date);
  return TORONTO_WEEKDAY_MAP[name] ?? date.getUTCDay();
}
function makeDate(daysAgo, hour = 12, forceWeekday = null) {
  const base = new Date();
  base.setUTCHours(12, 0, 0, 0); // ancré à midi UTC pour éviter tout basculement de jour lié au DST
  base.setUTCDate(base.getUTCDate() - daysAgo);
  const offset = torontoUtcOffsetHours(base);
  let d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hour - offset, 0, 0, 0));
  if (forceWeekday !== null) {
    const diff = forceWeekday - torontoWeekday(d);
    d = new Date(d.getTime() + diff * 86400000);
  }
  return d;
}

async function run() {
  console.log("🚀 Génération des users/orders de test pour la matrice Smart Offers");

  await mongoose.connect(process.env.DEV_DB_CONNECTION, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log("✅ Connecté à MongoDB (DEV_DB_CONNECTION)");

  // --- Menu réel : on exclut les items de test visiblement invalides (prix aberrants) ---
  const allItems = await MenuItem.find({ is_available: true }).select("name prices category").lean();
  const menuItems = allItems.filter((i) => (i.prices || []).every((p) => p.price > 0 && p.price < 100));
  const categories = await Category.find().select("name").lean();

  if (menuItems.length < 5) {
    throw new Error("Pas assez de MenuItem valides en base pour générer des paniers réalistes.");
  }

  const category0Id = categories[0]?._id;
  const category1Id = categories[1]?._id;
  const category0Items = menuItems.filter((i) => String(i.category) === String(category0Id));
  const otherCategoryItems = menuItems.filter((i) => String(i.category) !== String(category0Id));
  const item0 = menuItems[0];
  const itemsExcludingItem0 = menuItems.filter((i) => String(i._id) !== String(item0._id));

  const sampleRule = await SmartOfferRule.findOne().lean();

  // --- Nettoyage des données de test précédentes (idempotent) ---
  const previousUsers = await User.find({ email: { $regex: TEST_EMAIL_DOMAIN } }).select("_id").lean();
  const previousUserIds = previousUsers.map((u) => u._id);
  if (previousUserIds.length) {
    const delOrders = await Order.deleteMany({ user: { $in: previousUserIds } });
    const delOffers = await PersonalizedOffer.deleteMany({ user: { $in: previousUserIds } });
    await User.deleteMany({ _id: { $in: previousUserIds } });
    console.log(
      `🧹 Nettoyage précédent : ${previousUserIds.length} users, ${delOrders.deletedCount} orders, ${delOffers.deletedCount} personalizedOffers supprimés.`
    );
  }

  function buildBasket(pool, targetSum, maxLines = 5) {
    const lines = [];
    let sum = 0;
    let guard = 0;
    while (sum < targetSum && guard < maxLines) {
      const entry = randPick(pool);
      const priceObj = randPick(entry.prices);
      lines.push({ item: entry._id, size: priceObj.size, price: priceObj.price, basePrice: priceObj.price });
      sum += priceObj.price;
      guard++;
    }
    return { orderItems: lines, subTotal: Math.round(sum * 100) / 100 };
  }

  // Crée l'utilisateur, ses commandes (Order d'abord, puis _id poussé dans user.orders), et
  // éventuellement des PersonalizedOffer pour les critères qui en dépendent.
  async function createPersonaUser({ label, userOverrides = {}, orderSpecs = [], offerSpecs = [] }) {
    const user = await User.create({
      name: randomName(),
      email: `${label.replace(/[^a-z0-9]+/gi, ".").toLowerCase()}.${Date.now()}.${Math.floor(Math.random() * 1e6)}${TEST_EMAIL_DOMAIN}`,
      phone_number: nextPhone(),
      is_profile_setup: true,
      createdAt: new Date(),
      appIsInstalled: true,
      ...userOverrides,
    });

    const orderIds = [];
    for (const spec of orderSpecs) {
      const pool = spec.pool || menuItems;
      const { orderItems, subTotal } = buildBasket(pool, spec.targetSum ?? 15);
      const createdAt = makeDate(spec.daysAgo, spec.hour ?? 12, spec.forceWeekday ?? null);
      const order = await Order.create({
        user: user._id,
        orderItems,
        sub_total: subTotal,
        total_price: subTotal,
        status: "completed",
        confirmed: true,
        createdAt,
        type: Math.random() > 0.5 ? "delivery" : "pickup",
        platform: "app",
      });
      orderIds.push(order._id);
    }

    if (orderIds.length) {
      // Ces commandes ne passent pas par confirmOrderService : on pose nous-mêmes l'indicateur
      // qu'il aurait mis, sinon le client resterait éligible à la remise 1re commande.
      await User.findByIdAndUpdate(user._id, {
        $push: { orders: { $each: orderIds } },
        $set: { firstOrderDiscountApplied: true },
      });
    }

    for (const offerSpec of offerSpecs) {
      if (!sampleRule) continue; // pas de SmartOfferRule en base : on saute (cas improbable en dev)
      await PersonalizedOffer.create({
        user: user._id,
        rule: sampleRule._id,
        status: offerSpec.status,
        offerType: "discount_order",
        discountValue: 10,
        scheduledNotifyAt: makeDate(offerSpec.daysAgo ?? 10),
        createdAt: makeDate(offerSpec.daysAgo ?? 10),
        notificationTitle: "Offre test",
        notificationBody: "Générée pour tester smart_offers_used / conversion_rate.",
      });
    }

    return { user, orderCount: orderIds.length };
  }

  // --- 24 personas, un par gabarit de condition (voir generateSmartOffersTestMatrix.js) ---
  // Chaque persona définit build(variant) : pour les gabarits avec OR, les 2 variantes
  // ciblent délibérément DEUX branches différentes, pour prouver que chacune suffit seule
  // (pas juste que le user matche "par hasard" avec toutes les conditions vraies à la fois).
  const otherCat = categories[2]?._id || categories[0]?._id;
  const otherCatItems = menuItems.filter((i) => String(i.category) === String(otherCat));
  const offCategoryPool = otherCatItems.length ? otherCatItems : itemsExcludingItem0;
  // Items réduits à leur taille la moins chère et filtrés <12$ : garantit qu'un panier d'1-2
  // articles reste sous un petit seuil (buildBasket peut sinon piocher une taille chère au hasard
  // même avec un targetSum bas, puisqu'il s'arrête dès qu'une ligne suffit).
  const cheapItemsPool = menuItems
    .map((i) => ({ ...i, prices: [i.prices.reduce((min, p) => (p.price < min.price ? p : min))] }))
    .filter((i) => i.prices[0].price < 12);

  const PERSONA_DEFS = [
    { id: 0, label: "and_or_spent_orders_or_points", build: (v) => v === 0
      ? { orderSpecs: [30, 30, 30, 30].map((targetSum, i) => ({ targetSum, daysAgo: 5 + i * 5 })) } // C1 AND C2
      : { userOverrides: { fidelity_points: 600 }, orderSpecs: [{ targetSum: 10, daysAgo: 5 }] } // C3 seul
    },
    { id: 1, label: "and_basket_app_friday_90d", build: () => ({
      userOverrides: { appIsInstalled: true },
      orderSpecs: [10, 30, 50].map((daysAgo) => ({ targetSum: 28, daysAgo, forceWeekday: 5 })),
    }) },
    { id: 2, label: "or_recency_or_subscribed_age", build: (v) => v === 0
      ? { orderSpecs: [{ targetSum: 20, daysAgo: 40 }] } // C1 seul (recency>=30)
      : { userOverrides: { subscriptionIsActive: true, createdAt: makeDate(120) }, orderSpecs: [{ targetSum: 20, daysAgo: 5 }] } // C2 AND C3, recency<30
    },
    { id: 3, label: "and_orders_cadence_ratio", build: () => ({
      orderSpecs: [60, 50, 40, 30, 20, 10].map((daysAgo) => ({ targetSum: 15, daysAgo })),
    }) },
    { id: 4, label: "or_category_or_item_and_recent", build: (v) => v === 0
      ? { orderSpecs: [2, 5, 8, 11].map((daysAgo) => ({ targetSum: 15, daysAgo, pool: category0Items.length ? category0Items : menuItems })) } // C1 (catégorie) AND C3 (4 commandes <14j)
      : { orderSpecs: [1, 5, 9, 13].map((daysAgo) => ({ targetSum: 15, daysAgo, pool: offCategoryPool })) } // C2 (item not_in [8 articles]) AND C3, hors catégorie 0/1
    },
    { id: 5, label: "and_hour_day_spent", build: () => ({
      orderSpecs: [5, 15, 25, 35, 45].map((daysAgo) => ({ targetSum: 35, daysAgo, hour: 19, forceWeekday: 3 })),
    }) },
    { id: 6, label: "and_zero_offers_recent_low_count", build: (v) => v === 0
      ? { orderSpecs: [{ targetSum: 15, daysAgo: 5 }] } // 1 commande, recency=5<10, count=1<=2
      : { orderSpecs: [{ targetSum: 12, daysAgo: 3 }, { targetSum: 14, daysAgo: 8 }] } // 2 commandes, recency=3<10, count=2<=2
    },
    { id: 7, label: "and_rewards_low_conversion", build: () => ({
      orderSpecs: [{ targetSum: 15, daysAgo: 5 }],
      offerSpecs: [{ status: "applied", daysAgo: 10 }, { status: "expired", daysAgo: 20 }, { status: "expired", daysAgo: 30 }, { status: "ignored", daysAgo: 40 }],
    }) },
    { id: 8, label: "and_openrate_many_small_orders", build: () => ({
      // 6+ commandes, panier moyen < 15$ chacune : profil "petit habitué", pas juste les
      // valeurs par défaut de n'importe quel user.
      orderSpecs: [5, 15, 25, 35, 45, 55].map((daysAgo) => ({ targetSum: 7, daysAgo, pool: cheapItemsPool })),
    }) },
    { id: 9, label: "or_spent_or_points_and_age_app", build: (v) => v === 0
      ? { userOverrides: { appIsInstalled: true, createdAt: makeDate(60) }, orderSpecs: [65, 65, 65, 65, 65].map((targetSum, i) => ({ targetSum, daysAgo: 5 + i * 5 })) } // C1 seul
      : { userOverrides: { appIsInstalled: true, createdAt: makeDate(60), fidelity_points: 600 }, orderSpecs: [{ targetSum: 10, daysAgo: 5 }] } // C2 seul
    },
    { id: 10, label: "and_basket_count_recency", build: () => ({
      orderSpecs: [{ targetSum: 30, daysAgo: 5 }, { targetSum: 32, daysAgo: 15 }],
    }) },
    { id: 11, label: "and_day_in_basket", build: () => ({
      orderSpecs: [
        { targetSum: 20, daysAgo: 10, forceWeekday: 5 },
        { targetSum: 20, daysAgo: 25, forceWeekday: 6 },
        { targetSum: 20, daysAgo: 40, forceWeekday: 5 },
      ],
    }) },
    { id: 12, label: "and_points_or_recency_or_count", build: (v) => v === 0
      ? { userOverrides: { fidelity_points: 100 }, orderSpecs: [{ targetSum: 15, daysAgo: 60 }, { targetSum: 15, daysAgo: 90 }, { targetSum: 15, daysAgo: 120 }] } // C2 seul (recency>=45, count=3 donc C3 faux)
      : { userOverrides: { fidelity_points: 100 }, orderSpecs: [{ targetSum: 15, daysAgo: 5 }] } // C3 seul (count=1<2, recency=5<45 donc C2 faux)
    },
    { id: 13, label: "and_age_count_spent", build: () => ({
      userOverrides: { createdAt: makeDate(30) },
      orderSpecs: [{ targetSum: 20, daysAgo: 5 }, { targetSum: 20, daysAgo: 15 }, { targetSum: 20, daysAgo: 25 }],
    }) },
    { id: 14, label: "and_item_notin_recent14d", build: () => ({
      orderSpecs: [{ targetSum: 18, daysAgo: 5, pool: itemsExcludingItem0 }],
    }) },
    { id: 15, label: "and_hour_range_basket", build: () => ({
      orderSpecs: [{ targetSum: 25, daysAgo: 5, hour: 19 }, { targetSum: 25, daysAgo: 15, hour: 20 }],
    }) },
    { id: 16, label: "and_offers_used_conversion_app", build: () => ({
      userOverrides: { appIsInstalled: true },
      orderSpecs: [{ targetSum: 15, daysAgo: 5 }],
      offerSpecs: [{ status: "applied", daysAgo: 10 }, { status: "applied", daysAgo: 25 }, { status: "expired", daysAgo: 40 }],
    }) },
    { id: 17, label: "and_cadence_ratio_interval_count", build: () => ({
      orderSpecs: [60, 46, 32, 18].map((daysAgo) => ({ targetSum: 15, daysAgo })),
    }) },
    { id: 18, label: "and_category_or_spent_or_points", build: (v) => v === 0
      ? { orderSpecs: [3, 13, 23].map((daysAgo) => ({ targetSum: 30, daysAgo, pool: category0Items.length ? category0Items : menuItems })) } // C2 seul (total>=80)
      : { userOverrides: { fidelity_points: 200 }, orderSpecs: [{ targetSum: 15, daysAgo: 5, pool: category0Items.length ? category0Items : menuItems }] } // C3 seul
    },
    { id: 19, label: "or_monday_or_tuesday_or_spent", build: (v) => v === 0
      ? { orderSpecs: [7, 21, 35, 49].map((daysAgo) => ({ targetSum: 15, daysAgo, forceWeekday: 1 })) } // C1 seul (lundi)
      : { orderSpecs: [55, 55, 55, 55, 55].map((targetSum, i) => ({ targetSum, daysAgo: 5 + i * 5, forceWeekday: 4 })) } // C3 seul (jeudi, total>=250)
    },
    { id: 20, label: "and_age_sub_count_basket", build: () => ({
      userOverrides: { subscriptionIsActive: true, createdAt: makeDate(150) },
      orderSpecs: [20, 20, 20, 20, 20].map((targetSum, i) => ({ targetSum, daysAgo: 5 + i * 10 })),
    }) },
    { id: 21, label: "or_recency_or_subscribed_and_count_app", build: (v) => v === 0
      // C1 seul (recency>=60, non abonné, count=3>=3)
      ? { userOverrides: { appIsInstalled: true }, orderSpecs: [70, 80, 90].map((daysAgo) => ({ targetSum: 20, daysAgo })) }
      // C2 seul (abonné, recency<60, count=3>=3)
      : { userOverrides: { appIsInstalled: true, subscriptionIsActive: true }, orderSpecs: [5, 15, 25].map((daysAgo) => ({ targetSum: 20, daysAgo })) }
    },
    { id: 22, label: "single_total_spent_ge_100_edge_case", build: () => ({
      orderSpecs: [{ targetSum: 55, daysAgo: 5 }, { targetSum: 55, daysAgo: 15 }],
    }) },
    { id: 23, label: "zero_condition_always_true_edge_case", build: () => ({
      orderSpecs: [{ targetSum: 15, daysAgo: 5 }],
    }) },
  ];

  // --- 36 users isolés, un par règle (pas juste un par gabarit) ---
  // Doit répliquer EXACTEMENT le mapping ruleIndex -> (method, offerType, template) et la formule
  // de bande d'isolement fidelity_points de scripts/generateSmartOffersTestMatrix.js, sinon les
  // valeurs ne correspondront pas aux bandes réellement écrites dans les règles.
  const DISTRIBUTION_METHODS = ["weighted_random", "multi_armed_bandit", "scenario_journey"];
  const OFFER_TYPES = [
    "discount_order", "discount_category", "discount_product", "free_item", "bonus_basket",
    "free_delivery", "loyalty_points", "split_discount", "buy_one_get_one",
    "deferred_cashback", "tiered_discount", "mystery_gift",
  ];
  const ISOLATION_BAND_WIDTH = 20;
  const ISOLATION_BAND_START = 100;

  let createdUsers = 0;
  let createdOrders = 0;
  let ruleIndex = 0;

  for (const method of DISTRIBUTION_METHODS) {
    for (let offerIdx = 0; offerIdx < OFFER_TYPES.length; offerIdx++) {
      const offerType = OFFER_TYPES[offerIdx];
      const secondOfferType = method !== "priority" ? OFFER_TYPES[(offerIdx + 1) % OFFER_TYPES.length] : null;
      const templateId = ruleIndex % PERSONA_DEFS.length;
      const def = PERSONA_DEFS[templateId];

      // v0 toujours : les personas isolés n'ont pas besoin de la diversité de branches OR
      // (déjà validée dans une génération précédente) — seule l'unicité de la bande fidelity_points
      // garantit maintenant qu'aucune autre règle ne peut matcher.
      const spec = def.build(0);
      const isoLow = ISOLATION_BAND_START + ruleIndex * ISOLATION_BAND_WIDTH;
      const isoFidelityPoints = isoLow + Math.floor(ISOLATION_BAND_WIDTH / 2);

      const ruleLabel = `${method}.${offerType}${secondOfferType ? `+${secondOfferType}` : ""}`;
      const { orderCount } = await createPersonaUser({
        label: `r${String(ruleIndex).padStart(3, "0")}.T${String(templateId).padStart(2, "0")}.${ruleLabel}`,
        userOverrides: { ...spec.userOverrides, fidelity_points: isoFidelityPoints },
        orderSpecs: spec.orderSpecs || [],
        offerSpecs: spec.offerSpecs,
      });
      createdUsers++;
      createdOrders += orderCount;
      ruleIndex++;
    }
  }

  console.log(`✅ ${createdUsers} utilisateurs de test créés (1 par règle), ${createdOrders} commandes générées.`);
  console.log(`   Domaine email de test : *${TEST_EMAIL_DOMAIN}`);
  console.log(
    "ℹ️  open_rate (gabarit #8) est actuellement câblé en dur à 0 dans ProfilingService : tous les users " +
      "le satisfont, indépendamment des données générées ici."
  );

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Erreur fatale:", err);
  process.exit(1);
});
