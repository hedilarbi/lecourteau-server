const cron = require("node-cron");
const { prepareDailyOffersJob } = require("../services/smartOffersV2/ProfilingService");
const { sendSplitExpiryRemindersJob } = require("../services/smartOffersV2/SplitDiscountNotificationService");
const BanditOptimizationService = require("../services/smartOffersV2/BanditOptimizationService");

const DEFAULT_TIMEZONE = "America/Toronto";

// Remplace le scan nocturne V1 (voir jobs/personalizedOfferCron.job.js) : matching des
// Campaign/DynamicRule actives (V2) uniquement, plus aucune dépendance à SmartOfferRule.
// L'activation/expiration/rappel des offres déjà créées reste gérée par les jobs génériques
// de personalizedOfferCron.job.js (partagés entre offres V1 historiques et V2).
function startSmartOffersV2Jobs() {
  cron.schedule("0 0 * * *", async () => { await prepareDailyOffersJob(); }, { timezone: DEFAULT_TIMEZONE });
  cron.schedule("*/15 * * * *", async () => { await sendSplitExpiryRemindersJob(); }, { timezone: DEFAULT_TIMEZONE });
  // A/B Testing IA : vérifié chaque nuit avant le scan, l'évaluation n'a lieu que toutes les 2 semaines.
  cron.schedule("30 23 * * *", async () => {
    try {
      await BanditOptimizationService.runIfDue();
    } catch (error) {
      console.error("[smartOffersV2Jobs] Évaluation A/B Testing :", error.message);
    }
  }, { timezone: DEFAULT_TIMEZONE });

  console.log("[smartOffersV2Jobs] ✅ Scan (V2, DynamicRule/Campaign): 00:00 (America/Toronto) — évaluation A/B Testing toutes les 2 semaines (23:30)");
}

module.exports = { startSmartOffersV2Jobs };
