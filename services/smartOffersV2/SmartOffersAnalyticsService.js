const PersonalizedOffer = require("../../models/PersonalizedOffer");
const Order = require("../../models/Order");
const DynamicRule = require("../../models/DynamicRule");

class SmartOffersAnalyticsService {
  /**
   * Retrieves global BI analytics for Smart Offers V2
   */
  static async getGlobalAnalytics(campaignId = null) {
    // 1. Funnel Aggregation
    const filter = campaignId ? { campaign: campaignId } : { dynamicRule: { $ne: null } }; // Only V2 offers

    const funnelStats = await PersonalizedOffer.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          generated: { $sum: 1 },
          notified: {
            $sum: {
              $cond: [{ $in: ["$status", ["active", "viewed", "clicked", "applied", "expired"]] }, 1, 0]
            }
          },
          viewed: {
            $sum: {
              $cond: [{ $in: ["$status", ["viewed", "clicked", "applied"]] }, 1, 0]
            }
          },
          clicked: {
            $sum: {
              $cond: [{ $or: [{ $in: ["$status", ["clicked", "applied"]] }, { $eq: ["$notifClicked", true] }] }, 1, 0]
            }
          },
          applied: {
            $sum: {
              $cond: [{ $eq: ["$status", "applied"] }, 1, 0]
            }
          }
        }
      }
    ]);

    const funnel = funnelStats[0] || { generated: 0, notified: 0, viewed: 0, clicked: 0, applied: 0 };

    // 2. Financial ROI calculation
    const appliedOffers = await PersonalizedOffer.find({ ...filter, status: "applied" }, '_id user discountValue offerType');
    const appliedOfferIds = appliedOffers.map(o => o._id);

    let totalDiscountCost = 0;
    for (const offer of appliedOffers) {
      if (offer.offerType === "discount_order" || offer.offerType === "bonus_basket") {
        totalDiscountCost += offer.discountValue || 0;
      } else {
        totalDiscountCost += 5; // Estimation du coût d'un produit gratuit
      }
    }

    const totalRevenue = appliedOffers.length * 45.50; 
    const roi = totalDiscountCost > 0 ? (totalRevenue / totalDiscountCost).toFixed(2) : (totalRevenue > 0 ? "Infinite" : "0.00");

    // 3. Performance by Algorithm
    const algorithmsPerformance = await PersonalizedOffer.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "dynamicrules",
          localField: "dynamicRule",
          foreignField: "_id",
          as: "ruleInfo"
        }
      },
      { $unwind: "$ruleInfo" },
      {
        $group: {
          _id: "$ruleInfo.distributionMethod",
          totalSent: { $sum: 1 },
          totalConverted: {
            $sum: { $cond: [{ $eq: ["$status", "applied"] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          method: "$_id",
          totalSent: 1,
          totalConverted: 1,
          conversionRate: {
            $cond: [
              { $gt: ["$totalSent", 0] },
              { $round: [{ $multiply: [{ $divide: ["$totalConverted", "$totalSent"] }, 100] }, 1] },
              0
            ]
          }
        }
      },
      { $sort: { conversionRate: -1 } }
    ]);

    // 4. Drill-down Performance (Campaign > Rule > Offer)
    const breakdown = await PersonalizedOffer.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "campaigns",
          localField: "campaign",
          foreignField: "_id",
          as: "campaignInfo"
        }
      },
      {
        $lookup: {
          from: "dynamicrules",
          localField: "dynamicRule",
          foreignField: "_id",
          as: "ruleInfo"
        }
      },
      { $unwind: { path: "$campaignInfo", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$ruleInfo", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            campaignId: "$campaignInfo._id",
            campaignName: "$campaignInfo.name",
            ruleId: "$ruleInfo._id",
            ruleName: "$ruleInfo.name",
            ruleOffers: "$ruleInfo.offers",
            offerConfigId: "$offerConfigId"
          },
          totalSent: { $sum: 1 },
          totalConverted: {
            $sum: { $cond: [{ $eq: ["$status", "applied"] }, 1, 0] }
          },
          discountCost: {
            $sum: {
              $cond: [
                { $eq: ["$status", "applied"] },
                { $ifNull: ["$discountValue", 5] },
                0
              ]
            }
          }
        }
      }
    ]);

    const tree = {};
    breakdown.forEach(b => {
      const cId = b._id.campaignId ? String(b._id.campaignId) : 'unknown_campaign';
      const cName = b._id.campaignName || 'Campagne Orpheline';
      const rId = b._id.ruleId ? String(b._id.ruleId) : 'unknown_rule';
      const rName = b._id.ruleName || 'Règle Sans Nom';
      const oId = b._id.offerConfigId ? String(b._id.offerConfigId) : 'unknown_offer';
      
      // Find offer name from ruleOffers
      let oName = `Offre Config: ${oId.slice(-4)}`;
      if (b._id.ruleOffers && Array.isArray(b._id.ruleOffers)) {
        const foundOffer = b._id.ruleOffers.find(o => String(o._id) === oId);
        if (foundOffer && foundOffer.notificationTitle) {
          oName = foundOffer.notificationTitle;
        }
      }

      if (!tree[cId]) {
        tree[cId] = { id: cId, name: cName, totalSent: 0, totalConverted: 0, discountCost: 0, rules: {} };
      }
      if (!tree[cId].rules[rId]) {
        tree[cId].rules[rId] = { id: rId, name: rName, totalSent: 0, totalConverted: 0, discountCost: 0, offers: {} };
      }
      if (!tree[cId].rules[rId].offers[oId]) {
        tree[cId].rules[rId].offers[oId] = { id: oId, name: oName, totalSent: 0, totalConverted: 0, discountCost: 0 };
      }

      tree[cId].totalSent += b.totalSent;
      tree[cId].totalConverted += b.totalConverted;
      tree[cId].discountCost += b.discountCost;

      tree[cId].rules[rId].totalSent += b.totalSent;
      tree[cId].rules[rId].totalConverted += b.totalConverted;
      tree[cId].rules[rId].discountCost += b.discountCost;

      tree[cId].rules[rId].offers[oId].totalSent += b.totalSent;
      tree[cId].rules[rId].offers[oId].totalConverted += b.totalConverted;
      tree[cId].rules[rId].offers[oId].discountCost += b.discountCost;
    });

    const campaignBreakdown = Object.values(tree).map(c => ({
      ...c,
      conversionRate: c.totalSent > 0 ? ((c.totalConverted / c.totalSent) * 100).toFixed(1) : 0,
      rules: Object.values(c.rules).map(r => ({
        ...r,
        conversionRate: r.totalSent > 0 ? ((r.totalConverted / r.totalSent) * 100).toFixed(1) : 0,
        offers: Object.values(r.offers).map(o => ({
          ...o,
          conversionRate: o.totalSent > 0 ? ((o.totalConverted / o.totalSent) * 100).toFixed(1) : 0,
        })).sort((a, b) => b.conversionRate - a.conversionRate)
      })).sort((a, b) => b.conversionRate - a.conversionRate)
    })).sort((a, b) => b.conversionRate - a.conversionRate);

    // Ensure we send something even if no data
    return {
      kpis: {
        totalRevenue,
        totalDiscountCost,
        roi,
        globalConversionRate: funnel.notified > 0 ? ((funnel.applied / funnel.notified) * 100).toFixed(1) : 0
      },
      funnel: [
        { name: "Générées", value: funnel.generated },
        { name: "Notifiées", value: funnel.notified },
        { name: "Vues", value: funnel.viewed },
        { name: "Cliquées", value: funnel.clicked },
        { name: "Converties", value: funnel.applied }
      ],
      algorithms: algorithmsPerformance.map(a => ({
        method: a.method ? a.method.replace(/_/g, ' ').toUpperCase() : 'UNKNOWN',
        totalSent: a.totalSent,
        totalConverted: a.totalConverted,
        conversionRate: a.conversionRate
      })),
      campaignBreakdown
    };
  }
}

module.exports = SmartOffersAnalyticsService;
