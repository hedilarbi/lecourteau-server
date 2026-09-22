const mongoose = require("mongoose");
require("dotenv/config");

const User = require("../models/User");
const Order = require("../models/Order");
const Campaign = require("../models/Campaign");
const DynamicRule = require("../models/DynamicRule");
const PersonalizedOffer = require("../models/PersonalizedOffer");

const RuleEvaluatorService = require("../services/smartOffersV2/RuleEvaluatorService");

const TEST_EMAIL_SUFFIX = "@test-gamification.com";

async function runTest() {
  console.log("🚀 [TEST E2E] Démarrage de la simulation Gamification & Profiling");
  
  await mongoose.connect(process.env.DEV_DB_CONNECTION, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log("✅ Connecté à MongoDB");

  // 1. NETTOYAGE
  console.log("🧹 [1/5] Nettoyage des anciennes données de test...");
  const testUsers = await User.find({ email: { $regex: TEST_EMAIL_SUFFIX } });
  const testUserIds = testUsers.map(u => u._id);
  
  await Order.deleteMany({ user: { $in: testUserIds } });
  await PersonalizedOffer.deleteMany({ user: { $in: testUserIds } });
  await User.deleteMany({ _id: { $in: testUserIds } });
  
  const testCampaign = await Campaign.findOne({ name: "Campagne Test Gamification E2E" });
  if (testCampaign) {
    await DynamicRule.deleteMany({ campaign: testCampaign._id });
    await Campaign.findByIdAndDelete(testCampaign._id);
  }

  // 2. CRÉATION CAMPAGNE & RÈGLES
  console.log("🛠️ [2/5] Création de la Campagne et des Règles Complexes...");
  const campaign = await Campaign.create({
    name: "Campagne Test Gamification E2E",
    description: "Généré par le test E2E automatisé",
    priority: 1000,
    isActive: true
  });

  const rule1 = await DynamicRule.create({
    campaign: campaign._id, name: "VIP Reactivation (Vendredi)",
    isActive: true, distributionMethod: "priority", weight: 900,
    logicalExpression: "C1 AND C2 AND C3",
    conditions: [
      { conditionId: "C1", criteria: "total_spent", operator: ">=", value: 500 },
      { conditionId: "C2", criteria: "recency_days", operator: ">=", value: 60 },
      { conditionId: "C3", criteria: "preferred_day", operator: "==", value: 5, periodDays: 90 }
    ],
    offers: [{ offerType: "deferred_cashback", deferredThreshold: 40, deferredDiscountValue: 10, deferredActivationRule: "next_weekend", notificationTitle: "Cashback VIP", notificationBody: "Test" }]
  });

  const rule2 = await DynamicRule.create({
    campaign: campaign._id, name: "App Addict",
    isActive: true, distributionMethod: "priority", weight: 800,
    logicalExpression: "C1 AND C2",
    conditions: [
      { conditionId: "C1", criteria: "orders_count", operator: ">=", value: 10 },
      { conditionId: "C2", criteria: "has_app", operator: "==", value: true }
    ],
    offers: [{ offerType: "mystery_gift", mysteryThreshold: 35, mysteryItemName: "Casquette Courteau", notificationTitle: "Cadeau Mystère", notificationBody: "Test" }]
  });

  const rule3 = await DynamicRule.create({
    campaign: campaign._id, name: "Big Spender Tardif",
    isActive: true, distributionMethod: "priority", weight: 700,
    logicalExpression: "C1 AND C2",
    conditions: [
      { conditionId: "C1", criteria: "average_basket", operator: ">=", value: 40 },
      { conditionId: "C2", criteria: "preferred_hour", operator: "==", value: 22 }
    ],
    offers: [{ offerType: "tiered_discount", tieredDiscounts: [{threshold: 20, discountValue: 10}, {threshold: 40, discountValue: 20}], notificationTitle: "Paliers Progressifs", notificationBody: "Test" }]
  });

  const rule4 = await DynamicRule.create({
    campaign: campaign._id, name: "Ciblage Jours Creux (Mardi)",
    isActive: true, distributionMethod: "priority", weight: 600,
    logicalExpression: "C1",
    conditions: [
      { conditionId: "C1", criteria: "preferred_day", operator: "==", value: 2, periodDays: 30 }
    ],
    offers: [{ offerType: "discount_order", discountValue: 15, notifyOnDays: [2, 3], notificationTitle: "Promo Jours Creux", notificationBody: "Test" }]
  });

  // 3. CRÉATION DES USERS & COMMANDES MOCK
  console.log("👤 [3/5] Création des utilisateurs et génération de leur historique...");
  
  const createMockUser = async (name, appInstalled) => {
    return await User.create({ name, email: `${name.replace(/\\s+/g, '').toLowerCase()}${TEST_EMAIL_SUFFIX}`, appIsInstalled: appInstalled, firebaseId: `test_${Date.now()}_${Math.random()}` });
  };

  const createMockOrder = async (user, subTotal, daysAgo, hour, forcedDayOfWeek = null) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(hour, 0, 0, 0);
    
    // Force le jour de la semaine si demandé (pour le User A et B et E)
    if (forcedDayOfWeek !== null) {
       const currentDay = date.getDay();
       const diff = forcedDayOfWeek - currentDay;
       date.setDate(date.getDate() + diff);
    }

    return await Order.create({ user: user._id, total_price: subTotal, sub_total: subTotal, confirmed: true, createdAt: date, status: "completed" });
  };

  // User A: VIP Vendredi (total > 500, recency > 60, pref_day = 5 (Vendredi))
  const userA = await createMockUser("User A VIP Friday", true);
  for(let i=0; i<6; i++) await createMockOrder(userA, 100, 70 + (i*7), 19, 5); // 5 = Vendredi

  // User B: VIP Lundi (total > 500, recency > 60, pref_day = 1 (Lundi)) -> PIEGE
  const userB = await createMockUser("User B VIP Monday", true);
  for(let i=0; i<6; i++) await createMockOrder(userB, 100, 70 + (i*7), 19, 1); // 1 = Lundi

  // User C: App Addict (orders >= 10, has_app = true)
  const userC = await createMockUser("User C App Addict", true);
  for(let i=0; i<12; i++) await createMockOrder(userC, 15, i*2, 12, null); 

  // User D: Big Spender Tardif (avg > 40, pref_hour = 22)
  const userD = await createMockUser("User D Big Spender", true);
  for(let i=0; i<3; i++) await createMockOrder(userD, 50, i*5, 22, null);

  // User E: Ciblage Mardi récent (pref_day = 2 sur les 30 derniers jours)
  const userE = await createMockUser("User E Tuesday Shopper", true);
  await createMockOrder(userE, 20, 7, 12, 2); // Mardi
  await createMockOrder(userE, 20, 14, 12, 2); // Mardi
  await createMockOrder(userE, 20, 21, 12, 2); // Mardi
  // Vieilles commandes un Vendredi (pour vérifier que periodDays:30 l'ignore)
  await createMockOrder(userE, 20, 100, 12, 5);
  await createMockOrder(userE, 20, 107, 12, 5);
  await createMockOrder(userE, 20, 114, 12, 5);
  await createMockOrder(userE, 20, 121, 12, 5);
  await createMockOrder(userE, 20, 128, 12, 5);

  console.log("⚙️ [4/5] Exécution du moteur d'évaluation (Profiling)...");

  const rules = [rule1, rule2, rule3, rule4];
  const users = [userA, userB, userC, userD, userE];

  let testResults = [];

  for (const user of users) {
    const orders = await Order.find({ user: user._id }).sort({ createdAt: -1 }).lean();
    const userContext = { user, orders };
    
    let matchedRules = [];
    for (const rule of rules) {
      const isMatch = RuleEvaluatorService.evaluate(userContext, rule);
      if (isMatch) matchedRules.push(rule.name);
    }
    testResults.push({ userName: user.name, matchedRules });
  }

  console.log("\n📊 [5/5] RÉSULTATS DU TEST :");
  
  const assertRule = (userName, ruleName, results, shouldMatch) => {
    const userRes = results.find(r => r.userName === userName);
    const didMatch = userRes.matchedRules.includes(ruleName);
    const status = (didMatch === shouldMatch) ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} | ${userName.padEnd(25)} ${shouldMatch ? "DEVRAIT" : "NE DEVRAIT PAS"} matcher "${ruleName}" (Trouvé: ${didMatch})`);
  };

  assertRule("User A VIP Friday", "VIP Reactivation (Vendredi)", testResults, true);
  assertRule("User B VIP Monday", "VIP Reactivation (Vendredi)", testResults, false);
  assertRule("User C App Addict", "App Addict", testResults, true);
  assertRule("User D Big Spender", "Big Spender Tardif", testResults, true);
  assertRule("User E Tuesday Shopper", "Ciblage Jours Creux (Mardi)", testResults, true);

  console.log("\n🧹 Nettoyage final...");
  const cleanupUsers = await User.find({ email: { $regex: TEST_EMAIL_SUFFIX } });
  const cleanupIds = cleanupUsers.map(u => u._id);
  await Order.deleteMany({ user: { $in: cleanupIds } });
  await User.deleteMany({ _id: { $in: cleanupIds } });
  await DynamicRule.deleteMany({ campaign: campaign._id });
  await Campaign.findByIdAndDelete(campaign._id);

  console.log("✅ Fin du script.");
  process.exit(0);
}

runTest().catch(err => {
  console.error("Erreur fatale:", err);
  process.exit(1);
});
