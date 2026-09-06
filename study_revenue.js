require('dotenv').config();
const mongoose = require('mongoose');

const run = async () => {
  try {
    await mongoose.connect(process.env.DEV_DB_CONNECTION);
    const db = mongoose.connection.db;

    // 1. Total revenue from Smart Offers
    const convertedOrderStats = await db.collection('orders').aggregate([
      { $match: { personalizedOfferApplied: true, status: { $ne: "Annulé" } } },
      {
        $group: {
          _id: null,
          totalConversions: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ["$total_price", 0] } },
          totalSubtotal: { $sum: { $ifNull: ["$sub_total", 0] } },
          totalDiscountedSubtotal: { $sum: { $ifNull: ["$sub_total_after_discount", 0] } },
        },
      },
    ]).toArray();

    const revenueStats = convertedOrderStats[0] || { totalConversions: 0, totalRevenue: 0, totalSubtotal: 0, totalDiscountedSubtotal: 0 };

    // 2. Breakdown by Segment
    // To do this, we need to join orders with personalizedoffers to get strategyId, then to smartofferrules to get segment.
    const segmentStats = await db.collection('orders').aggregate([
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
          _id: "$rule.segment",
          conversions: { $sum: 1 },
          revenue: { $sum: { $ifNull: ["$total_price", 0] } },
        }
      },
      { $sort: { revenue: -1 } }
    ]).toArray();

    console.log("=== GLOBAL IMPACT ===");
    console.log(`Total Orders via Smart Offers: ${revenueStats.totalConversions}`);
    console.log(`Total Revenue (Total Price): $${revenueStats.totalRevenue.toFixed(2)}`);
    console.log(`Total Subtotal before discount: $${revenueStats.totalSubtotal.toFixed(2)}`);
    console.log(`Total Discounted Subtotal: $${revenueStats.totalDiscountedSubtotal.toFixed(2)}`);
    
    console.log("\n=== IMPACT BY SEGMENT ===");
    segmentStats.forEach(seg => {
      console.log(`Segment: ${seg._id || 'Unknown'} | Orders: ${seg.conversions} | Revenue: $${seg.revenue.toFixed(2)}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
};

run();
