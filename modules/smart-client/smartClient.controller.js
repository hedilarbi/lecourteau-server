const crypto = require("crypto");
const SmartClientService = require("./smartClient.service");
const SmartClientAnalyticsService = require("./smartClientAnalytics.service");
const SmartClientEligibilityService = require("./smartClientEligibility.service");
const SmartClientLog = require("./smartClientLog.model");
const SmartClientSession = require("./smartClientSession.model");
const SmartClientSetting = require("./smartClientSetting.model");
const SmartClientStateService = require("./smartClientState.service");
const SmartClientUserSnapshotService = require("./smartClientUserSnapshot.service");
const SmartClientExposure = require("./smartClientExposure.model");
const SmartClientActiveOfferService = require("./smartClientActiveOffer.service");

const sendError = (res, error, fallback) => {
  const validation = error?.name === "ValidationError" || error?.name === "StrictModeError" || error?.name === "CastError";
  const status = error.statusCode || (validation ? 400 : 500);
  return res.status(status).json({
    success: false,
    error: status === 400 ? "VALIDATION_ERROR" : status === 404 ? "NOT_FOUND" : "SERVER_ERROR",
    message: status < 500 ? error.message : fallback,
  });
};

const findSetting = async () => SmartClientSetting.findOne({});
const expireStaleActiveSessions = async () => {
  const staleSessions = await SmartClientSession.find({
    status: "active",
    lastSeenAt: { $lt: new Date(Date.now() - 90000) },
  }).lean();
  if (!staleSessions.length) return;
  const endedAt = new Date();
  const expiredSessions = (await Promise.all(staleSessions.map((session) =>
    SmartClientSession.findOneAndUpdate(
      { _id: session._id, status: "active" },
      { $set: { status: "expired", endedAt } },
      { new: true },
    ).lean()))).filter(Boolean);
  if (!expiredSessions.length) return;
  await SmartClientLog.insertMany(expiredSessions.map((session) => ({
    eventId: `terminated:${session.sessionId}:${crypto.randomUUID()}`,
    userId: session.user,
    sessionId: session.sessionId,
    event: "app_terminated",
    state: "",
    signals: {},
    payload: { inferred: true, reason: "heartbeat_timeout", lastSeenAt: session.lastSeenAt },
    timestamp: endedAt,
  })));
};

class SmartClientController {
  async getAnalyticsSummary(req, res) {
    try {
      await expireStaleActiveSessions();
      const data = await SmartClientAnalyticsService.getSummary(req.query, req.smartClientScope);
      res.json({ success: true, data });
    } catch (error) { sendError(res, error, "Erreur lors de l'agrégation Smart Client."); }
  }

  async getAnalyticsSessions(req, res) {
    try {
      await expireStaleActiveSessions();
      const data = await SmartClientAnalyticsService.getSessions(req.query, req.smartClientScope);
      res.json({ success: true, data });
    } catch (error) { sendError(res, error, "Erreur lors de l'agrégation des sessions."); }
  }

  async getSessionEvents(req, res) {
    try {
      const data = await SmartClientAnalyticsService.getSessionEvents(req.params.sessionId, req.query);
      res.json({ success: true, data });
    } catch (error) { sendError(res, error, "Erreur lors de la récupération des événements."); }
  }

  async getAllRules(req, res) {
    try {
      const data = await SmartClientService.getAllRules({ status: req.query.status }, req.smartClientScope);
      res.json({ success: true, data });
    } catch (error) { sendError(res, error, "Erreur lors de la récupération des règles."); }
  }

  async getRuleById(req, res) {
    try {
      const data = await SmartClientService.getRuleById(req.params.id, req.smartClientScope);
      if (!data) return res.status(404).json({ success: false, error: "NOT_FOUND", message: "Règle non trouvée." });
      res.json({ success: true, data });
    } catch (error) { sendError(res, error, "Erreur lors de la récupération de la règle."); }
  }

  async getRuleVersions(req, res) {
    try {
      const data = await SmartClientService.getRuleVersions(req.params.id, req.smartClientScope);
      if (!data) return res.status(404).json({ success: false, error: "NOT_FOUND", message: "Règle non trouvée." });
      res.json({ success: true, data });
    } catch (error) { sendError(res, error, "Erreur lors de la récupération de l'historique."); }
  }

  async restoreRuleVersion(req, res) {
    try {
      const data = await SmartClientService.restoreRuleVersion(req.params.id, req.params.version, req.smartClientScope);
      if (!data) return res.status(404).json({ success: false, error: "NOT_FOUND", message: "Règle non trouvée." });
      res.json({ success: true, data, message: "Version restaurée." });
    } catch (error) { sendError(res, error, "Erreur lors de la restauration de la version."); }
  }

