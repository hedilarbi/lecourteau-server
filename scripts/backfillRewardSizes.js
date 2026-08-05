require("dotenv").config();
const mongoose = require("mongoose");

const Reward = require("../models/Reward");
const MenuItem = require("../models/MenuItem");

/**
 * Les récompenses créées avant l'ajout de la taille n'ont pas de champ `size`.
 * Ce script leur attribue la première taille de l'article, en évitant les
 * doublons article/taille, et signale celles qui doivent être traitées à la main.
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

  const rewards = await Reward.find({
    $or: [{ size: { $exists: false } }, { size: null }, { size: "" }],
  });

  console.log(`${rewards.length} récompense(s) sans taille.`);

  // Couples déjà pris (récompenses qui ont déjà une taille).
  const taken = new Set(
    (await Reward.find({ size: { $type: "string" } }).select("item size")).map(
      (reward) => `${reward.item}_${reward.size}`
    )
  );

  const skipped = [];
  let updated = 0;

  for (const reward of rewards) {
    const menuItem = await MenuItem.findById(reward.item).select("name prices");

    if (!menuItem) {
      skipped.push({ id: reward._id, reason: "article introuvable" });
      continue;
    }

    const availableSize = (menuItem.prices || [])
      .map((price) => price?.size)
      .filter((size) => typeof size === "string" && size.length > 0)
      .find((size) => !taken.has(`${reward.item}_${size}`));

    if (!availableSize) {
      skipped.push({
        id: reward._id,
        reason: `aucune taille libre pour "${menuItem.name}"`,
      });
      continue;
    }

    taken.add(`${reward.item}_${availableSize}`);
    updated += 1;

    console.log(
      `${shouldApply ? "MAJ" : "DRY"} ${reward._id} → ${menuItem.name} / ${availableSize}`
    );

    if (shouldApply) {
      reward.size = availableSize;
      await reward.save();
    }
  }

  console.log(`\n${updated} récompense(s) ${shouldApply ? "mises à jour" : "à mettre à jour"}.`);

  if (skipped.length > 0) {
    console.log(`${skipped.length} récompense(s) à traiter manuellement :`);
    skipped.forEach(({ id, reason }) => console.log(`  - ${id} : ${reason}`));
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
