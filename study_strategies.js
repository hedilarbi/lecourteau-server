require('dotenv').config();
const mongoose = require('mongoose');

const run = async () => {
  try {
    await mongoose.connect(process.env.DEV_DB_CONNECTION);
    const db = mongoose.connection.db;

    // Join orders with personalizedoffers to get strategyId
    const strategyStats = await db.collection('orders').aggregate([
      { $match: { personalizedOfferApplied: true, status: { $ne: "Annulé" } } },
      {
        $lookup: {
          from: "personalizedoffers",
          localField: "personalizedOffer",
          foreignField: "_id",
          as: "offer"
        }
      },
      { $unwind: "$offer" },
      {
        $lookup: {
          from: "smartofferrules",
          localField: "offer.rule",
          foreignField: "_id",
          as: "rule"
        }
      },
      { $unwind: { path: "$rule", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$rule.strategyId",
          segment: { $first: "$rule.segment" },
          goal: { $first: "$rule.group" },
          offerType: { $first: "$rule.offerType" },
          conversions: { $sum: 1 },
          revenue: { $sum: { $ifNull: ["$total_price", 0] } },
          subtotal: { $sum: { $ifNull: ["$sub_total", 0] } },
          discountedSubtotal: { $sum: { $ifNull: ["$sub_total_after_discount", 0] } },
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();

    // Get total offers generated per strategy to calculate true conversion rate
    const totalOffers = await db.collection('personalizedoffers').aggregate([
      {
        $group: {
          _id: "$strategyId",
          total: { $sum: 1 }
        }
      }
    ]).toArray();

    const totalOffersMap = {};
    totalOffers.forEach(t => totalOffersMap[t._id] = t.total);

    console.log("=== STRATEGY ANALYSIS ===");
    strategyStats.forEach(stat => {
      const sId = stat._id || "Unknown";
      const totalGen = totalOffersMap[sId] || 0;
      const convRate = totalGen > 0 ? ((stat.conversions / totalGen) * 100).toFixed(2) : 0;
      const avgBasket = (stat.revenue / stat.conversions).toFixed(2);
      const discountCost = (stat.subtotal - stat.discountedSubtotal).toFixed(2);
      const roi = discountCost > 0 ? (stat.revenue / discountCost).toFixed(2) : "Infinite";

      console.log(`\nS${sId} | Segment: ${stat.segment} | Goal: ${stat.goal} | Type: ${stat.offerType}`);
      console.log(`- Conversions: ${stat.conversions} (Rate: ${convRate}% out of ${totalGen})`);
      console.log(`- Revenue: $${stat.revenue.toFixed(2)} (Avg Basket: $${avgBasket})`);
      console.log(`- Discount Cost: $${discountCost} (ROI: $${roi} revenue per $1 discount)`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
};

run();
