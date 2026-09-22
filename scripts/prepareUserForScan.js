const mongoose = require("mongoose");
require("dotenv").config({ path: "/Users/hedilarbi/Desktop_Local/courteaux/lecourteau-server/.env" });
const User = require("../models/User");
const Order = require("../models/Order");
const PersonalizedOffer = require("../models/PersonalizedOffer");

const run = async () => {
  try {
    await mongoose.connect(process.env.DEV_DB_CONNECTION);

    const testPhone = "+15550000099";
    
    // Find the user they just created via the app
    const user = await User.findOne({ phone_number: testPhone });
    
    if (!user) {
        console.log(`❌ Utilisateur avec le téléphone ${testPhone} introuvable ! Avez-vous bien créé le compte ?`);
        process.exit(1);
    }

    // Clean up old offers so they can receive a new one on scan
    await PersonalizedOffer.deleteMany({ user: user._id });
    
    // Clean up old orders just in case
    await Order.deleteMany({ user: user._id });

    // Reset cooldowns
    user.smartOfferCooldownEndsAt = null;
    user.appIsInstalled = true; // Just in case
    // Optionally make the user account old enough if recency matters (not strictly required for Rule 25, but good for profiling)
    user.createdAt = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    await user.save();

    // Create 5 orders to satisfy orders_count >= 5, total_spent >= 10, average_basket > 20
    for(let i=0; i<5; i++) {
       await Order.create({
          user: user._id,
          sub_total: 25, 
          total_price: 25,
          status: "completed",
          createdAt: new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000)
       });
    }

    console.log(`✅ C'est fait !`);
    console.log(`L'utilisateur ${user.name || user.phone_number} a maintenant 5 commandes de 25$ dans son historique.`);
    console.log(`Son historique de récompenses a été nettoyé.`);
    console.log(`\n👉 Allez sur le Dashboard et cliquez sur "Scan Manuel" !`);

    process.exit(0);
  } catch (err) {
    console.error("Erreur:", err);
    process.exit(1);
  }
};

run();
