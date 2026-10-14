const express = require("express");
const router = express.Router();
const Campaign = require("../models/Campaign");
const DynamicRule = require("../models/DynamicRule");
const authStaff = require("../middlewares/authStaff");
const SmartOffersAnalyticsService = require("../services/smartOffersV2/SmartOffersAnalyticsService");

// ─── CAMPAIGNS ───
router.get("/campaigns", authStaff, async (req, res) => {
  try {
    const campaigns = await Campaign.find().sort({ priority: -1 });
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/campaigns", authStaff, async (req, res) => {
  try {
    const campaign = new Campaign(req.body);
    await campaign.save();
    
    if (campaign.isActive) {
      await Campaign.updateMany({ _id: { $ne: campaign._id } }, { isActive: false });
    }
    
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/campaigns/:id", authStaff, async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(req.params.id, req.body, { new: true });
    
    if (campaign.isActive) {
      await Campaign.updateMany({ _id: { $ne: campaign._id } }, { isActive: false });
    }
    
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/campaigns/:id", authStaff, async (req, res) => {
  try {
    await Campaign.findByIdAndDelete(req.params.id);
    // Delete associated rules
    await DynamicRule.deleteMany({ campaign: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DYNAMIC RULES ───
router.get("/rules/campaign/:campaignId", authStaff, async (req, res) => {
  try {
    const rules = await DynamicRule.find({ campaign: req.params.campaignId }).sort({ weight: -1 });
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/rules", authStaff, async (req, res) => {
  try {
    const rule = new DynamicRule(req.body);
    await rule.save();
    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/rules/:id", authStaff, async (req, res) => {
  try {
    const rule = await DynamicRule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/rules/:id", authStaff, async (req, res) => {
  try {
    await DynamicRule.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ANALYTICS (BI & MONITORING) ───
// BI & ROI (données réelles) : ?from=YYYY-MM-DD&to=YYYY-MM-DD&campaignId=&includeTests=1
router.get("/bi", authStaff, async (req, res) => {
  try {
    const { getSmartOffersBI } = require("../services/smartOffersV2/SmartOffersBIService");
    const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999-04:00`) : new Date();
    const from = req.query.from
      ? new Date(`${req.query.from}T00:00:00-04:00`)
      : new Date(to.getTime() - 30 * 86400000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      return res.status(400).json({ error: "Période invalide." });
    }
    const data = await getSmartOffersBI({
      from,
      to,
      campaignId: req.query.campaignId || null,
      includeTests: ["1", "true"].includes(String(req.query.includeTests || "")),
    });
    res.json(data);
  } catch (error) {
    console.error("[smartOffersV2/bi]", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/analytics", authStaff, async (req, res) => {
  try {
    const { campaignId } = req.query;
    const analytics = await SmartOffersAnalyticsService.getGlobalAnalytics(campaignId);
    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
