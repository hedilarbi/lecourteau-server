const mongoose = require("mongoose");
const SmartClientRule = require("./smartClient.model");
const SmartClientRuleVersion = require("./smartClientRuleVersion.model");

const RULE_FIELDS = [
  "track", "ruleName", "triggerEvent", "selectedStates", "conditions", "hasProfileFilter",
  "profileConditions", "offer", "location", "validityDuration", "showTimer", "content",
  "safeguards", "status",
];

const pickRulePayload = (payload = {}) => Object.fromEntries(
  RULE_FIELDS.filter((key) => Object.prototype.hasOwnProperty.call(payload, key)).map((key) => [key, payload[key]]),
);

const snapshotRule = async (rule, action, actor) => {
  await SmartClientRuleVersion.create({
    rule: rule._id,
    version: rule.version,
    action,
    actor: actor || null,
    snapshotJson: JSON.stringify(rule.toObject({ depopulate: true })),
  });
};

class SmartClientService {
  async getAllRules(filters = {}, scope = {}) {
    const query = {};
    if (filters.status) query.status = filters.status;
    else query.status = { $ne: "archived" };
    return SmartClientRule.find(query).sort({ "safeguards.priority": -1, createdAt: -1 });
  }

  async getRuleById(id, scope = {}) {
    if (!mongoose.isValidObjectId(id)) return null;
    return SmartClientRule.findById(id);
  }

  async createRule(payload, scope = {}) {
    const clean = pickRulePayload(payload);
    clean.createdBy = scope.staffId || null;
    clean.updatedBy = scope.staffId || null;
    if (clean.status === "active") clean.publishedAt = new Date();
    const rule = await SmartClientRule.create(clean);
    await snapshotRule(rule, clean.status === "active" ? "published" : "created", scope.staffId);
    return rule;
  }

  async updateRule(id, payload, scope = {}) {
    const rule = await this.getRuleById(id, scope);
    if (!rule) return null;
    const clean = pickRulePayload(payload);
    const previousStatus = rule.status;
    rule.set(clean);
    rule.version += 1;
    rule.updatedBy = scope.staffId || null;
    if (rule.status === "active" && previousStatus !== "active") rule.publishedAt = new Date();
    await rule.save();
    const action = rule.status === "active" && previousStatus !== "active" ? "published" : "updated";
    await snapshotRule(rule, action, scope.staffId);
    return rule;
  }

  async deleteRule(id, scope = {}) {
    const rule = await this.getRuleById(id, scope);
    if (!rule) return null;
    rule.status = "archived";
    rule.archivedAt = new Date();
    rule.updatedBy = scope.staffId || null;
    rule.version += 1;
    await rule.save();
    await snapshotRule(rule, "archived", scope.staffId);
    return rule;
  }

  async toggleRuleStatus(id, scope = {}) {
    const rule = await this.getRuleById(id, scope);
    if (!rule) {
      const error = new Error("Règle introuvable");
      error.statusCode = 404;
      throw error;
    }
    rule.status = rule.status === "active" ? "inactive" : "active";
    if (rule.status === "active") rule.publishedAt = new Date();
    rule.updatedBy = scope.staffId || null;
    rule.version += 1;
    await rule.save();
    await snapshotRule(rule, rule.status === "active" ? "published" : "status_changed", scope.staffId);
    return rule;
  }

  async duplicateRule(id, scope = {}) {
    const source = await this.getRuleById(id, scope);
    if (!source) return null;
    const payload = pickRulePayload(source.toObject());
    payload.ruleName = `${source.ruleName} — copie`;
    payload.status = "draft";
    return this.createRule(payload, scope);
  }

  async getRuleVersions(id, scope = {}) {
    const rule = await this.getRuleById(id, scope);
    if (!rule) return null;
    return SmartClientRuleVersion.find({ rule: id }).sort({ version: -1 }).lean();
  }

  async restoreRuleVersion(id, version, scope = {}) {
    const rule = await this.getRuleById(id, scope);
    if (!rule) return null;
    const archivedVersion = await SmartClientRuleVersion.findOne({ rule: id, version: Number(version) }).lean();
    if (!archivedVersion) {
      const error = new Error("Version introuvable.");
      error.statusCode = 404;
      throw error;
    }
    const snapshot = JSON.parse(archivedVersion.snapshotJson);
    rule.set(pickRulePayload(snapshot));
    rule.version += 1;
    rule.updatedBy = scope.staffId || null;
    await rule.save();
    await snapshotRule(rule, "updated", scope.staffId);
    return rule;
  }

  async validateRulePayload(payload, excludeId = null) {
    const SmartClientLog = require("./smartClientLog.model");
    const clean = pickRulePayload(payload);
    const candidate = new SmartClientRule(clean);
    await candidate.validate();
    const conflictQuery = {
      status: "active",
      triggerEvent: clean.triggerEvent,
      location: clean.location,
      selectedStates: { $in: clean.selectedStates || [] },
      ...(excludeId && mongoose.isValidObjectId(excludeId) ? { _id: { $ne: excludeId } } : {}),
    };
    const [conflicts, sessions] = await Promise.all([
      SmartClientRule.find(conflictQuery).select("ruleName safeguards.priority").lean(),
      SmartClientLog.distinct("sessionId", { timestamp: { $gte: new Date(Date.now() - 7 * 86400000) } }),
    ]);
    const projectedAudience = Math.round(sessions.length * ((clean.safeguards?.triggerRate ?? 100) / 100));
    const unitCost = ["message_only", "suggest_category"].includes(clean.offer?.mechanic) ? 0 : Number(clean.offer?.value || 0);
    return {
      valid: true,
      conflicts,
      projectedAudience,
      projectedWeeklyCost: Number((projectedAudience * unitCost).toFixed(2)),
      warnings: conflicts.length ? ["Des règles actives ciblent déjà le même événement, emplacement et état."] : [],
    };
  }