  async createRule(req, res) {
    try {
      const data = await SmartClientService.createRule(req.body, req.smartClientScope);
      res.status(201).json({ success: true, data, message: "Règle créée avec succès." });
    } catch (error) { sendError(res, error, "Erreur lors de la création de la règle."); }
  }

  async validateRule(req, res) {
    try {
      const data = await SmartClientService.validateRulePayload(req.body, req.body?.ruleId);
      res.json({ success: true, data });
    } catch (error) { sendError(res, error, "Erreur lors de la validation de la règle."); }
  }

  async updateRule(req, res) {
    try {
      const data = await SmartClientService.updateRule(req.params.id, req.body, req.smartClientScope);
      if (!data) return res.status(404).json({ success: false, error: "NOT_FOUND", message: "Règle non trouvée." });
      res.json({ success: true, data, message: "Règle mise à jour avec succès." });
    } catch (error) { sendError(res, error, "Erreur lors de la mise à jour de la règle."); }
  }

  async deleteRule(req, res) {
    try {
      const data = await SmartClientService.deleteRule(req.params.id, req.smartClientScope);
      if (!data) return res.status(404).json({ success: false, error: "NOT_FOUND", message: "Règle non trouvée." });
      res.json({ success: true, data, message: "Règle archivée avec succès." });
    } catch (error) { sendError(res, error, "Erreur lors de l'archivage de la règle."); }
  }

  async toggleRuleStatus(req, res) {
    try {
      const data = await SmartClientService.toggleRuleStatus(req.params.id, req.smartClientScope);
      res.json({ success: true, data, message: `Règle ${data.status === "active" ? "activée" : "désactivée"}.` });
    } catch (error) { sendError(res, error, "Erreur lors du changement de statut."); }
  }

  async duplicateRule(req, res) {
    try {
      const data = await SmartClientService.duplicateRule(req.params.id, req.smartClientScope);
      if (!data) return res.status(404).json({ success: false, error: "NOT_FOUND", message: "Règle non trouvée." });
      res.status(201).json({ success: true, data, message: "Règle dupliquée en brouillon." });
    } catch (error) { sendError(res, error, "Erreur lors de la duplication."); }
  }

  logEvents(req, res) {
    const accepted = Array.isArray(req.body) ? req.body.length : 0;
    return res.status(202).json({ success: true, accepted });
  }

  async getSessionBundle(req, res) {
    try {
      const setting = await findSetting();
      const isActive = Boolean(setting?.isActive);
      const sessionId = typeof req.query.sessionId === "string" && req.query.sessionId.length <= 100 ? req.query.sessionId : crypto.randomUUID();
      const staleSessions = await SmartClientSession.find({
        user: req.user.id,
        sessionId: { $ne: sessionId },
        status: { $in: ["active", "background"] },
      }).lean();
      if (staleSessions.length) {
        await SmartClientSession.updateMany(
          { _id: { $in: staleSessions.map((session) => session._id) } },
          { $set: { status: "expired", endedAt: new Date() } },
        );
        await SmartClientLog.insertMany(staleSessions.map((session) => ({
          eventId: `terminated:${session.sessionId}:${crypto.randomUUID()}`,
          userId: req.user.id,
          sessionId: session.sessionId,
          event: "app_terminated",
          state: "",
          signals: {},
          payload: { inferred: true, lastSeenAt: session.lastSeenAt },
          timestamp: new Date(),
        })));
      }
      await SmartClientSession.findOneAndUpdate(
        { sessionId },
        { $set: { user: req.user.id, lastSeenAt: new Date(), status: "active" }, $setOnInsert: { startedAt: new Date() } },
        { upsert: true, new: true, runValidators: true },
      );
      const [activeRules, stateDefinitions, userSnapshot] = await Promise.all([
        isActive ? SmartClientService.getAllRules({ status: "active" }, {}) : [],
        SmartClientService.getStateDefinitions(),
        SmartClientUserSnapshotService.get(req.user.id),
      ]);
      const now = new Date();
      const activeOffer = await SmartClientActiveOfferService.getPersonalizedOffer(req.user.id);
      await SmartClientExposure.updateMany(
        { user: req.user.id, status: { $in: ["assigned", "displayed", "accepted"] }, expiresAt: { $ne: null, $lte: now } },
        { $set: { status: "expired" } },
      );
      const activeSmartClientExposure = isActive ? await SmartClientExposure.findOne({
        user: req.user.id,
        group: "exposed",
        status: { $in: ["displayed", "accepted"] },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      }).sort({ createdAt: -1 }).populate({ path: "rule", match: { status: "active" } }).lean() : null;
      const activeSmartClientOffer = activeSmartClientExposure?.rule ? {
        exposureId: activeSmartClientExposure._id,
        status: activeSmartClientExposure.status,
        variant: activeSmartClientExposure.variant,
        expiresAt: activeSmartClientExposure.expiresAt,
        rule: activeSmartClientExposure.rule,
      } : null;
      res.json({
        success: true,
        data: {
          schemaVersion: 2,
          sessionId,
          profile: { id: req.user.id },
          userSnapshot,
          trackingConfig: { velocityWindowMs: 2000, rawInteractionLimit: 50, maxPendingEvents: 500, flushDelayMs: 2000 },
          activeOffer,
          activeSmartClientOffer,
          activeRules,
          stateDefinitions,
          systemActive: isActive,
          serverTime: new Date(),
        },
      });
    } catch (error) { sendError(res, error, "Erreur lors de la génération du bundle."); }
  }

