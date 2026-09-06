require('dotenv').config();
const mongoose = require('mongoose');

const run = async () => {
  try {
    await mongoose.connect(process.env.DEV_DB_CONNECTION);
    const db = mongoose.connection.db;

    // Helper to get stats for a date range
    const getStats = async (start, end) => {
      const stats = await db.collection('orders').aggregate([
        { 
          $match: { 
            createdAt: { $gte: start, $lt: end },
            status: { $ne: "Annulé" }
          } 
        },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            revenue: { $sum: { $ifNull: ["$total_price", 0] } }
          }
        }
      ]).toArray();
      return stats[0] || { orders: 0, revenue: 0 };
    };

    // 1. Seasonality: July 2026 vs August 2026
    const july26Stats = await getStats(new Date('2026-07-01T00:00:00Z'), new Date('2026-08-01T00:00:00Z'));
    const aug26Stats = await getStats(new Date('2026-08-01T00:00:00Z'), new Date('2026-09-01T00:00:00Z'));
    
    // July 2025 vs August 2025 (if data exists)
    const july25Stats = await getStats(new Date('2025-07-01T00:00:00Z'), new Date('2025-08-01T00:00:00Z'));
    const aug25Stats = await getStats(new Date('2025-08-01T00:00:00Z'), new Date('2025-09-01T00:00:00Z'));

    console.log("=== SEASONALITY CHECK ===");
    console.log(`July 2026: ${july26Stats.orders} orders, $${july26Stats.revenue.toFixed(2)}`);
    console.log(`August 2026: ${aug26Stats.orders} orders, $${aug26Stats.revenue.toFixed(2)}`);
    console.log(`Growth Jul->Aug 2026: ${(((aug26Stats.revenue - july26Stats.revenue)/july26Stats.revenue)*100).toFixed(2)}%`);

    if (july25Stats.orders > 0) {
      console.log(`\nJuly 2025: ${july25Stats.orders} orders, $${july25Stats.revenue.toFixed(2)}`);
      console.log(`August 2025: ${aug25Stats.orders} orders, $${aug25Stats.revenue.toFixed(2)}`);
      console.log(`Growth Jul->Aug 2025: ${(((aug25Stats.revenue - july25Stats.revenue)/july25Stats.revenue)*100).toFixed(2)}%`);
    }

    // 2. Frequency of users who used Smart Offers in August
    // Did they order more often than in July?
    const smartOfferUsers = await db.collection('orders').distinct("user", {
      createdAt: { $gte: new Date('2026-08-01T00:00:00Z'), $lt: new Date('2026-09-01T00:00:00Z') },
      personalizedOfferApplied: true,
      status: { $ne: "Annulé" }
    });

    console.log(`\nFound ${smartOfferUsers.length} users who used a Smart Offer in August.`);

    let frequencyJuly = 0;
    let frequencyAug = 0;
    
    if (smartOfferUsers.length > 0) {
      const freqJulyStats = await db.collection('orders').countDocuments({
        user: { $in: smartOfferUsers },
        createdAt: { $gte: new Date('2026-07-01T00:00:00Z'), $lt: new Date('2026-08-01T00:00:00Z') },
        status: { $ne: "Annulé" }
      });
      frequencyJuly = freqJulyStats;

      const freqAugStats = await db.collection('orders').countDocuments({
        user: { $in: smartOfferUsers },
        createdAt: { $gte: new Date('2026-08-01T00:00:00Z'), $lt: new Date('2026-09-01T00:00:00Z') },
        status: { $ne: "Annulé" }
      });
      frequencyAug = freqAugStats;
    }

    console.log(`\n=== FREQUENCY ANALYSIS FOR SMART OFFER USERS ===`);
    console.log(`Orders by these exact users in July (Before offer): ${frequencyJuly}`);
    console.log(`Orders by these exact users in August (During offer): ${frequencyAug}`);
    if (frequencyJuly > 0) {
      console.log(`Frequency Growth for exposed users: ${(((frequencyAug - frequencyJuly)/frequencyJuly)*100).toFixed(2)}%`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
};

run();