  async getStateDefinitions(scope = {}) {
    const StateDef = require("./smartClientStateDefinition.model");
    let definitions = await StateDef.find({}).sort({ priority: -1 }).lean();
    const existingIds = new Set(definitions.map((item) => item.stateId));
    const missing = DEFAULT_STATE_DEFINITIONS.filter((item) => !existingIds.has(item.stateId));
    if (missing.length) {
      await StateDef.insertMany(missing);
      definitions = await StateDef.find({}).sort({ priority: -1 }).lean();
    }
    return definitions;
  }

  async saveStateDefinition(stateId, payload, scope = {}) {
    const StateDef = require("./smartClientStateDefinition.model");
    const allowed = ["criteria", "naturalLanguageRule", "questionLabel", "priority", "enabled", "minimumDurationSeconds"];
    const clean = Object.fromEntries(allowed.filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]]));
    return StateDef.findOneAndUpdate(
      { stateId },
      { $set: clean, $setOnInsert: { stateId, label: stateId } },
      { new: true, upsert: true, runValidators: true },
    );
  }

  async resetStateDefinitions(scope = {}) {
    const StateDef = require("./smartClientStateDefinition.model");
    await StateDef.deleteMany({});
    await StateDef.insertMany(DEFAULT_STATE_DEFINITIONS);
    return StateDef.find({}).sort({ priority: -1 }).lean();
  }
}

const DEFAULT_STATE_DEFINITIONS = [
  { stateId: "Frustré", label: "Frustré", icon: "😤", priority: 100, questionLabel: "Qu'est-ce qu'un client frustré ?", desc: "Le client rencontre des frictions.", criteria: { failedSearchesCount: 2, rapidClicksCount: 4, promoCodeFailed: true }, naturalLanguageRule: "Deux recherches sans résultat, quatre clics rapides ou un code promo refusé." },
  { stateId: "Sur le départ", label: "Sur le départ", icon: "🚪", priority: 90, questionLabel: "Qu'est-ce qu'un client sur le départ ?", desc: "Le client risque d'abandonner son panier.", criteria: { cartInactivitySeconds: 30, cartExitIntent: true }, naturalLanguageRule: "Inactivité panier ou intention de sortie." },
  { stateId: "Pas le moment", label: "Pas le moment", icon: "⏸️", priority: 85, desc: "Le client quitte sans panier.", criteria: { cartInactivitySeconds: 45, cartExitIntent: true }, naturalLanguageRule: "Sortie ou inactivité sans panier." },
  { stateId: "Sensible au prix", label: "Sensible au prix", icon: "🏷️", priority: 80, questionLabel: "Qu'est-ce qu'un client sensible au prix ?", desc: "Le client surveille son budget.", criteria: { itemRemovedAfterTotal: true, sizeDowngraded: true, promosConsultationsCount: 2, cartBelowHabitPct: 20, freeDeliveryProximity: 10 }, naturalLanguageRule: "Retrait après total, réduction de taille ou consultations répétées des promotions." },
  { stateId: "Indécis", label: "Indécis (Hésitant)", icon: "🤔", priority: 70, questionLabel: "Qu'est-ce qu'un client hésitant ?", desc: "Le client hésite sans valider.", criteria: { inactivitySeconds: 45, oscillationsCount: 3, optionsChangesCount: 3, productViewWindowSeconds: 120, distinctProductsViewedCount: 3, productSwitchesCount: 3, productRevisitsCount: 1 }, naturalLanguageRule: "Inactivité, changements répétés d'options ou navigation entre plusieurs articles." },
  { stateId: "Décidé", label: "Décidé", icon: "⚡", priority: 60, desc: "Le client commande rapidement.", criteria: { checkoutTimeSeconds: 25, habitualItemsOnly: true }, naturalLanguageRule: "Panier habituel et passage en caisse rapide." },
  { stateId: "Satisfait", label: "Satisfait", icon: "😊", priority: 50, desc: "Le client finalise sans friction.", criteria: { habitualItemsOnly: true }, naturalLanguageRule: "Commande finalisée sans friction." },
  { stateId: "Explorateur", label: "Explorateur", icon: "🧭", priority: 20, desc: "Le client explore plusieurs écrans.", criteria: { screensVisitedCount: 6 }, naturalLanguageRule: "Navigation étendue sans ajout au panier." },
  { stateId: "Neutre", label: "Neutre", icon: "🙂", priority: 0, desc: "Aucun signal fort détecté.", criteria: {}, naturalLanguageRule: "État par défaut." },
];

module.exports = new SmartClientService();
module.exports.pickRulePayload = pickRulePayload;
