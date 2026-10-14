require("dotenv/config");
const mongoose = require("mongoose");
const User = require("../models/User");

// Usage : node scripts/initializeEmailVerified.js [--apply]
// Sans --apply, affiche seulement la base ciblée et le nombre de comptes concernés.
const run = async () => {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(process.env.DEV_DB_CONNECTION);
  const filter = { emailVerified: { $exists: false } };
  const [total, missing] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments(filter),
  ]);
  console.log(
    `Base : ${mongoose.connection.host}/${mongoose.connection.name} — ${total} utilisateur(s), ${missing} sans emailVerified.`,
  );

  if (!apply) {
    console.log("Aucune écriture (ajoutez --apply pour initialiser).");
  } else {
    const result = await User.updateMany(filter, {
      $set: { emailVerified: false, emailVerifiedAt: null },
    });
    console.log(`${result.modifiedCount} utilisateur(s) initialisé(s) à emailVerified=false.`);
  }
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
