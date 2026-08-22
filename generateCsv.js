require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

const run = async () => {
  try {
    await mongoose.connect(process.env.DEV_DB_CONNECTION);
    const db = mongoose.connection.db;

    // 1. Fetch rules
    const rules = await db.collection('smartofferrules').find({}).sort({ strategyId: 1 }).toArray();
    
    const groupedMap = {};
    for (const rule of rules) {
      const key = `${rule.segment}_${rule.group}`;
      if (!groupedMap[key]) {
        groupedMap[key] = [];
      }
      groupedMap[key].push(rule);
    }

    // 2. Fetch stats for all PersonalizedOffers (Count, Views, Clicks, Applications)
    const stats = await db.collection('personalizedoffers').aggregate([
      {
        $group: {
          _id: { strategyId: "$strategyId", status: "$status" },
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const statsByStrategy = {};
    for (const stat of stats) {
      const sId = stat._id.strategyId;
      if (!statsByStrategy[sId]) {
        statsByStrategy[sId] = { total: 0, applied: 0, active: 0, viewed: 0, expired: 0, clicked: 0, prepared: 0 };
      }
      statsByStrategy[sId].total += stat.count;
      statsByStrategy[sId][stat._id.status] = (statsByStrategy[sId][stat._id.status] || 0) + stat.count;
    }

    // 3. Fetch Revenue generated from Orders using these Smart Offers
    const orderStats = await db.collection('orders').aggregate([
      {
        $match: {
          personalizedOffer: { $ne: null, $exists: true },
          status: { $nin: ["rejected", "cancelled", "pending"] } // Only successful orders
        }
      },
      {
        $lookup: {
          from: "personalizedoffers",
          localField: "personalizedOffer",
          foreignField: "_id",
          as: "po"
        }
      },
      { $unwind: "$po" },
      {
        $group: {
          _id: "$po.strategyId",
          revenue: { $sum: "$total" }
        }
      }
    ]).toArray();

    const revenueByStrategy = {};
    for (const os of orderStats) {
      if (os._id != null) {
        revenueByStrategy[os._id] = os.revenue;
      }
    }

    const getSegmentDescription = (segment) => {
      switch (segment) {
        case 'very_active': return "Actif (< 7 jours)";
        case 'normal': return "Régulier (7-15 jours)";
        case 'inactive': return "Inactif (15-30 jours)";
        case 'reactivate': return "Très inactif (> 30 jours)";
        case 'loyal': return "Fidèle";
        default: return segment;
      }
    };

    const getStrategyDescription = (rule) => {
      let desc = "";
      if (rule.offerType === "free_item") {
        desc += "Article gratuit";
        if (rule.bonusThreshold > 0) desc += ` à partir de ${rule.bonusThreshold}$`;
      } else if (rule.offerType === "discount_order") {
        desc += `Réduction de ${rule.discountValue}%`;
        if (rule.bonusThreshold > 0) desc += ` à partir de ${rule.bonusThreshold}$`;
      } else if (rule.offerType === "bonus_basket") {
        desc += "Cadeau au panier";
        if (rule.bonusThreshold > 0) desc += ` à partir de ${rule.bonusThreshold}$`;
      } else if (rule.offerType === "loyalty_points") {
        desc += `${rule.bonusPoints || 'Des'} points de fidélité`;
        if (rule.bonusThreshold > 0) desc += ` à partir de ${rule.bonusThreshold}$`;
      } else if (rule.offerType === "discount_category") {
        desc += `Réduction de ${rule.discountValue}% sur catégorie`;
        if (rule.bonusThreshold > 0) desc += ` à partir de ${rule.bonusThreshold}$`;
      } else {
        desc += rule.offerType;
      }
      return desc;
    };

    const calcConv = (st) => st.total ? ((st.applied / st.total) * 100).toFixed(2) : "0.00";

    // 4. Generate the Comparative CSV
    let csv = "\uFEFFSegment,Objectif,Ancienne_ID,Ancienne_Strategie,Ancienne_Volume_Genere,Ancienne_Offres_Converties,Ancienne_Revenu_Rapporte($),Nouvelle_ID,Nouvelle_Strategie,Nouvelle_Volume_Genere,Nouvelle_Offres_Converties,Nouvelle_Revenu_Rapporte($)\n";

    for (const [key, stratList] of Object.entries(groupedMap)) {
      if (stratList.length < 2) continue;
      
      const v1 = stratList[0];
      const latest = stratList[stratList.length - 1];
      
      const statV1 = statsByStrategy[v1.strategyId] || { total: 0, applied: 0 };
      const statLatest = statsByStrategy[latest.strategyId] || { total: 0, applied: 0 };

      const revV1 = (revenueByStrategy[v1.strategyId] || 0).toFixed(2);
      const revLatest = (revenueByStrategy[latest.strategyId] || 0).toFixed(2);

      const descV1 = getStrategyDescription(v1).replace(/"/g, '""');
      const descLatest = getStrategyDescription(latest).replace(/"/g, '""');

      const segmentDesc = getSegmentDescription(v1.segment);

      csv += `"${segmentDesc}","${v1.group}",S${v1.strategyId},"${descV1}",${statV1.total},${statV1.applied},${revV1},S${latest.strategyId},"${descLatest}",${statLatest.total},${statLatest.applied},${revLatest}\n`;
    }

    const artifactPath = '/Users/hedilarbi/.gemini/antigravity-ide/brain/d8395161-f99a-43da-909f-e307fc6e257e/smart_offers_comparatif_revenus.csv';
    fs.writeFileSync(artifactPath, csv, 'utf8');
    console.log("CSV written to " + artifactPath);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
};

run();
