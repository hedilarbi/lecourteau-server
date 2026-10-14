const express = require("express");
const authStaff = require("../../middlewares/authStaff");
const controller = require("./smartClient.controller");
const { authClient, loadAdminScope } = require("./smartClientAuth.middleware");

const router = express.Router();
const admin = [authStaff, loadAdminScope];

// Mobile API: identity always comes from the verified client token.
router.get("/session-bundle", authClient, controller.getSessionBundle);
router.get("/client-status", authClient, controller.getClientSystemStatus);
router.post("/evaluate", authClient, controller.evaluate);
router.post("/log", authClient, controller.logEvents);
router.patch("/exposures/:id", authClient, controller.recordExposureOutcome);

// Administration API: protected and global to the Smart Client installation.
router.post("/toggle-system", ...admin, controller.toggleGlobalSystem);
router.get("/system-status", ...admin, controller.getSystemStatus);
router.get("/states/definitions", ...admin, controller.getStateDefinitions);
router.put("/states/definitions", ...admin, controller.saveStateDefinitions);
router.post("/states/definitions/reset", ...admin, controller.resetStateDefinitions);
router.get("/analytics/summary", ...admin, controller.getAnalyticsSummary);
router.get("/analytics/sessions", ...admin, controller.getAnalyticsSessions);
router.get("/analytics/sessions/:sessionId/events", ...admin, controller.getSessionEvents);
router.post("/validate", ...admin, controller.validateRule);
router.get("/", ...admin, controller.getAllRules);
router.get("/:id/versions", ...admin, controller.getRuleVersions);
router.post("/:id/versions/:version/restore", ...admin, controller.restoreRuleVersion);
router.get("/:id", ...admin, controller.getRuleById);
router.post("/", ...admin, controller.createRule);
router.put("/:id", ...admin, controller.updateRule);
router.patch("/:id/toggle", ...admin, controller.toggleRuleStatus);
router.post("/:id/duplicate", ...admin, controller.duplicateRule);
router.delete("/:id", ...admin, controller.deleteRule);

module.exports = router;
