require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");
const PersonalizedOffer = require("./models/PersonalizedOffer");
const Category = require("./models/Category");
const MenuItem = require("./models/MenuItem");
const SmartOfferRule = require("./models/SmartOfferRule");

async function createTestOffer() {
  try {
    const dbUrl = process.env.DEV_DB_CONNECTION || process.env.DB_CONNECTION || process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error("❌ ERREUR: Aucune variable de connexion BD (DEV_DB_CONNECTION / DB_CONNECTION) trouvée dans .env");
      process.exit(1);
    }

    await mongoose.connect(dbUrl);
    console.log("🔗 Connecté à la base de données MongoDB...");

    const phoneArg = process.argv[2] || "8196929494";
    const offerType = process.argv[3] || "bonus_basket";

    // Trouver l'utilisateur par téléphone
    const user = await User.findOne({
      $or: [
        { phone_number: { $regex: phoneArg } },
        { phone_number: "+1" + phoneArg },
        { phone_number: phoneArg }
      ]
    });

    if (!user) {
      console.log(`❌ Utilisateur avec le numéro "${phoneArg}" introuvable en base.`);
      process.exit(1);
    }

    console.log(`👤 Utilisateur trouvé : ${user.name || "Sans Nom"} (${user.phone_number})`);

    // Trouver une règle correspondante
    let rule = await SmartOfferRule.findOne({ offerType: offerType });
    if (!rule) rule = await SmartOfferRule.findOne();
    if (!rule) {
      rule = await SmartOfferRule.create({
        segment: "normal",
        cooldownDays: 7,
        validityHours: 72,
        offerType: offerType
      });
    }

    // Désactiver/archiver les anciennes offres actives pour laisser place à la nouvelle
    await PersonalizedOffer.updateMany(
      { user: user._id, status: { $in: ["active", "viewed", "clicked"] } },
      { $set: { status: "expired" } }
    );

    let offerData = {
      user: user._id,
      rule: rule._id,
      status: "active",
      offerType: offerType,
      scheduledNotifyAt: new Date(),
      validUntil: new Date(Date.now() + 72 * 3600 * 1000), // 3 jours
      createdAt: new Date(),
      score: 100,
      strategyId: 6
    };

    // Fonction helper pour trouver ou créer un dessert
    const getOrCreateDessert = async () => {
      let cat = await Category.findOne({ name: { $regex: /dessert|sucr|douceur/i } });
      if (!cat) {
        cat = await Category.create({ name: "Desserts", description: "Nos délicieux desserts gourmands", is_available: true });
        console.log("🍰 Catégorie 'Desserts' créée en base de données !");
      }
      let item = await MenuItem.findOne({ category: cat._id });
      if (!item) {
        item = await MenuItem.create({
          name: "Fondant au chocolat",
          description: "Délicieux fondant au chocolat au cœur coulant",
          price: 6.99,
          category: cat._id,
          is_available: true
        });
        console.log("🍫 Article 'Fondant au chocolat' créé dans le menu !");
      }
      return item;
    };

    if (offerType === "strategy8" || offerType === "panier_moyen_5") {
      const dessertItem = await getOrCreateDessert();
      const avgBasket = 35; // Simulation d'un panier moyen de 35$
      const threshold = avgBasket + 5; // Panier moyen + 5$ = 40$
      offerData.offerType = "free_item";
      offerData.freeItem = null;
      offerData.targetCategory = dessertItem.category;
      offerData.bonusThreshold = threshold;
      offerData.strategyId = 8;
      offerData.notificationTitle = `⭐ Votre dessert offert au choix !`;
      offerData.notificationBody = `Un dessert au choix dans notre carte offert dès que votre panier dépasse ${threshold}$ !`;
    } else if (offerType === "strategy9" || offerType === "panier_moyen_10") {
      const dessertItem = await getOrCreateDessert();
      const avgBasket = 52; // Simulation d'un panier moyen de 52$
      const threshold = avgBasket + 10; // Panier moyen + 10$ = 62$
      offerData.offerType = "free_item";
      offerData.freeItem = null;
      offerData.targetCategory = dessertItem.category;
      offerData.bonusThreshold = threshold;
      offerData.strategyId = 9;
      offerData.notificationTitle = `⭐ Boisson + Dessert offerts au choix !`;
      offerData.notificationBody = `Profitez d'un dessert au choix offert dès que votre panier dépasse ${threshold}$ !`;
    } else if (offerType === "bonus_basket") {
      offerData.discountValue = 5; // 5$ de rabais
      offerData.bonusThreshold = 25; // dès 25$ d'achat
      offerData.notificationTitle = "⭐ Offre Panier Moyen : 5$ offerts !";
      offerData.notificationBody = "Profitez de 5$ de réduction dès que votre panier atteint 25$ !";
    } else if (offerType === "discount_order") {
      offerData.discountValue = 15; // 15%
      offerData.notificationTitle = "⭐ Offre Spéciale : -15% !";
      offerData.notificationBody = "Bénéficiez de 15% de rabais sur toute votre commande !";
    } else if (offerType === "discount_category") {
      const category = await Category.findOne();
      offerData.targetCategory = category ? category._id : null;
      offerData.discountValue = 20; // 20%
      offerData.notificationTitle = `⭐ -20% sur la catégorie ${category ? category.name : ""} !`;
      offerData.notificationBody = `Profitez de 20% de réduction sur les articles ${category ? category.name : ""} dans votre panier !`;
    } else if (offerType === "free_delivery") {
      offerData.notificationTitle = "🚚 Livraison Gratuite !";
      offerData.notificationBody = "La livraison est offerte sur votre prochaine commande !";
    } else if (offerType === "free_item") {
      const keyword = process.argv[4] || "";
      let item = null;
      if (keyword) {
        const categories = await Category.find();
        const matchedCategories = categories.filter(c => String(c.name || "").toLowerCase().includes(keyword.toLowerCase()));
        if (matchedCategories.length > 0) {
          const matchedCategoryIds = matchedCategories.map(c => c._id);
          item = await MenuItem.findOne({ category: { $in: matchedCategoryIds }, is_available: true });
        }
        if (!item) {
          item = await MenuItem.findOne({ name: { $regex: new RegExp(keyword, "i") }, is_available: true });
        }
      }
      if (!item) {
        item = await getOrCreateDessert();
      }

      offerData.freeItem = item ? item._id : null;
      offerData.bonusThreshold = 20;
      offerData.notificationTitle = `🎁 Article offert : ${item ? item.name : "Cadeau"} !`;
      offerData.notificationBody = `Un article (${item ? item.name : "Cadeau"}) offert dès que votre panier dépasse 20$ !`;
    }

    const newOffer = await PersonalizedOffer.create(offerData);
    console.log(`\n✅ Offre de test "${offerType}" créée avec succès (ID: ${newOffer._id}) !`);
    console.log(`💡 Détails : ${offerData.notificationTitle}`);
    console.log(`👉 Ouvre ou rafraîchis l'application mobile avec le compte ${user.phone_number} pour tester !`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Erreur lors de la création de l'offre:", err);
    process.exit(1);
  }
}

createTestOffer();
