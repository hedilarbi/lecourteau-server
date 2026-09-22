const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const Campaign = require("../models/Campaign");
const DynamicRule = require("../models/DynamicRule");
const SmartOfferRule = require("../models/SmartOfferRule");

const MONGODB_URI = process.env.DEV_DB_CONNECTION || "mongodb://localhost:27017/lecourteau";

function mapStrategyToConditions(strategyId) {
  const conditions = [];
  let logicalExpression = "";

  switch (strategyId) {
    case 1:
      conditions.push({ conditionId: "C1", criteria: "orders_count", operator: "==", value: 0 });
      conditions.push({ conditionId: "C2", criteria: "account_age_days", operator: ">=", value: 7 });
      logicalExpression = "C1 AND C2";
      break;
    case 2:
      conditions.push({ conditionId: "C1", criteria: "orders_count", operator: "==", value: 1 });
      conditions.push({ conditionId: "C2", criteria: "recency_days", operator: ">=", value: 4 });
      conditions.push({ conditionId: "C3", criteria: "recency_days", operator: "<=", value: 17 });
      logicalExpression = "C1 AND C2 AND C3";
      break;
    case 3:
      conditions.push({ conditionId: "C1", criteria: "orders_count", operator: "==", value: 2 });
      conditions.push({ conditionId: "C2", criteria: "recency_days", operator: ">=", value: 7 });
      conditions.push({ conditionId: "C3", criteria: "recency_days", operator: "<=", value: 17 });
      logicalExpression = "C1 AND C2 AND C3";
      break;
    case 4:
      conditions.push({ conditionId: "C1", criteria: "orders_count", operator: "==", value: 3 });
      conditions.push({ conditionId: "C2", criteria: "recency_days", operator: "<=", value: 17 });
      logicalExpression = "C1 AND C2";
      break;
    case 5:
      conditions.push({ conditionId: "C1", criteria: "orders_count", operator: "==", value: 4 });
      conditions.push({ conditionId: "C2", criteria: "recency_days", operator: "<=", value: 17 });
      logicalExpression = "C1 AND C2";
      break;
    case 6:
      conditions.push({ conditionId: "C1", criteria: "orders_count", operator: ">=", value: 5, periodDays: 30 });
      conditions.push({ conditionId: "C2", criteria: "orders_count", operator: "<=", value: 7, periodDays: 30 });
      logicalExpression = "C1 AND C2";
      break;
    case 7:
      conditions.push({ conditionId: "C1", criteria: "orders_count", operator: ">=", value: 8, periodDays: 30 });
      logicalExpression = "C1";
      break;
    default:
      // Pour les stratégies complexes ou inconnues, on met une condition par défaut (ex: orders_count >= 0)
      conditions.push({ conditionId: "C1", criteria: "orders_count", operator: ">=", value: 0 });
      logicalExpression = "C1";
      break;
  }

  return { conditions, logicalExpression };
}

async function migrate() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    
    console.log("Creating Legacy Migration Campaign...");
    let campaign = await Campaign.findOne({ name: "Migration Automatique" });
    if (!campaign) {
      campaign = new Campaign({
        name: "Migration Automatique",
        description: "Campagne contenant les anciennes stratégies SmartOffers",
        priority: 50,
        isActive: true,
      });
      await campaign.save();
    }

    console.log("Fetching legacy SmartOfferRules...");
    const oldRules = await SmartOfferRule.find({});
    
    let migratedCount = 0;

    for (const old of oldRules) {
      const existingNew = await DynamicRule.findOne({ name: old.name });
      if (existingNew) {
        console.log(`Rule ${old.name} already migrated.`);
        continue;
      }

      const { conditions, logicalExpression } = mapStrategyToConditions(old.strategyId);

      const offerConfig = {
        offerType: old.offerType,
        discountValue: old.discountValue,
        bonusThreshold: old.bonusThreshold,
        bonusPoints: old.bonusPoints,
        discountSteps: old.discountSteps,
        followupValidityDays: old.followupValidityDays,
        triggerItem: old.triggerItem,
        triggerItemSize: old.triggerItemSize,
        giftItemSize: old.giftItemSize,
        targetCategory: old.targetCategory,
        useFavoriteCategory: old.useFavoriteCategory,
        targetMenuItem: old.targetMenuItem,
        freeItem: old.freeItem,
        freeItems: old.freeItems,
        notificationTitle: old.notificationTitle,
        notificationBody: old.notificationBody,
        cooldownDays: old.cooldownDays,
        validityHours: old.validityHours,
        weight: old.priority, // Utilise la priorité comme weight par défaut pour l'offre
      };

      const newRule = new DynamicRule({
        campaign: campaign._id,
        name: old.name || `Strategy S${old.strategyId}`,
        description: `Migrated from Strategy S${old.strategyId} - Group: ${old.group}`,
        isActive: old.isActive,
        logicalExpression: logicalExpression,
        conditions: conditions,
        distributionMethod: "priority", // L'ancienne méthode
        weight: old.priority, // Poids de la règle = ancienne priorité
        offers: [offerConfig],
      });

      await newRule.save();
      migratedCount++;
    }

    console.log(`Migration completed successfully! Migrated ${migratedCount} rules.`);
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
