const DynamicRule = require("../../models/DynamicRule");
const PersonalizedOffer = require("../../models/PersonalizedOffer");
const SystemStat = require("../../models/SystemStat");

// Évaluation des règles A/B Testing IA (distributionMethod "multi_armed_bandit"), toutes les
// 2 semaines : pour chaque règle, la version d'offre qui convertit le mieux est enregistrée sur
// la règle (rule.banditEvaluation). Jusqu'à l'évaluation suivante, le scan donne cette version
// gagnante dans 85 % des cas et continue de tester les autres (voir
// OfferDistributionService.handleMultiArmedBandit).
const EVALUATION_INTERVAL_DAYS = 14;
const EVALUATION_WINDOW_DAYS = 90; // seules les offres récentes comptent : les goûts évoluent
const MIN_RESOLVED_PER_OFFER = 20; // en dessous, pas assez de données pour désigner une gagnante
const LAST_RUN_KEY = "banditEvaluationLastRunAt";
const DAY_MS = 86400000;

// Offre envoyée au client et dont l'issue est connue (utilisée, expirée ou ignorée).
const RESOLVED_STATUSES = ["applied", "expired", "ignored"];

const roundRate = (value) => Math.round(value * 1000) / 10;

/** Évalue une règle : statistiques par version d'offre et version gagnante (ou null). */
async function evaluateRule(rule, now = new Date()) {
  const since = new Date(now.getTime() - EVALUATION_WINDOW_DAYS * DAY_MS);
  const counts = await PersonalizedOffer.aggregate([
    {
      $match: {
        dynamicRule: rule._id,
        isDeferredReward: { $ne: true },
        createdAt: { $gte: since },
        status: { $in: RESOLVED_STATUSES },
      },
    },
    {
      $group: {
        _id: "$offerConfigId",
        resolved: { $sum: 1 },
        used: { $sum: { $cond: [{ $eq: ["$status", "applied"] }, 1, 0] } },
      },
    },
  ]);
  const countsByConfig = new Map(counts.map((row) => [String(row._id), row]));

  const stats = rule.offers.map((offer) => {
    const row = countsByConfig.get(String(offer._id));
    const resolved = row?.resolved || 0;
    const used = row?.used || 0;
    return {
      offerConfigId: offer._id,
      offerType: offer.offerType,
      resolved,
      used,
      rate: resolved > 0 ? roundRate(used / resolved) : 0,
    };
  });

  // Une gagnante n'est désignée que si TOUTES les versions ont assez de données : sinon une
  // version peu testée perdrait (ou gagnerait) par hasard.
  const enoughData = stats.every((stat) => stat.resolved >= MIN_RESOLVED_PER_OFFER);
  const winner = enoughData
    ? stats.reduce((best, stat) => (stat.rate > best.rate ? stat : best), stats[0])
    : null;

  return {
    evaluatedAt: now,
    winnerOfferConfigId: winner ? winner.offerConfigId : null,
    stats,
  };
}

class BanditOptimizationService {
  /** Évalue toutes les règles A/B actives et enregistre la version gagnante de chacune. */
  static async optimizeRules(now = new Date()) {
    console.log("[BanditOptimizationService] Évaluation des règles A/B Testing...");
    const rules = await DynamicRule.find({
      isActive: true,
      distributionMethod: "multi_armed_bandit",
    }).lean();

    for (const rule of rules) {
      if (!rule.offers || rule.offers.length <= 1) continue;
      try {
        const evaluation = await evaluateRule(rule, now);
        await DynamicRule.updateOne({ _id: rule._id }, { $set: { banditEvaluation: evaluation } });
        const summary = evaluation.stats
          .map((stat) => `${stat.offerType} ${stat.used}/${stat.resolved} (${stat.rate}%)`)
          .join(", ");
        const winner = evaluation.stats.find(
          (stat) => String(stat.offerConfigId) === String(evaluation.winnerOfferConfigId),
        );
        console.log(
          `[BanditOptimizationService] ${rule.name} : ${
            winner ? `gagnante ${winner.offerType} (${winner.rate}%)` : "pas encore assez de données"
          } — ${summary}`,
        );
      } catch (error) {
        console.error(`[BanditOptimizationService] Règle ${rule._id} :`, error.message);
      }
    }
  }

  /**
   * Lancé chaque jour par le cron : n'évalue que si la dernière évaluation date d'au moins
   * 2 semaines (node-cron ne sait pas exprimer « toutes les 2 semaines »).
   */
  static async runIfDue(now = new Date()) {
    const lastRun = await SystemStat.findOne({ key: LAST_RUN_KEY }).lean();
    const lastRunAt = lastRun?.value ? new Date(lastRun.value) : null;
    // Marge d'une heure : le cron tourne chaque jour à la même heure.
    if (lastRunAt && now.getTime() - lastRunAt.getTime() < EVALUATION_INTERVAL_DAYS * DAY_MS - 3600000) {
      return false;
    }
    await this.optimizeRules(now);
    await SystemStat.findOneAndUpdate(
      { key: LAST_RUN_KEY },
      { key: LAST_RUN_KEY, value: now, updatedAt: now },
      { upsert: true },
    );
    return true;
  }
}

module.exports = BanditOptimizationService;
module.exports.evaluateRule = evaluateRule;
