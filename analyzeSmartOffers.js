require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

const run = async () => {
  try {
    await mongoose.connect(process.env.DEV_DB_CONNECTION);
    const db = mongoose.connection.db;

    // 1. Fetch all SmartOfferRules
    const rules = await db.collection('smartofferrules').find({}).sort({ strategyId: 1 }).toArray();
    
    const strategiesMap = {};
    const groupedMap = {};
    
    for (const rule of rules) {
      strategiesMap[rule.strategyId] = rule;
      
      const key = `${rule.segment}_${rule.group}`;
      if (!groupedMap[key]) {
        groupedMap[key] = [];
      }
      groupedMap[key].push(rule);
    }

    // 2. Fetch stats for all PersonalizedOffers
    const stats = await db.collection('personalizedoffers').aggregate([
      {
        $group: {
          _id: { strategyId: "$strategyId", status: "$status", offerType: "$offerType" },
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

    // Helpers
    const calcConv = (st) => st.total ? ((st.applied / st.total) * 100).toFixed(2) : "0.00";
    const calcEngage = (st) => st.total ? (((st.applied + st.viewed + st.clicked) / st.total) * 100).toFixed(2) : "0.00";

    // 3. Generate Markdown Report
    let md = "# Étude de Performance des Stratégies Smart Offers\n\n";
    md += "Cette étude est divisée en deux parties : la comparaison d'évolution (V1 vs Version Actuelle) et les performances détaillées de chaque stratégie individuelle (S2 à S18).\n\n";

    md += "> [!NOTE]\n";
    md += "> - **Taux de Conversion** = (Offres Appliquées / Total des offres générées) * 100\n";
    md += "> - **Taux d'Engagement** = ((Offres Vues + Clics + Appliquées) / Total) * 100\n\n";

    // --- SECTION 1: COMPARISON ---
    md += "## 📈 1. Comparaison V1 vs Dernière Version\n\n";
    for (const [key, stratList] of Object.entries(groupedMap)) {
      if (stratList.length < 2) continue; // Compare only if we have multiple versions
      
      const v1 = stratList[0];
      const latest = stratList[stratList.length - 1];
      
      const statV1 = statsByStrategy[v1.strategyId] || { total: 0, applied: 0, viewed: 0, clicked: 0, expired: 0 };
      const statLatest = statsByStrategy[latest.strategyId] || { total: 0, applied: 0, viewed: 0, clicked: 0, expired: 0 };

      const convV1 = calcConv(statV1);
      const convLatest = calcConv(statLatest);
      const diffConv = (parseFloat(convLatest) - parseFloat(convV1)).toFixed(2);
      const diffConvSign = diffConv > 0 ? `+${diffConv}` : diffConv;

      const engageV1 = calcEngage(statV1);
      const engageLatest = calcEngage(statLatest);
      const diffEngage = (parseFloat(engageLatest) - parseFloat(engageV1)).toFixed(2);
      const diffEngageSign = diffEngage > 0 ? `+${diffEngage}` : diffEngage;

      md += `### Segment: ${v1.segment.toUpperCase()} | Objectif: ${v1.group}\n\n`;
      md += `| Métrique | V1 (S${v1.strategyId}) | Dernière Version (S${latest.strategyId}) | Évolution |\n`;
      md += `|---|---|---|---|\n`;
      md += `| **Type d'offre** | \`${v1.offerType}\` | \`${latest.offerType}\` | - |\n`;
      md += `| **Volume Total** | ${statV1.total} | ${statLatest.total} | - |\n`;
      md += `| **Offres Appliquées** | ${statV1.applied} | ${statLatest.applied} | - |\n`;
      md += `| **Taux de Conversion** | **${convV1}%** | **${convLatest}%** | ${diffConvSign > 0 ? '🟢' : (diffConvSign < 0 ? '🔴' : '⚪')} ${diffConvSign}% |\n`;
      md += `| **Taux d'Engagement** | **${engageV1}%** | **${engageLatest}%** | ${diffEngageSign > 0 ? '🟢' : (diffEngageSign < 0 ? '🔴' : '⚪')} ${diffEngageSign}% |\n\n`;
    }

    // --- SECTION 2: FLAT TABLE ---
    md += "---\n\n## 📊 2. Performances individuelles (Toutes les Stratégies)\n\n";
    md += "| Stratégie | Segment | Objectif | Type d'Offre | Volume | Vues | Clics | Appliquées | Taux d'Engagement | Taux de Conversion |\n";
    md += "|---|---|---|---|---|---|---|---|---|---|\n";

    const strategyIds = Object.keys(statsByStrategy).map(Number).sort((a, b) => a - b);
    
    for (const sId of strategyIds) {
      const rule = strategiesMap[sId] || { segment: "Inconnu", group: "Inconnu", offerType: "Inconnu" };
      const st = statsByStrategy[sId];
      
      const conv = calcConv(st);
      const engage = calcEngage(st);

      md += `| **S${sId}** | ${rule.segment} | ${rule.group} | \`${rule.offerType}\` | ${st.total} | ${st.viewed} | ${st.clicked} | ${st.applied} | **${engage}%** | **${conv}%** |\n`;
    }

    // Write to brain artifact
    const artifactPath = '/Users/hedilarbi/.gemini/antigravity-ide/brain/d8395161-f99a-43da-909f-e307fc6e257e/etude_smart_offers.md';
    fs.writeFileSync(artifactPath, md);
    console.log("Analysis written to " + artifactPath);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
};

run();
