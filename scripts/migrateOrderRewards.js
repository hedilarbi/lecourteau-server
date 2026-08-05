require("dotenv").config();
const mongoose = require("mongoose");

const Reward = require("../models/Reward");

/**
 * Avant l'ajout des tailles/personnalisations, `Order.rewards` était un simple
 * tableau d'ObjectId de récompenses. Le schéma attend maintenant des
 * sous-documents { reward, item, size, customizations, points, extraPrice }.
 *
 * Sans cette migration, Mongoose échoue à hydrater les anciennes commandes.
 * On travaille volontairement sur la collection brute pour ne pas dépendre
 * du schéma pendant la conversion.
 *
 * Lecture seule par défaut, ajouter --apply pour écrire.
 */
const run = async () => {
  const shouldApply = process.argv.includes("--apply");
  const uri = process.env.DEV_DB_CONNECTION;

  if (!uri) {
    throw new Error("DEV_DB_CONNECTION is required.");
  }

  await mongoose.connect(uri);
  const orders = mongoose.connection.collection("orders");

  // Ancien format : le premier élément du tableau est un ObjectId nu.
  const legacyOrders = await orders
    .find({ "rewards.0": { $type: "objectId" } })
    .toArray();

  console.log(`${legacyOrders.length} commande(s) au format historique.`);

  const rewardDocuments = await Reward.find().select("item size points");
  const rewardsById = new Map(
    rewardDocuments.map((document) => [String(document._id), document])
  );

  let converted = 0;
  const orphans = [];

  for (const order of legacyOrders) {
    const nextRewards = (order.rewards || []).map((rewardId) => {
      const rewardDocument = rewardsById.get(String(rewardId));

      if (!rewardDocument) {
        // Récompense supprimée depuis : on garde la référence, sans détail.
        orphans.push({ order: order._id, reward: rewardId });
        return {
          reward: rewardId,
          item: null,
          size: "",
          customizations: [],
          points: 0,
          extraPrice: 0,
          comment: "",
        };
      }

      return {
        reward: rewardDocument._id,
        item: rewardDocument.item || null,
        size: rewardDocument.size || "",
        customizations: [],
        points: Number(rewardDocument.points) || 0,
        extraPrice: 0,
        comment: "",
      };
    });

    converted += 1;
    console.log(
      `${shouldApply ? "MAJ" : "DRY"} ${order._id} → ${nextRewards.length} récompense(s)`
    );

    if (shouldApply) {
      await orders.updateOne(
        { _id: order._id },
        { $set: { rewards: nextRewards } }
      );
    }
  }

  console.log(
    `\n${converted} commande(s) ${shouldApply ? "converties" : "à convertir"}.`
  );

  if (orphans.length > 0) {
    console.log(
      `${orphans.length} référence(s) vers une récompense supprimée (points remis à 0) :`
    );
    orphans.forEach(({ order, reward }) =>
      console.log(`  - commande ${order} / récompense ${reward}`)
    );
  }

  if (!shouldApply) {
    console.log("\nRelancer avec --apply pour appliquer les changements.");
  }

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
