const SmartClientService = require("./smartClient.service");

class SmartClientController {
  async getAllRules(req, res) {
    try {
      const filters = {};
      if (req.query.status) {
        filters.status = req.query.status;
      }
      const rules = await SmartClientService.getAllRules(filters);
      res.status(200).json({ success: true, data: rules });
    } catch (error) {
      console.error("[SmartClientController] getAllRules error:", error);
      res.status(500).json({ success: false, message: "Erreur serveur lors de la récupération des règles." });
    }
  }

  async getRuleById(req, res) {
    try {
      const { id } = req.params;
      const rule = await SmartClientService.getRuleById(id);
      if (!rule) {
        return res.status(404).json({ success: false, message: "Règle non trouvée." });
      }
      res.status(200).json({ success: true, data: rule });
    } catch (error) {
      console.error("[SmartClientController] getRuleById error:", error);
      res.status(500).json({ success: false, message: "Erreur serveur lors de la récupération de la règle." });
    }
  }

  async createRule(req, res) {
    try {
      const payload = req.body;
      if (!payload.name) {
        return res.status(400).json({ success: false, message: "Le nom de la règle est obligatoire." });
      }

      const newRule = await SmartClientService.createRule(payload);
      res.status(201).json({ success: true, data: newRule, message: "Règle créée avec succès." });
    } catch (error) {
      console.error("[SmartClientController] createRule error:", error);
      res.status(500).json({ success: false, message: "Erreur lors de la création de la règle." });
    }
  }

  async updateRule(req, res) {
    try {
      const { id } = req.params;
      const payload = req.body;
      
      const updatedRule = await SmartClientService.updateRule(id, payload);
      if (!updatedRule) {
        return res.status(404).json({ success: false, message: "Règle non trouvée." });
      }

      res.status(200).json({ success: true, data: updatedRule, message: "Règle mise à jour avec succès." });
    } catch (error) {
      console.error("[SmartClientController] updateRule error:", error);
      res.status(500).json({ success: false, message: "Erreur lors de la mise à jour de la règle." });
    }
  }

  async deleteRule(req, res) {
    try {
      const { id } = req.params;
      const deletedRule = await SmartClientService.deleteRule(id);
      
      if (!deletedRule) {
        return res.status(404).json({ success: false, message: "Règle non trouvée." });
      }

      res.status(200).json({ success: true, message: "Règle supprimée avec succès." });
    } catch (error) {
      console.error("[SmartClientController] deleteRule error:", error);
      res.status(500).json({ success: false, message: "Erreur lors de la suppression de la règle." });
    }
  }

  async toggleRuleStatus(req, res) {
    try {
      const { id } = req.params;
      const updatedRule = await SmartClientService.toggleRuleStatus(id);
      
      res.status(200).json({ 
        success: true, 
        data: updatedRule, 
        message: `Règle ${updatedRule.isActive ? "activée" : "désactivée"} avec succès.` 
      });
    } catch (error) {
      console.error("[SmartClientController] toggleRuleStatus error:", error);
      if (error.message === "Règle introuvable") {
        return res.status(404).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: "Erreur lors du basculement du statut de la règle." });
    }
  }
}

module.exports = new SmartClientController();