  async evaluate(req, res) {
    try {
      const { sessionId, event, state, location, signals } = req.body || {};
      if (!sessionId || !event) {
        const error = new Error("sessionId et event sont requis.");
        error.statusCode = 400;
        throw error;
      }
      const setting = await findSetting();
      if (!setting?.isActive) {
        return res.json({
          success: true,
          data: { eligible: false, group: null, exposureId: null, rule: null, evaluatedState: state, systemActive: false },
        });
      }
      const userSnapshot = await SmartClientUserSnapshotService.get(req.user.id);
      const enrichedSignals = SmartClientUserSnapshotService.enrichSignals(signals, userSnapshot);
      const evaluatedState = await SmartClientStateService.evaluate({ event, signals: enrichedSignals, fallbackState: state });
      const effectiveEvent = evaluatedState !== state ? "state_change" : event;
      const data = await SmartClientEligibilityService.evaluate({ userId: req.user.id, sessionId, event: effectiveEvent, state: evaluatedState, location, signals: enrichedSignals, userSnapshot });
      res.json({ success: true, data: { ...data, evaluatedState, systemActive: true } });
    } catch (error) { sendError(res, error, "Erreur lors de l'évaluation des règles."); }
  }

  async recordExposureOutcome(req, res) {
    try {
      const setting = await findSetting();
      if (!setting?.isActive) {
        return res.status(409).json({ success: false, error: "SMART_CLIENT_DISABLED", message: "Le système Smart Client est désactivé." });
      }
      const data = await SmartClientEligibilityService.recordOutcome(req.params.id, req.user.id, req.body?.status, req.body || {});
      if (!data) return res.status(404).json({ success: false, error: "NOT_FOUND", message: "Exposition non trouvée." });
      res.json({ success: true, data });
    } catch (error) { sendError(res, error, "Erreur lors de la mise à jour de l'exposition."); }
  }

  async toggleGlobalSystem(req, res) {
    try {
      const current = await findSetting();
      const data = await SmartClientSetting.findOneAndUpdate(
        {},
        { $set: { isActive: !current?.isActive, updatedBy: req.smartClientScope.staffId } },
        { upsert: true, new: true, runValidators: true },
      );
      if (!data.isActive) {
        await SmartClientExposure.updateMany(
          { status: { $in: ["assigned", "displayed", "accepted"] } },
          { $set: { status: "cancelled" } },
        );
      }
      res.json({ success: true, isActive: data.isActive });
    } catch (error) { sendError(res, error, "Erreur lors du changement de statut du système."); }
  }

  async getSystemStatus(req, res) {
    try {
      const setting = await findSetting();
      res.json({ success: true, isActive: Boolean(setting?.isActive) });
    } catch (error) { sendError(res, error, "Erreur lors de la récupération du statut."); }
  }

  async getClientSystemStatus(req, res) {
    try {
      const setting = await findSetting();
      res.json({ success: true, isActive: Boolean(setting?.isActive) });
    } catch (error) { sendError(res, error, "Erreur lors de la récupération du statut."); }
  }

  async getStateDefinitions(req, res) {
    try { res.json({ success: true, data: await SmartClientService.getStateDefinitions(req.smartClientScope) }); }
    catch (error) { sendError(res, error, "Erreur lors de la récupération des définitions."); }
  }

  async saveStateDefinitions(req, res) {
    try {
      if (!req.body?.stateId) return res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "stateId requis." });
      const data = await SmartClientService.saveStateDefinition(req.body.stateId, req.body, req.smartClientScope);
      res.json({ success: true, data });
    } catch (error) { sendError(res, error, "Erreur lors de l'enregistrement de la définition."); }
  }

  async resetStateDefinitions(req, res) {
    try { res.json({ success: true, data: await SmartClientService.resetStateDefinitions(req.smartClientScope) }); }
    catch (error) { sendError(res, error, "Erreur lors de la réinitialisation des définitions."); }
  }
}

module.exports = new SmartClientController();
