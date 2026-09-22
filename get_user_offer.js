require('dotenv').config();
const mongoose = require('mongoose');

const checkUserOffer = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/courteau");
        const User = require('./models/userModel');
        const user = await User.findById("6aafa9e6b350f1ea31042c31").populate('currentSmartOffer');
        
        if (user) {
            console.log("=== User Found ===");
            console.log("First Name:", user.firstName);
            console.log("Last Name:", user.lastName);
            console.log("Current Smart Offer ID:", user.currentSmartOffer ? user.currentSmartOffer._id : "None");
            if (user.currentSmartOffer) {
                console.log("Offer Type:", user.currentSmartOffer.offerType);
                console.log("Rule ID:", user.currentSmartOffer.ruleId);
                console.log("Trigger Status:", user.currentSmartOffer.triggerStatus);
            }
            if (user.smartOffersState) {
                console.log("Smart Offers State:", JSON.stringify(user.smartOffersState, null, 2));
            }
        } else {
            console.log("User not found!");
        }
    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
};

checkUserOffer();
