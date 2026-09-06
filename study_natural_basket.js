require('dotenv').config();
const mongoose = require('mongoose');

const run = async () => {
  try {
    await mongoose.connect(process.env.DEV_DB_CONNECTION);
    const db = mongoose.connection.db;

    // Get natural average basket (orders without smart offers)
    const naturalBasketStats = await db.collection('orders').aggregate([
      { 
        $match: { 
          personalizedOfferApplied: false, 
          status: { $ne: "Annulé" },
          createdAt: { $gte: new Date('2026-06-01T00:00:00Z') } // last 3 months
        } 
      },
      {
        $lookup: {
          from: "usersmartprofiles",
          localField: "user",
          foreignField: "user",
          as: "profile"
        }
      },
      { $unwind: { path: "$profile", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: "$profile.segment",
          avgBasket: { $avg: { $ifNull: ["$total_price", 0] } },
          totalOrders: { $sum: 1 }
        }
      }
    ]).toArray();

    console.log("=== NATURAL AVERAGE BASKET (NO OFFERS) ===");
    naturalBasketStats.forEach(stat => {
      console.log(`Segment: ${stat._id} | Orders: ${stat.totalOrders} | Avg Basket: $${stat.avgBasket.toFixed(2)}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
};

run();
