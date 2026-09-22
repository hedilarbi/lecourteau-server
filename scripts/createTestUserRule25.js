const mongoose = require("mongoose");
require("dotenv").config();

const User = require("../models/User");
const Order = require("../models/Order");
const DynamicRule = require("../models/DynamicRule");
const ProfilingService = require("../services/smartOffersV2/ProfilingService");
const PersonalizedOffer = require("../models/PersonalizedOffer");

const run = async () => {
  try {
    await mongoose.connect(process.env.DEV_DB_CONNECTION);

    // 1. Fix Rule 25 (add conditionId 'C3' if missing)
    const rule25 = await DynamicRule.findOne({ name: "Règle Complexe 25" });
    if (rule25) {
       let updated = false;
       for (let i=0; i<rule25.conditions.length; i++) {
          if (!rule25.conditions[i].conditionId) {
             rule25.conditions[i].conditionId = `C${i+1}`;
             updated = true;
          }
       }
       if (updated) {
          await rule25.save();
          console.log("✅ Rule 25 fixed (added missing conditionIds)");
       }
    }

    const testEmail = "testrule25_final@complex.com";
    const testPhone = "+15550000099";
    
    // Clean old
    const old = await User.findOne({ email: testEmail });
    if (old) {
      await PersonalizedOffer.deleteMany({ user: old._id });
      await Order.deleteMany({ user: old._id });
      await User.deleteOne({ _id: old._id });
    }

    const user = await User.create({
      name: "Test Rule 25 Final",
      email: testEmail,
      phone_number: testPhone,
      appIsInstalled: true,
      createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    });

    // Create 5 orders to satisfy orders_count >= 5, total_spent >= 10, average_basket > 20
    for(let i=0; i<5; i++) {
       await Order.create({
          user: user._id,
          sub_total: 25, // total_spent will be 125, average_basket will be 25
          total_price: 25,
          status: "completed",
          createdAt: new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000)
       });
    }

    console.log(`✅ User créé :`);
    console.log(`Email : ${testEmail}`);
    console.log(`Téléphone : ${testPhone}`);
    console.log(`5 commandes de 25$ ont été créées (Total spent = 125$, average_basket = 25, orders_count = 5)`);

    console.log("⚙️ Lancement du Profiling (Batch)...");
    await ProfilingService.prepareDailyOffersJob({ isManualTrigger: true, forceExecution: true });

    const po = await PersonalizedOffer.findOne({ user: user._id }).populate('dynamicRule').lean();
    if (po && po.dynamicRule) {
      console.log(`🎉 Succès ! L'utilisateur a reçu l'offre de la règle : ${po.dynamicRule.name}`);
    } else {
      console.log(`❌ L'utilisateur n'a reçu aucune offre.`);
    }

    process.exit(0);
  } catch (err) {
    console.error("Erreur:", err);
    process.exit(1);
  }
};

run();
