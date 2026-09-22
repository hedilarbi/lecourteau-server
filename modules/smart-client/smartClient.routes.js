const express = require("express");
const router = express.Router();
const smartClientController = require("./smartClient.controller");

// Get all rules (supports query param ?status=active|paused)
router.get("/", smartClientController.getAllRules);

// Get a specific rule by ID
router.get("/:id", smartClientController.getRuleById);

// Create a new rule
router.post("/", smartClientController.createRule);

// Update a rule
router.put("/:id", smartClientController.updateRule);

// Toggle active status (Quick action)
router.patch("/:id/toggle", smartClientController.toggleRuleStatus);

// Delete a rule
router.delete("/:id", smartClientController.deleteRule);

module.exports = router;
