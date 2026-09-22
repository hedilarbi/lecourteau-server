const SmartClientRule = require("./smartClient.model");

class SmartClientService {
  /**
   * Get all rules, optionally filtered by status
   */
  async getAllRules(filters = {}) {
    const query = {};
    if (filters.status) {
      query.isActive = filters.status === "active";
    }
    return await SmartClientRule.find(query).sort({ weight: -1, createdAt: -1 });
  }

  /**
   * Get a single rule by ID
   */
  async getRuleById(id) {
    return await SmartClientRule.findById(id);
  }

  /**
   * Create a new rule
   */
  async createRule(payload) {
    const newRule = new SmartClientRule(payload);
    return await newRule.save();
  }

  /**
   * Update an existing rule
   */
  async updateRule(id, payload) {
    return await SmartClientRule.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
  }

  /**
   * Delete a rule
   */
  async deleteRule(id) {
    return await SmartClientRule.findByIdAndDelete(id);
  }

  /**
   * Toggle the active status of a rule
   */
  async toggleRuleStatus(id) {
    const rule = await SmartClientRule.findById(id);
    if (!rule) {
      throw new Error("Règle introuvable");
    }
    rule.isActive = !rule.isActive;
    return await rule.save();
  }
}

module.exports = new SmartClientService();
