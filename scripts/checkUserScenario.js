const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const User = require("../models/User");
const PersonalizedOffer = require("../models/PersonalizedOffer");

async function checkUserScenario() {
  try {
    await mongoose.connect(process.env.DEV_DB_CONNECTION);
    
    // Find our test user
    const user = await User.findOne({ phone_number: "+15550000099" });
    if (!user) {
      console.log("Test user not found");
      return;
    }
    
    console.log("User:", user.name, user._id);
    
    // Find all their personalized offers
    const offers = await PersonalizedOffer.find({ user: user._id })
      .sort({ createdAt: -1 });
      
    console.log(`\nFound ${offers.length} personalized offers for this user:`);
    
    // Mettre à jour l'heure de notification à "maintenant" pour toutes les offres "prepared"
    const now = new Date();
    let updatedCount = 0;

    for (const o of offers) {
      console.log(`\n--- Offer ID: ${o._id} ---`);
      console.log(`Status: ${o.status}`);
      console.log(`Created At: ${o.createdAt}`);
      console.log(`Scheduled Notify At (Before): ${o.scheduledNotifyAt}`);
      console.log(`Expires At: ${o.expiresAt}`);
      
      if (o.status === 'prepared') {
        o.scheduledNotifyAt = now;
        await o.save();
        console.log(`✅ scheduledNotifyAt updated to NOW (${now})`);
        updatedCount++;
      }
      
      if (o.campaign) {
        console.log(`Campaign ID: ${o.campaign}`);
      }
      if (o.rule || o.dynamicRule) {
        console.log(`Rule / Offer Type: ${o.offerType}`);
      }
    }

    if (updatedCount > 0) {
      console.log(`\n✅ Successfully updated ${updatedCount} offer(s) to be notified NOW.`);
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

checkUserScenario();
