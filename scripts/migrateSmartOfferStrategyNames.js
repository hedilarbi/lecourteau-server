require("dotenv").config();
const mongoose = require("mongoose");

const STRATEGY_NAMES = new Map([
  [2, "Installer l'habitude de la 2e commande"],
  [3, "Consolider l'habitude de la 3e commande"],
  [4, "Faire franchir le cap de la 4e commande"],
  [5, "Transformer en client fidèle à la 5e commande"],
  [6, "Entretenir la fidélité active"],
  [7, "Reconnaître les clients VIP"],
  [8, "Prévenir le décrochage selon la cadence"],
  [9, "Récupérer les nouveaux clients abandonnés"],
  [10, "Récupérer les nouveaux clients en abandon prolongé"],
  [11, "Récupérer les nouveaux clients en abandon ancien"],
  [12, "Dernière tentative de récupération des nouveaux clients"],
  [13, "Développer les petits paniers"],
  [14, "Faire progresser les paniers intermédiaires"],
  [15, "Faire progresser les grands paniers"],
  [16, "Valoriser les très grands paniers"],
  [17, "Renforcer l'affinité avec la catégorie favorite"],
  [18, "Développer la découverte de nouvelles catégories"],
  [19, "Réactiver après un arrêt soudain"],
  [20, "Réactiver les clients à faible fréquence au bon moment"],
]);

const run = async () => {
  const uri = process.env.DEV_DB_CONNECTION;
  if (!uri) throw new Error("DEV_DB_CONNECTION is required.");

  const connection = await mongoose.createConnection(uri).asPromise();
  try {
    const collection = connection.collection("smartofferrules");
    const sourceS9 = await collection.findOne({ strategyId: 9 });
    if (!sourceS9) throw new Error("S09 is required to initialize S19 and S20.");

    const now = new Date();
    const operations = [...STRATEGY_NAMES].map(([strategyId, name]) => {
      const isNewReactivationStrategy = strategyId === 19 || strategyId === 20;
      const base = isNewReactivationStrategy
        ? {
            segment: "normal",
            group: "REACTIVATION",
            priority: 99,
            cooldownDays: strategyId === 19 ? 14 : 30,
            validityHours: sourceS9.validityHours,
            offerType: sourceS9.offerType,
            discountValue: sourceS9.discountValue || 0,
            bonusThreshold: sourceS9.bonusThreshold || 0,
            bonusPoints: sourceS9.bonusPoints || 0,
            targetCategory: null,
            targetMenuItem: null,
            freeItem: null,
            freeItems: [],
            notificationTitle: strategyId === 19
              ? "🍟 Tu nous manques ! Une offre t'attend pour ton retour."
              : "👋 Le bon moment pour revenir chez Courteau.",
            notificationBody: "Profite de ton offre personnalisée sur ta prochaine commande.",
            isActive: true,
          }
        : {};

      return {
        updateOne: {
          filter: { strategyId },
          update: {
            $set: { name, ...base, updatedAt: now },
            $setOnInsert: { strategyId, createdAt: now },
          },
          upsert: isNewReactivationStrategy,
        },
      };
    });

    const result = await collection.bulkWrite(operations, { ordered: true });
    console.log(JSON.stringify({
      matched: result.matchedCount,
      modified: result.modifiedCount,
      upserted: result.upsertedCount,
    }));
  } finally {
    await connection.close();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
