require("dotenv").config();
const mongoose = require("mongoose");

const FREE_ITEM_STRATEGY_IDS = new Set([4, 6, 7, 14]);

const sanitizeRuleForProduction = (rule) => {
  const strategyId = Number(rule.strategyId);
  const needsFreeItemConfiguration = FREE_ITEM_STRATEGY_IDS.has(strategyId);

  return {
    name: rule.name,
    strategyId,
    segment: rule.segment,
    group: rule.group,
    priority: rule.priority,
    cooldownDays: rule.cooldownDays,
    validityHours: rule.validityHours,
    offerType: rule.offerType,
    discountValue: rule.discountValue || 0,
    bonusThreshold: rule.bonusThreshold || 0,
    bonusPoints: rule.bonusPoints || 0,
    targetCategory: null,
    targetMenuItem: null,
    freeItem: null,
    freeItems: [],
    notificationTitle: rule.notificationTitle,
    notificationBody: rule.notificationBody,
    isActive: needsFreeItemConfiguration ? false : rule.isActive !== false,
  };
};

const run = async () => {
  const shouldApply = process.argv.includes("--apply");
  const sourceUri = process.env.DEV_DB_CONNECTION;
  const targetUri = process.env.PROD_DB_CONNECTION;

  if (!sourceUri || !targetUri) {
    throw new Error("DEV_DB_CONNECTION and PROD_DB_CONNECTION are required.");
  }

  const source = mongoose.createConnection(sourceUri);
  const target = mongoose.createConnection(targetUri);

  try {
    await Promise.all([source.asPromise(), target.asPromise()]);

    const sourceRules = await source
      .collection("smartofferrules")
      .find({ strategyId: { $gte: 2, $lte: 20 } })
      .sort({ strategyId: 1 })
      .toArray();

    if (sourceRules.length !== 19) {
      throw new Error(
        `Expected 19 Smart Offer rules in development, found ${sourceRules.length}.`,
      );
    }

    const rules = sourceRules.map(sanitizeRuleForProduction);

    console.log(
      JSON.stringify(
        {
          mode: shouldApply ? "apply" : "dry-run",
          target: "production",
          rules: rules.map((rule) => ({
            strategyId: rule.strategyId,
            offerType: rule.offerType,
            cooldownDays: rule.cooldownDays,
            validityHours: rule.validityHours,
            isActive: rule.isActive,
            requiresConfiguration: FREE_ITEM_STRATEGY_IDS.has(rule.strategyId),
          })),
        },
        null,
        2,
      ),
    );

    if (!shouldApply) {
      console.log("Dry run only. Re-run with --apply to update production.");
      return;
    }

    const result = await target.collection("smartofferrules").bulkWrite(
      rules.map((rule) => ({
        updateOne: {
          filter: { strategyId: rule.strategyId },
          update: {
            $set: { ...rule, updatedAt: new Date() },
            $setOnInsert: { createdAt: new Date() },
          },
          upsert: true,
        },
      })),
      { ordered: true },
    );

    console.log(
      JSON.stringify({
        matched: result.matchedCount,
        modified: result.modifiedCount,
        upserted: result.upsertedCount,
      }),
    );
  } finally {
    await Promise.allSettled([source.close(), target.close()]);
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
