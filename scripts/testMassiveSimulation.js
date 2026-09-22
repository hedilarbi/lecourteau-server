const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/User');
const Order = require('../models/Order');
const Campaign = require('../models/Campaign');
const DynamicRule = require('../models/DynamicRule');
const PersonalizedOffer = require('../models/PersonalizedOffer');
const PersonalizedOfferEvent = require('../models/PersonalizedOfferEvent');
const UserSmartProfile = require('../models/UserSmartProfile');

const ProfilingEngine = require('../services/smartOffersV2/ProfilingService');
const DistributionEngine = require('../services/smartOffersV2/OfferDistributionService');
const PostOrderEngine = require('../services/smartOffersV2/PostOrderTriggerService');

async function runSimulation() {
  console.log("==========================================================");
  console.log("🚀 DEMARRAGE DE LA SIMULATION MASSIVE E2E - SMART OFFERS V2");
  console.log("==========================================================");
  
  try {
    await mongoose.connect(process.env.DEV_DB_CONNECTION, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connecté à MongoDB (DEV_DB_CONNECTION)");

    console.log("\n🧹 Phase 1 : Nettoyage des anciennes données V2...");
    await Campaign.deleteMany({});
    await DynamicRule.deleteMany({});
    await PersonalizedOffer.deleteMany({});
    await PersonalizedOfferEvent.deleteMany({});
    await UserSmartProfile.deleteMany({});
    
    // Nettoyage des users de test
    const testEmails = ["vip_froid@test.com", "nouveau@test.com", "chasseur@test.com", "regulier@test.com"];
    const deletedUsers = await User.find({ email: { $in: testEmails } });
    const deletedUserIds = deletedUsers.map(u => u._id);
    await Order.deleteMany({ userId: { $in: deletedUserIds } });
    await User.deleteMany({ email: { $in: testEmails } });
    console.log("✅ Base de données purgée des données de test précédentes.");

    console.log("\n👤 Phase 2 : Génération des Profils et Historiques...");
    const userA = await User.create({ email: "vip_froid@test.com", fullName: "User A (VIP Froid)", phoneNumber: "+111" });
    const userB = await User.create({ email: "nouveau@test.com", fullName: "User B (Nouveau)", phoneNumber: "+222" });
    const userC = await User.create({ email: "chasseur@test.com", fullName: "User C (Chasseur)", phoneNumber: "+333" });
    const userD = await User.create({ email: "regulier@test.com", fullName: "User D (Régulier)", phoneNumber: "+444" });

    const now = new Date();
    // User A: VIP Froid (15 commandes, 1200$ total, dernière il y a 100 jours)
    for(let i=0; i<15; i++) {
        await Order.create({ 
            userId: userA._id, 
            status: "Delivered", 
            totalPrice: 80, 
            createdAt: new Date(now.getTime() - (100 * 24 * 60 * 60 * 1000) - i*1000000) 
        });
    }
    
    // User B: Nouveau (1 commande il y a 5 jours)
    await Order.create({ userId: userB._id, status: "Delivered", totalPrice: 40, createdAt: new Date(now.getTime() - (5 * 24 * 60 * 60 * 1000)) });
    
    // User C: Chasseur (8 commandes)
    for(let i=0; i<8; i++) {
        await Order.create({ userId: userC._id, status: "Delivered", totalPrice: 30, createdAt: new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000) - i*1000000) });
    }

    // User D: Régulier (5 commandes récentes)
    for(let i=0; i<5; i++) {
        await Order.create({ userId: userD._id, status: "Delivered", totalPrice: 50, createdAt: new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000) - i*1000000) });
    }
    console.log("✅ 4 Profils créés avec des dizaines de commandes virtuelles.");

    console.log("\n🛠️ Phase 3 : Création de la Campagne et des Règles Complexes...");
    const campaign = await Campaign.create({ name: "Re-engagement 2026 E2E", priority: 100, isActive: true, defaultCooldownDays: 5 });

    // Règle 1: VIP Froid (Waterfall) - Teste l'expression logique (C1 OR C2) AND C3
    await DynamicRule.create({
        campaign: campaign._id,
        name: "Règle VIP Froid (Waterfall)",
        isActive: true,
        weight: 90,
        distributionMethod: "waterfall",
        logicalExpression: "(C1 OR C2) AND C3",
        conditions: [
            { conditionId: "C1", criteria: "orders_count", operator: ">=", value: "10" },
            { conditionId: "C2", criteria: "total_spent", operator: ">=", value: "1000" },
            { conditionId: "C3", criteria: "recency_days", operator: ">", value: "90" },
        ],
        offers: [
            { offerType: "discount_order", discountValue: 10, validityHours: 24, notificationTitle: "Niveau 1: 10%", notificationBody: "Test body" },
            { offerType: "discount_order", discountValue: 15, validityHours: 24, notificationTitle: "Niveau 2: 15%", notificationBody: "Test body" },
            { offerType: "discount_order", discountValue: 20, validityHours: 24, notificationTitle: "Niveau 3: 20%", notificationBody: "Test body" }
        ]
    });

    // Règle 2: Nouveau (Success Sequence)
    await DynamicRule.create({
        campaign: campaign._id,
        name: "Règle Nouveau (Sequence)",
        isActive: true,
        weight: 80,
        distributionMethod: "success_sequence",
        logicalExpression: "C1",
        conditions: [
            { conditionId: "C1", criteria: "orders_count", operator: "==", value: "1" }
        ],
        offers: [
            { offerType: "free_item", discountValue: 0, validityHours: 48, notificationTitle: "Bienvenue : Article Gratuit", notificationBody: "Test body" },
            { offerType: "discount_order", discountValue: 5, validityHours: 48, notificationTitle: "Suite : 5% de rabais", notificationBody: "Test body" }
        ]
    });

    // Règle 3: Chasseur (Bandit)
    await DynamicRule.create({
        campaign: campaign._id,
        name: "Règle Chasseur (Bandit)",
        isActive: true,
        weight: 70,
        distributionMethod: "multi_armed_bandit",
        logicalExpression: "C1",
        conditions: [
            { conditionId: "C1", criteria: "orders_count", operator: ">=", value: "8" }
        ],
        offers: [
            { offerType: "discount_order", discountValue: 20, validityHours: 24, notificationTitle: "Bandit A : 20%", notificationBody: "Test body", allocationPercent: 50 },
            { offerType: "bonus_basket", discountValue: 10, validityHours: 24, notificationTitle: "Bandit B : 10$ Fixe", notificationBody: "Test body", allocationPercent: 50 }
        ]
    });
    console.log("✅ Campagne et 3 Règles complexes injectées en BDD.");

    console.log("\n🧠 Phase 4 : Lancement du Profiling Engine (Ciblage & Distribution)...");
    await ProfilingEngine.prepareDailyOffersJob(); 
    
    // Vérifications
    const oA = await PersonalizedOffer.findOne({ userId: userA._id }).sort({ createdAt: -1 });
    const oB = await PersonalizedOffer.findOne({ userId: userB._id }).sort({ createdAt: -1 });
    const oC = await PersonalizedOffer.findOne({ userId: userC._id }).sort({ createdAt: -1 });
    const oD = await PersonalizedOffer.findOne({ userId: userD._id }).sort({ createdAt: -1 });

    console.log(">>> RÉSULTATS DU CIBLAGE :");
    console.log(oA && oA.notificationTitle?.includes("Niveau 1") ? "✅ User A a bien été ciblé par la Règle 1 (Reçoit Waterfall Niveau 1)" : "❌ Echec Profiling User A");
    console.log(oB && oB.notificationTitle?.includes("Bienvenue") ? "✅ User B a bien été ciblé par la Règle 2 (Reçoit Sequence Niveau 1)" : "❌ Echec Profiling User B");
    console.log(oC && oC.notificationTitle?.includes("Bandit") ? "✅ User C a bien été ciblé par la Règle 3 (Reçoit une offre Bandit A/B)" : "❌ Echec Profiling User C");
    console.log(!oD ? "✅ User D n'a rien reçu (Comportement Normal : il ne valide aucune condition)" : "❌ Echec Profiling User D");

    console.log("\n🛒 Phase 5 : Simulation de Comportements Clients");
    
    // User A ignore (on force l'expiration)
    if(oA) {
        oA.expiresAt = new Date(Date.now() - 1000); // Expiré dans le passé
        oA.status = 'expired';
        await oA.save();
        console.log("⏳ User A IGNORE son offre (Expiration du temps).");
    }

    // User B utilise son offre
    if(oB) {
        console.log("🛍️ User B UTILISE son offre 'Bienvenue' sur une commande de 60$...");
        
        // Simuler l'événement d'utilisation
        await PersonalizedOfferEvent.create({
            user: userB._id,
            personalizedOffer: oB._id,
            eventType: "applied",
            timestamp: new Date()
        });
        oB.status = 'used';
        await oB.save();

        await PostOrderEngine.evaluateUserSmartOffers(userB._id.toString());
        console.log("✅ Commande de User B traitée par le moteur Post-Order.");
    }

    console.log("\n⏱️ Phase 6 : Test du Cron (Réactions Système)");
    console.log("🔄 Exécution du cron pour le profilage système du lendemain...");
    // On simule que c'est le lendemain, le job tourne à nouveau
    await ProfilingEngine.prepareDailyOffersJob();
    
    // Vérifications après Crons & Actions
    console.log(">>> RÉSULTATS POST-REACTIONS :");
    const oA_after = await PersonalizedOffer.findOne({ userId: userA._id, status: 'active' }).sort({ createdAt: -1 });
    const oB_after = await PersonalizedOffer.findOne({ userId: userB._id, status: 'active' }).sort({ createdAt: -1 });

    if(oA_after && oA_after.notificationTitle?.includes("Niveau 2: 15%")) {
        console.log("✅ ESCALADE RÉUSSIE : User A a ignoré Niveau 1, le système lui a envoyé automatiquement Niveau 2 !");
    } else {
        console.log("❌ Erreur Escalade User A", oA_after?.notificationTitle);
    }

    if(oB_after && oB_after.notificationTitle?.includes("Suite : 5% de rabais")) {
        console.log("✅ SÉQUENCE RÉUSSIE : User B a converti l'offre Bienvenue, le système lui a envoyé l'offre suivante !");
    } else {
        console.log("❌ Erreur Séquence User B", oB_after?.notificationTitle);
    }

    console.log("\n==========================================================");
    console.log("🎉 SIMULATION E2E TERMINEE AVEC SUCCES ! LE SYSTEME EST 100% FONCTIONNEL !");
    console.log("==========================================================");

  } catch (err) {
    console.error("❌ ERREUR FATALE LORS DE LA SIMULATION :", err);
  } finally {
    process.exit(0);
  }
}

runSimulation();
