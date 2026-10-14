/**
 * Génère une matrice combinatoire de DynamicRule (Smart Offers V2) couvrant :
 *   - les 3 distributionMethod utilisées (weighted_random, multi_armed_bandit, scenario_journey)
 *   - les 12 offerType (croisés avec chaque distributionMethod)
 *   - 24 gabarits de conditions couvrant les 20 critères connus de RuleEvaluatorService
 *     et les 8 opérateurs ; 22/24 combinent 2 à 4 conditions (AND/OR/parenthèses imbriquées,
 *     periodDays mêlés), seuls #22 et #23 sont des cas limites volontaires (1 condition / 0 condition).
 *
 * Écrit directement en base (Mongoose) car le routeur smartOffersV2 n'est pas monté
 * dans index.js — voir routes/smartOffersV2.js (jamais utilisé par app.use(...)).
 *
 * Idempotent : supprime la campagne de test précédente (même nom) avant de regénérer.
 * Ne touche à aucune autre campagne/règle existante.
 */
const mongoose = require("mongoose");
require("dotenv/config");

const Campaign = require("../models/Campaign");
const DynamicRule = require("../models/DynamicRule");
const MenuItem = require("../models/MenuItem");
const Category = require("../models/Category");

const TEST_CAMPAIGN_NAME = "🧪 TEST MATRICE - Rules x Offers x Distribution";

// Seules méthodes réellement utilisées en production (dashboard : "Aléatoire (Pondéré)",
// "A/B Testing IA", "Parcours Scénarisé").
const DISTRIBUTION_METHODS = [
  "weighted_random",
  "multi_armed_bandit",
  "scenario_journey",
];

const OFFER_TYPES = [
  "discount_order",
  "discount_category",
  "discount_product",
  "free_item",
  "bonus_basket",
  "free_delivery",
  "loyalty_points",
  "split_discount",
  "buy_one_get_one",
  "deferred_cashback",
  "tiered_discount",
  "mystery_gift",
];

async function run() {
  console.log("🚀 Génération de la matrice de test Smart Offers V2");

  await mongoose.connect(process.env.DEV_DB_CONNECTION, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log("✅ Connecté à MongoDB (DEV_DB_CONNECTION)");

  // --- Refs réelles pour rendre les règles exploitables dans le dashboard ---
  const items = await MenuItem.find().limit(6).select("name prices").lean();
  const categories = await Category.find().limit(4).select("name").lean();

  if (items.length < 2 || categories.length < 1) {
    console.warn(
      "⚠️  Peu ou pas de MenuItem/Category en base : certains champs (targetCategory, " +
        "targetMenuItem, freeItem, triggerItem) resteront vides sur les offres concernées."
    );
  }

  const itemId = (i) => (items[i % items.length] ? items[i % items.length]._id : undefined);
  const itemSize = (i) => {
    const it = items[i % items.length];
    return it && it.prices && it.prices[0] ? it.prices[0].size : undefined;
  };
  const categoryId = (i) => (categories[i % categories.length] ? categories[i % categories.length]._id : undefined);

  // --- 1. Nettoyage de la campagne de test précédente (idempotent) ---
  const previous = await Campaign.findOne({ name: TEST_CAMPAIGN_NAME });
  if (previous) {
    const deleted = await DynamicRule.deleteMany({ campaign: previous._id });
    await Campaign.findByIdAndDelete(previous._id);
    console.log(`🧹 Ancienne campagne de test supprimée (${deleted.deletedCount} règles).`);
  }

  // --- 2. Campagne de test dédiée (inactive par défaut : ne touche pas au profiling) ---
  const campaign = await Campaign.create({
    name: TEST_CAMPAIGN_NAME,
    description:
      "Généré par scripts/generateSmartOffersTestMatrix.js — croise chaque distributionMethod " +
      "avec chaque offerType, avec des jeux de conditions variés. Ne pas utiliser en profiling " +
      "réel sans revue manuelle.",
    isActive: false,
    priority: -1,
  });
  console.log(`✅ Campagne créée : ${campaign._id}`);

  // --- 3. Gabarits de conditions (24) ---
  // 22 des 24 combinent 2 à 4 conditions (AND / OR / parenthèses, opérateurs et critères
  // variés, avec ou sans periodDays) : la complexité est la norme, pas l'exception.
  // Seuls #22 (1 condition) et #23 (0 condition = toujours vrai) sont des cas limites
  // délibérés, gardés pour vérifier que RuleEvaluatorService gère aussi ces cas triviaux.
  function cond(id, criteria, operator, value, periodDays = null) {
    return { conditionId: id, criteria, operator, value, periodDays };
  }

  const conditionTemplates = [
    // T0 : (total_spent>=100 AND orders_count>=3) OR fidelity_points>=500
    () => ({
      conditions: [
        cond("C1", "total_spent", ">=", 100),
        cond("C2", "orders_count", ">=", 3),
        cond("C3", "fidelity_points", ">=", 500),
      ],
      logicalExpression: "(C1 AND C2) OR C3",
    }),
    // T1 : average_basket>20 AND has_app==true AND preferred_day==5 (90j)
    () => ({
      conditions: [
        cond("C1", "average_basket", ">", 20),
        cond("C2", "has_app", "==", true),
        cond("C3", "preferred_day", "==", 5, 90),
      ],
      logicalExpression: "C1 AND C2 AND C3",
    }),
    // T2 : recency_days>=30 OR (is_subscribed==true AND account_age_days>=90)
    () => ({
      conditions: [
        cond("C1", "recency_days", ">=", 30),
        cond("C2", "is_subscribed", "==", true),
        cond("C3", "account_age_days", ">=", 90),
      ],
      logicalExpression: "C1 OR (C2 AND C3)",
    }),
    // T3 : orders_count>=5 AND average_days_between_orders<=14 AND recency_to_cadence_ratio<=2
    () => ({
      conditions: [
        cond("C1", "orders_count", ">=", 5),
        cond("C2", "average_days_between_orders", "<=", 14),
        cond("C3", "recency_to_cadence_ratio", "<=", 2),
      ],
      logicalExpression: "C1 AND C2 AND C3",
    }),
    // T4 : (favorite_category in [cat0,cat1] OR favorite_item not_in [8 items]) AND orders_last_X_days>=4 (14j)
    // La liste d'exclusion de C2 est volontairement large (8 articles, pas juste 1) : avec un
    // seul article exclu, "not_in" est vrai ~9 fois sur 10 par pur hasard et ne discrimine rien.
    () => ({
      conditions: [
        cond("C1", "favorite_category", "in", [String(categoryId(0)), String(categoryId(1))]),
        cond("C2", "favorite_item", "not_in", [0, 1, 2, 3, 4, 5, 6, 7].map((i) => String(itemId(i)))),
        cond("C3", "orders_last_X_days", ">=", 4, 14),
      ],
      logicalExpression: "(C1 OR C2) AND C3",
    }),
    // T5 : preferred_hour>=18 AND preferred_day!=0 AND total_spent>=150
    () => ({
      conditions: [
        cond("C1", "preferred_hour", ">=", 18),
        cond("C2", "preferred_day", "!=", 0),
        cond("C3", "total_spent", ">=", 150),
      ],
      logicalExpression: "C1 AND C2 AND C3",
    }),
    // T6 : smart_offers_used==0 AND recency_days<10 AND orders_count<=2 (nouveau client rare,
    // pas juste "smart_offers_used==0 AND (OR large)" qui devenait trivial dès que toutes les
    // PersonalizedOffer de test sont purgées : ==0 devient alors vrai pour tout le monde).
    () => ({
      conditions: [
        cond("C1", "smart_offers_used", "==", 0),
        cond("C2", "recency_days", "<", 10),
        cond("C3", "orders_count", "<=", 2),
      ],
      logicalExpression: "C1 AND C2 AND C3",
    }),
    // T7 : rewards_claimed>=1 AND smart_offers_conversion_rate<50
    () => ({
      conditions: [
        cond("C1", "rewards_claimed", ">=", 1),
        cond("C2", "smart_offers_conversion_rate", "<", 50),
      ],
      logicalExpression: "C1 AND C2",
    }),
    // T8 : open_rate<0.2 AND orders_count>=6 AND average_basket<15 (l'ancienne version
    // "app_is_installed!=false AND fidelity_points<100" était quasi toujours vraie : ce sont
    // les valeurs PAR DÉFAUT de tout user non-configuré (appIsInstalled:true, fidelity_points:0),
    // donc ça matchait ~tout le monde peu importe le persona ciblé — pas une vraie condition).
    () => ({
      conditions: [
        cond("C1", "open_rate", "<", 0.2),
        cond("C2", "orders_count", ">=", 6),
        cond("C3", "average_basket", "<", 15),
      ],
      logicalExpression: "C1 AND C2 AND C3",
    }),
    // T9 : (total_spent>=300 OR fidelity_points>=500) AND account_age_days>=30 AND has_app==true
    () => ({
      conditions: [
        cond("C1", "total_spent", ">=", 300),
        cond("C2", "fidelity_points", ">=", 500),
        cond("C3", "account_age_days", ">=", 30),
        cond("C4", "has_app", "==", true),
      ],
      logicalExpression: "(C1 OR C2) AND C3 AND C4",
    }),
    // T10 : average_basket>=25 AND orders_count<=3 AND recency_days<=20
    () => ({
      conditions: [
        cond("C1", "average_basket", ">=", 25),
        cond("C2", "orders_count", "<=", 3),
        cond("C3", "recency_days", "<=", 20),
      ],
      logicalExpression: "C1 AND C2 AND C3",
    }),
    // T11 : preferred_day in [5,6] (60j) AND average_basket>15
    () => ({
      conditions: [
        cond("C1", "preferred_day", "in", [5, 6], 60),
        cond("C2", "average_basket", ">", 15),
      ],
      logicalExpression: "C1 AND C2",
    }),
    // T12 : fidelity_points>=50 AND (recency_days>=45 OR orders_count<2)
    // (was "is_subscribed==false AND (...)" — is_subscribed==false est la valeur PAR DÉFAUT
    // de tout user non abonné, donc ce gate n'ajoutait aucune vraie restriction ; fidelity_points
    // exige un setup explicite, default=0.)
    () => ({
      conditions: [
        cond("C1", "fidelity_points", ">=", 50),
        cond("C2", "recency_days", ">=", 45),
        cond("C3", "orders_count", "<", 2),
      ],
      logicalExpression: "C1 AND (C2 OR C3)",
    }),
    // T13 : account_age_days<60 AND orders_count>=2 AND total_spent<200
    () => ({
      conditions: [
        cond("C1", "account_age_days", "<", 60),
        cond("C2", "orders_count", ">=", 2),
        cond("C3", "total_spent", "<", 200),
      ],
      logicalExpression: "C1 AND C2 AND C3",
    }),
    // T14 : favorite_item not_in [item0,item1] AND orders_last_X_days>=1 (14j)
    () => ({
      conditions: [
        cond("C1", "favorite_item", "not_in", [String(itemId(0)), String(itemId(1))]),
        cond("C2", "orders_last_X_days", ">=", 1, 14),
      ],
      logicalExpression: "C1 AND C2",
    }),
    // T15 : preferred_hour>=17 AND preferred_hour<=21 AND average_basket>=20
    () => ({
      conditions: [
        cond("C1", "preferred_hour", ">=", 17),
        cond("C2", "preferred_hour", "<=", 21),
        cond("C3", "average_basket", ">=", 20),
      ],
      logicalExpression: "C1 AND C2 AND C3",
    }),
    // T16 : smart_offers_used>=1 AND smart_offers_conversion_rate>=50 AND has_app==true
    () => ({
      conditions: [
        cond("C1", "smart_offers_used", ">=", 1),
        cond("C2", "smart_offers_conversion_rate", ">=", 50),
        cond("C3", "has_app", "==", true),
      ],
      logicalExpression: "C1 AND C2 AND C3",
    }),
    // T17 : recency_to_cadence_ratio>1.2 AND average_days_between_orders<=21 AND orders_count>=3
    () => ({
      conditions: [
        cond("C1", "recency_to_cadence_ratio", ">", 1.2),
        cond("C2", "average_days_between_orders", "<=", 21),
        cond("C3", "orders_count", ">=", 3),
      ],
      logicalExpression: "C1 AND C2 AND C3",
    }),
    // T18 : favorite_category in [cat0] AND (total_spent>=80 OR fidelity_points>=150)
    () => ({
      conditions: [
        cond("C1", "favorite_category", "in", [String(categoryId(0))]),
        cond("C2", "total_spent", ">=", 80),
        cond("C3", "fidelity_points", ">=", 150),
      ],
      logicalExpression: "C1 AND (C2 OR C3)",
    }),
    // T19 : preferred_day==1 (90j) OR preferred_day==2 (90j) OR total_spent>=250
    () => ({
      conditions: [
        cond("C1", "preferred_day", "==", 1, 90),
        cond("C2", "preferred_day", "==", 2, 90),
        cond("C3", "total_spent", ">=", 250),
      ],
      logicalExpression: "C1 OR C2 OR C3",
    }),
    // T20 : account_age_days>=120 AND is_subscribed==true AND orders_count>=4 AND average_basket>=18
    () => ({
      conditions: [
        cond("C1", "account_age_days", ">=", 120),
        cond("C2", "is_subscribed", "==", true),
        cond("C3", "orders_count", ">=", 4),
        cond("C4", "average_basket", ">=", 18),
      ],
      logicalExpression: "C1 AND C2 AND C3 AND C4",
    }),
    // T21 : (recency_days>=60 OR is_subscribed==true) AND (orders_count>=3 AND has_app==true)
    // (was "... OR is_subscribed==false ..." — false est la valeur PAR DÉFAUT, donc cette
    // branche était quasi toujours vraie et faisait gagner cette règle pour ~80% des users
    // peu importe leur persona ciblé ; orders_count>=1 était aussi trivial, remonté à >=3.)
    () => ({
      conditions: [
        cond("C1", "recency_days", ">=", 60),
        cond("C2", "is_subscribed", "==", true),
        cond("C3", "orders_count", ">=", 3),
        cond("C4", "has_app", "==", true),
      ],
      logicalExpression: "(C1 OR C2) AND (C3 AND C4)",
    }),
    // T22 : cas limite volontaire — 1 seule condition (vérifie que le moteur gère aussi le trivial)
    () => ({
      conditions: [cond("C1", "total_spent", ">=", 100)],
      logicalExpression: "C1",
    }),
    // T23 : cas limite volontaire — 0 condition = toujours vrai (RuleEvaluatorService.evaluate
    // court-circuite sur conditions.length===0 avant de lire logicalExpression ; le schéma exige
    // quand même une chaîne non vide, donc "TRUE" ici n'est qu'un placeholder jamais évalué).
    () => ({ conditions: [], logicalExpression: "TRUE" }),
  ];

  // --- 4. Champs spécifiques par offerType ---
  function offerTypeFields(offerType, seed) {
    switch (offerType) {
      case "discount_order":
        return { discountValue: 15 };
      case "discount_category":
        return { discountValue: 20, targetCategory: categoryId(seed) };
      case "discount_product":
        return { discountValue: 25, targetMenuItem: itemId(seed) };
      case "free_item":
        return {
          freeItem: itemId(seed),
          giftItemSize: itemSize(seed),
          bonusThreshold: 25,
        };
      case "bonus_basket":
        return { bonusThreshold: 30, discountValue: 5 };
      case "free_delivery":
        return {};
      case "loyalty_points":
        return { bonusPoints: 150, bonusThreshold: 20 };
      case "split_discount":
        return { discountSteps: [10, 15, 20], followupValidityDays: 10 };
      case "buy_one_get_one":
        return {
          triggerItem: itemId(seed),
          triggerItemSize: itemSize(seed),
          freeItem: itemId(seed + 1),
          giftItemSize: itemSize(seed + 1),
        };
      case "deferred_cashback":
        return {
          deferredThreshold: 40,
          deferredDiscountValue: 10,
          deferredActivationRule: "next_weekend",
          deferredValidityDays: 7,
        };
      case "tiered_discount":
        return {
          tieredDiscounts: [
            { threshold: 20, discountValue: 10 },
            { threshold: 40, discountValue: 20 },
          ],
        };
      case "mystery_gift":
        // Comme dans le dashboard ("Article Réel (Liaison au Menu)") : le client doit ajouter
        // l'article au panier, ce que vérifie le garde-fou "cadeau oublié".
        return {
          mysteryThreshold: 35,
          mysteryItemName: "Cadeau Surprise Test",
          freeItem: itemId(seed),
          giftItemSize: itemSize(seed),
        };
      default:
        return {};
    }
  }

  // --- 5. Champs spécifiques par distributionMethod, par position d'offre dans le tableau ---
  function distributionFields(method, position) {
    switch (method) {
      case "waterfall":
      case "success_sequence":
        return position === 0
          ? { waterfallLevel: 1, waterfallDelayDays: 3 }
          : { waterfallLevel: 2, waterfallDelayDays: 5 };
      case "scenario_journey":
        return position === 0
          ? { stepId: "A", isRoot: true, nextStepOnAccept: "B", nextStepOnIgnore: "B" }
          : { stepId: "B", isRoot: false };
      case "weighted_random":
        return position === 0 ? { weight: 70 } : { weight: 30 };
      default:
        return {};
    }
  }

  function buildOffer(offerType, method, position, seed) {
    return {
      offerType,
      notificationTitle: `[TEST] ${offerType} (${method})`,
      notificationBody: `Offre générée automatiquement pour tester ${offerType} sous ${method}.`,
      ...offerTypeFields(offerType, seed),
      ...distributionFields(method, position),
    };
  }

  // --- 6. Génération : 3 distributionMethod x 12 offerType = 36 règles ---
  //
  // Isolation : les 36 règles partagent 24 gabarits de conditions (certains servent à 2
  // règles) — un user qui matche l'une matcherait donc aussi l'autre. Pour garantir qu'UN SEUL user cible EXACTEMENT UNE règle (aucune
  // compétition de weight, pas de règle qui gagne "par hasard"), chaque règle reçoit EN PLUS
  // une bande fidelity_points de 20 points, unique et séquentielle (règle i → [100+i*20, 100+i*20+20)).
  // fidelity_points est un champ user pur (aucune commande à fabriquer pour ça) et aucun des 24
  // gabarits n'en a besoin au-delà d'un seuil bas (>=50 pour T12) — démarrer à 100 le respecte
  // partout sans jamais contredire le gabarit d'origine.
  const ISOLATION_BAND_WIDTH = 20;
  const ISOLATION_BAND_START = 100;

  let ruleIndex = 0;
  const createdRules = [];

  for (const method of DISTRIBUTION_METHODS) {
    for (let offerIdx = 0; offerIdx < OFFER_TYPES.length; offerIdx++) {
      const offerType = OFFER_TYPES[offerIdx];
      const template = conditionTemplates[ruleIndex % conditionTemplates.length]();

      const isoLow = ISOLATION_BAND_START + ruleIndex * ISOLATION_BAND_WIDTH;
      const isoHigh = isoLow + ISOLATION_BAND_WIDTH;
      const isolatedConditions = [
        ...template.conditions,
        cond(`ISO_LO_${ruleIndex}`, "fidelity_points", ">=", isoLow),
        cond(`ISO_HI_${ruleIndex}`, "fidelity_points", "<", isoHigh),
      ];
      const isolatedExpression = template.conditions.length
        ? `(${template.logicalExpression}) AND (ISO_LO_${ruleIndex} AND ISO_HI_${ruleIndex})`
        : `ISO_LO_${ruleIndex} AND ISO_HI_${ruleIndex}`;

      const offers = [buildOffer(offerType, method, 0, offerIdx)];

      // Toutes les méthodes sauf "priority" ont besoin d'au moins 2 offres pour que
      // OfferDistributionService.selectOffer() exécute réellement leur logique
      // (un tableau à 1 offre court-circuite toujours vers offers[0]).
      if (method !== "priority") {
        const secondOfferType = OFFER_TYPES[(offerIdx + 1) % OFFER_TYPES.length];
        offers.push(buildOffer(secondOfferType, method, 1, offerIdx + 1));
      }

      const rule = await DynamicRule.create({
        campaign: campaign._id,
        name: `[${method}] ${offerType}${offers.length > 1 ? ` + ${offers[1].offerType}` : ""}`,
        description: `Combinaison test #${ruleIndex + 1} — distributionMethod=${method}, offerType principal=${offerType}, gabarit conditions #${ruleIndex % conditionTemplates.length}.`,
        tags: ["test", "matrix", method],
        isActive: true,
        // Poids aléatoire, indépendant de l'ordre de création : avec "weight: 1000 - ruleIndex"
        // (valeur précédente), waterfall (généré en premier) avait TOUJOURS les poids les plus
        // hauts et gagnait pour quasi tous les users, peu importe la règle réellement pertinente
        // pour eux — ça empêchait de tester les 7 autres distributionMethod via le scan manuel.
        weight: 100 + Math.floor(Math.random() * 900),
        logicalExpression: isolatedExpression,
        conditions: isolatedConditions,
        distributionMethod: method,
        offers,
      });

      createdRules.push(rule);
      ruleIndex++;
    }
  }

  console.log(`✅ ${createdRules.length} règles créées dans la campagne "${TEST_CAMPAIGN_NAME}".`);
  console.log(`   Campaign._id = ${campaign._id}`);
  console.log(`   Distribution methods couverts : ${DISTRIBUTION_METHODS.join(", ")}`);
  console.log(`   Offer types couverts : ${OFFER_TYPES.join(", ")}`);
  console.log(
    "⚠️  Campagne créée avec isActive=false pour ne pas interférer avec le profiling réel " +
      "(une autre campagne 'test' est déjà active). Active-la manuellement quand tu es prêt à " +
      "tester l'évaluation/distribution."
  );

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Erreur fatale:", err);
  process.exit(1);
});
