require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "csv_exports");

// ---------------- helpers ----------------

const pad = (n) => String(n).padStart(2, "0");

function fmtDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const fmtBool = (v) => (v ? "Oui" : "Non");

const idStr = (v) => (v === null || v === undefined ? "" : String(v));

function num(v, fallback = "") {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

function objectIdDate(id) {
  try {
    return new mongoose.Types.ObjectId(String(id)).getTimestamp();
  } catch {
    return null;
  }
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const str = value instanceof Date ? fmtDate(value) : String(value);
  if (/[",\n\r]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

function makeCsvWriter(fileName, columns) {
  const filePath = path.join(OUTPUT_DIR, fileName);
  const stream = fs.createWriteStream(filePath, { encoding: "utf8" });
  stream.write("﻿" + columns.join(",") + "\n");
  let rowCount = 0;
  return {
    write(rowObj) {
      stream.write(columns.map((c) => csvCell(rowObj[c])).join(",") + "\n");
      rowCount++;
    },
    async close() {
      await new Promise((resolve) => stream.end(resolve));
      console.log(`  -> ${fileName}: ${rowCount} lignes`);
    },
  };
}

const lineKey = (itemId, size, customizations) =>
  `${itemId}__${size || ""}__${(customizations || []).map(String).sort().join(",")}`;

const SEGMENT_LABELS = {
  very_active: "Très actif",
  normal: "Régulier",
  inactive: "Inactif",
  reactivate: "À réactiver",
  loyal: "Fidèle",
};

async function main() {
  console.log("Connexion à la base de données...");
  await mongoose.connect(process.env.DEV_DB_CONNECTION);
  const db = mongoose.connection.db;
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("Chargement des tables de référence...");
  const [
    categories,
    toppings,
    menuItems,
    restaurants,
    offersDefs,
    promoCodes,
    smartOfferRules,
    userSmartProfiles,
    rewardDefs,
  ] = await Promise.all([
    db.collection("categories").find({}).toArray(),
    db.collection("toppings").find({}).toArray(),
    db.collection("menuitems").find({}).toArray(),
    db.collection("restaurants").find({}).toArray(),
    db.collection("offers").find({}).toArray(),
    db.collection("promocodes").find({}).toArray(),
    db.collection("smartofferrules").find({}).toArray(),
    db.collection("usersmartprofiles").find({}).toArray(),
    db.collection("rewards").find({}).toArray(),
  ]);

  const categoriesById = new Map(categories.map((c) => [idStr(c._id), c]));
  const toppingsById = new Map(toppings.map((t) => [idStr(t._id), t]));
  const menuItemsById = new Map(
    menuItems.map((m) => [
      idStr(m._id),
      { ...m, categoryName: categoriesById.get(idStr(m.category))?.name || "" },
    ]),
  );
  const restaurantsById = new Map(restaurants.map((r) => [idStr(r._id), r]));
  const offersDefsById = new Map(offersDefs.map((o) => [idStr(o._id), o]));
  const promoCodesById = new Map(promoCodes.map((p) => [idStr(p._id), p]));
  const rulesById = new Map(smartOfferRules.map((r) => [idStr(r._id), r]));
  const smartProfilesByUser = new Map(userSmartProfiles.map((p) => [idStr(p.user), p]));
  const rewardsById = new Map(rewardDefs.map((r) => [idStr(r._id), r]));

  // Les anciennes commandes stockent `rewards[]` comme une simple liste d'ids
  // (avant que l'article/la taille/les points soient dénormalisés sur la commande).
  const isDenormalizedReward = (entry) =>
    entry &&
    typeof entry === "object" &&
    !Array.isArray(entry) &&
    !(entry instanceof mongoose.Types.ObjectId) &&
    ("reward" in entry || "item" in entry);

  const toppingNames = (ids) =>
    (ids || []).map((id) => toppingsById.get(idStr(id))?.name || idStr(id)).join(" | ");

  console.log("Calcul des agrégats de commandes par client...");
  const userOrderStats = await db
    .collection("orders")
    .aggregate([
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: "$user",
          canalPremiereCommande: { $first: "$platform" },
          dateDerniereCommande: { $last: "$createdAt" },
          nbCommandes: { $sum: 1 },
        },
      },
    ])
    .toArray();
  const orderStatsByUser = new Map(userOrderStats.map((s) => [idStr(s._id), s]));

  // ---------------- 04b_categories.csv ----------------
  {
    const w = makeCsvWriter("04b_categories.csv", [
      "id_categorie",
      "nom",
      "slug",
      "ordre_affichage",
      "date_creation_estimee",
    ]);
    for (const c of categories) {
      w.write({
        id_categorie: idStr(c._id),
        nom: c.name || "",
        slug: c.slug || "",
        ordre_affichage: num(c.order),
        date_creation_estimee: fmtDate(objectIdDate(c._id)),
      });
    }
    await w.close();
  }

  // ---------------- 04_articles_catalogue.csv ----------------
  {
    const w = makeCsvWriter("04_articles_catalogue.csv", [
      "id_article",
      "nom",
      "slug",
      "categorie",
      "description",
      "taille",
      "prix",
      "disponible",
      "verrouille_promo",
      "ordre_affichage",
      "date_ajout_estimee",
    ]);
    for (const m of menuItems) {
      const prices =
        Array.isArray(m.prices) && m.prices.length ? m.prices : [{ size: "", price: "" }];
      for (const p of prices) {
        w.write({
          id_article: idStr(m._id),
          nom: m.name || "",
          slug: m.slug || "",
          categorie: categoriesById.get(idStr(m.category))?.name || "",
          description: m.description || "",
          taille: p.size || "",
          prix: num(p.price),
          disponible: fmtBool(m.is_available !== false),
          verrouille_promo: fmtBool(!!m.promo_locked),
          ordre_affichage: num(m.order),
          date_ajout_estimee: fmtDate(objectIdDate(m._id)),
        });
      }
    }
    await w.close();
  }

  // ---------------- 05_offres_combos.csv ----------------
  {
    const w = makeCsvWriter("05_offres_combos.csv", [
      "id_offre",
      "nom",
      "slug",
      "prix",
      "articles_inclus",
      "date_creation",
      "date_expiration",
      "ordre_affichage",
    ]);
    for (const o of offersDefs) {
      const items = (o.items || [])
        .map((it) => {
          const mi = menuItemsById.get(idStr(it.item));
          const qty = it.quantity && it.quantity !== 1 ? ` x${it.quantity}` : "";
          return `${mi?.name || idStr(it.item)}${it.size ? ` (${it.size})` : ""}${qty}`;
        })
        .join(" + ");
      w.write({
        id_offre: idStr(o._id),
        nom: o.name || "",
        slug: o.slug || "",
        prix: num(o.price),
        articles_inclus: items,
        date_creation: fmtDate(o.createdAt || objectIdDate(o._id)),
        date_expiration: fmtDate(o.expireAt),
        ordre_affichage: num(o.order),
      });
    }
    await w.close();
  }

  // ---------------- 05b_codes_promo.csv ----------------
  {
    const w = makeCsvWriter("05b_codes_promo.csv", [
      "id_code_promo",
      "code",
      "type",
      "montant",
      "pourcentage",
      "article_gratuit",
      "categorie_incluse",
      "categories_exclues",
      "date_debut",
      "date_fin",
      "utilisation_max_par_client",
      "utilisation_totale",
      "date_creation",
    ]);
    for (const p of promoCodes) {
      w.write({
        id_code_promo: idStr(p._id),
        code: p.code || "",
        type: p.type || "",
        montant: num(p.amount),
        pourcentage: num(p.percent),
        article_gratuit: menuItemsById.get(idStr(p.freeItem))?.name || "",
        categorie_incluse: categoriesById.get(idStr(p.category))?.name || "",
        categories_exclues: (p.excludedCategories || [])
          .map((c) => categoriesById.get(idStr(c))?.name || idStr(c))
          .join(" | "),
        date_debut: fmtDate(p.startDate),
        date_fin: fmtDate(p.endDate),
        utilisation_max_par_client: num(p.usagePerUser),
        utilisation_totale: num(p.totalUsage, 0),
        date_creation: fmtDate(p.createdAt || objectIdDate(p._id)),
      });
    }
    await w.close();
  }

  // ---------------- 06c_regles_smart_offers.csv ----------------
  {
    const w = makeCsvWriter("06c_regles_smart_offers.csv", [
      "id_regle",
      "nom",
      "strategie_id",
      "segment",
      "groupe",
      "priorite",
      "cooldown_jours",
      "validite_heures",
      "type_offre",
      "valeur_rabais",
      "seuil_bonus",
      "points_bonus",
      "etapes_rabais",
      "jours_validite_suivi",
      "actif",
      "date_creation",
    ]);
    for (const r of smartOfferRules) {
      w.write({
        id_regle: idStr(r._id),
        nom: r.name || "",
        strategie_id: num(r.strategyId),
        segment: r.segment || "",
        groupe: r.group || "",
        priorite: num(r.priority),
        cooldown_jours: num(r.cooldownDays),
        validite_heures: num(r.validityHours),
        type_offre: r.offerType || "",
        valeur_rabais: num(r.discountValue),
        seuil_bonus: num(r.bonusThreshold),
        points_bonus: num(r.bonusPoints),
        etapes_rabais: (r.discountSteps || []).join(" | "),
        jours_validite_suivi: num(r.followupValidityDays),
        actif: fmtBool(r.isActive !== false),
        date_creation: fmtDate(r.createdAt || objectIdDate(r._id)),
      });
    }
    await w.close();
  }

  // ---------------- 06_offres_personnalisees.csv ----------------
  console.log("Export des offres personnalisées...");
  {
    const w = makeCsvWriter("06_offres_personnalisees.csv", [
      "id_offre_personnalisee",
      "id_client",
      "id_regle",
      "strategie_id",
      "segment",
      "groupe",
      "type_offre",
      "statut",
      "valeur_rabais",
      "seuil_bonus",
      "points_bonus",
      "etapes_rabais",
      "etape_actuelle",
      "date_creation",
      "date_premiere_application",
      "valide_du",
      "valide_jusqua",
      "date_notification_programmee",
      "notification_cliquee",
      "score",
    ]);
    const cursor = db.collection("personalizedoffers").find({});
    for await (const po of cursor) {
      const rule = rulesById.get(idStr(po.rule));
      w.write({
        id_offre_personnalisee: idStr(po._id),
        id_client: idStr(po.user),
        id_regle: idStr(po.rule),
        strategie_id: num(po.strategyId ?? rule?.strategyId),
        segment: rule?.segment || "",
        groupe: rule?.group || "",
        type_offre: po.offerType || "",
        statut: po.status || "",
        valeur_rabais: num(po.discountValue),
        seuil_bonus: num(po.bonusThreshold),
        points_bonus: num(po.bonusPoints),
        etapes_rabais: (po.discountSteps || []).join(" | "),
        etape_actuelle: num(po.currentStep),
        date_creation: fmtDate(po.createdAt),
        date_premiere_application: fmtDate(po.firstAppliedAt),
        valide_du: fmtDate(po.validFrom),
        valide_jusqua: fmtDate(po.validUntil),
        date_notification_programmee: fmtDate(po.scheduledNotifyAt),
        notification_cliquee: fmtBool(!!po.notifClicked),
        score: num(po.score),
      });
    }
    await w.close();
  }

  // ---------------- 06b_evenements_offres_personnalisees.csv ----------------
  console.log("Export du journal d'événements des offres personnalisées...");
  {
    const poContext = new Map();
    const ctxCursor = db
      .collection("personalizedoffers")
      .find({}, { projection: { offerType: 1, rule: 1, strategyId: 1 } });
    for await (const po of ctxCursor) {
      const rule = rulesById.get(idStr(po.rule));
      poContext.set(idStr(po._id), {
        offerType: po.offerType || "",
        strategyId: num(po.strategyId ?? rule?.strategyId),
        segment: rule?.segment || "",
        groupe: rule?.group || "",
      });
    }

    const w = makeCsvWriter("06b_evenements_offres_personnalisees.csv", [
      "id_evenement",
      "id_offre_personnalisee",
      "id_client",
      "type_evenement",
      "date_heure",
      "type_offre",
      "strategie_id",
      "segment",
      "groupe",
    ]);
    const cursor = db.collection("personalizedofferevents").find({});
    for await (const ev of cursor) {
      const ctx = poContext.get(idStr(ev.personalizedOffer)) || {};
      w.write({
        id_evenement: idStr(ev._id),
        id_offre_personnalisee: idStr(ev.personalizedOffer),
        id_client: idStr(ev.user),
        type_evenement: ev.eventType || "",
        date_heure: fmtDate(ev.timestamp),
        type_offre: ctx.offerType || "",
        strategie_id: ctx.strategyId,
        segment: ctx.segment || "",
        groupe: ctx.groupe || "",
      });
    }
    await w.close();
  }

  // ---------------- 01_clients.csv ----------------
  console.log("Export des clients...");
  {
    const w = makeCsvWriter("01_clients.csv", [
      "id_client",
      "nom",
      "email",
      "telephone",
      "date_naissance",
      "date_creation_compte",
      "adresse_principale",
      "ville",
      "code_postal",
      "province",
      "nb_adresses_enregistrees",
      "canal_premiere_commande",
      "statut_compte",
      "app_installee",
      "date_desinstallation_app",
      "desabonne_email",
      "segment_activite",
      "segment_activite_libelle",
      "profil_reactivation",
      "strategie_reactivation_recommandee",
      "jour_prefere",
      "heure_preferee",
      "date_derniere_commande",
      "nb_commandes_total",
      "nb_commandes_30j",
      "nb_commandes_90j",
      "panier_moyen",
      "points_fidelite",
      "abonnement_actif",
      "statut_abonnement",
      "abonnement_renouvellement_auto",
      "code_parrainage",
      "parraine_par_id",
      "nb_commandes_parrainage",
      "solde_parrainage",
    ]);
    const cursor = db.collection("users").find({});
    for await (const u of cursor) {
      const profile = smartProfilesByUser.get(idStr(u._id));
      const orderStats = orderStatsByUser.get(idStr(u._id));
      const primaryAddress =
        Array.isArray(u.addresses) && u.addresses.length ? u.addresses[0] : {};
      w.write({
        id_client: idStr(u._id),
        nom: u.name || "",
        email: u.email || "",
        telephone: u.phone_number || "",
        date_naissance: fmtDate(u.date_of_birth),
        date_creation_compte: fmtDate(u.createdAt || objectIdDate(u._id)),
        adresse_principale: primaryAddress.address || "",
        ville: primaryAddress.city || "",
        code_postal: primaryAddress.postal_code || "",
        province: primaryAddress.state || "",
        nb_adresses_enregistrees: (u.addresses || []).length,
        canal_premiere_commande: orderStats?.canalPremiereCommande || "",
        statut_compte: u.isBanned ? "Banni" : "Actif",
        app_installee: fmtBool(u.appIsInstalled !== false),
        date_desinstallation_app: fmtDate(u.appUninstalledAt),
        desabonne_email: fmtBool(!!u.emailUnsubscribed),
        segment_activite: profile?.segment || "",
        segment_activite_libelle: SEGMENT_LABELS[profile?.segment] || "",
        profil_reactivation: profile?.reactivationProfile || "",
        strategie_reactivation_recommandee: num(profile?.recommendedReactivationStrategyId),
        jour_prefere: num(profile?.preferredDay),
        heure_preferee: num(profile?.preferredHour),
        date_derniere_commande: fmtDate(profile?.lastOrderAt || orderStats?.dateDerniereCommande),
        nb_commandes_total: num(profile?.orderCount ?? orderStats?.nbCommandes, 0),
        nb_commandes_30j: num(profile?.ordersCount30d),
        nb_commandes_90j: num(profile?.ordersCount90d),
        panier_moyen: num(profile?.averageBasketSize),
        points_fidelite: num(u.fidelity_points, 0),
        abonnement_actif: fmtBool(!!u.subscriptionIsActive),
        statut_abonnement: u.subscriptionStatus || "",
        abonnement_renouvellement_auto: fmtBool(!!u.subscriptionAutoRenew),
        code_parrainage: u.referralCode || "",
        parraine_par_id: idStr(u.referredBy),
        nb_commandes_parrainage: num(u.referralOrdersCount, 0),
        solde_parrainage: num(u.referralBalance, 0),
      });
    }
    await w.close();
  }

  // ---------------- 02 / 03 / 03b / 03c / 05c (single pass over orders) ----------------
  console.log("Export des commandes et de leurs détails (peut prendre un moment)...");
  {
    const w02 = makeCsvWriter("02_commandes.csv", [
      "id_commande",
      "id_client",
      "date_heure",
      "statut",
      "type_commande",
      "plateforme",
      "restaurant",
      "montant_total",
      "sous_total",
      "sous_total_apres_rabais",
      "rabais_pourcentage",
      "frais_livraison",
      "pourboire",
      "mode_paiement",
      "paiement_confirme",
      "nb_articles_ligne",
      "nb_offres_combos",
      "nb_recompenses",
      "code_promo",
      "offre_personnalisee_appliquee",
      "abonnement_applique",
      "cadeau_anniversaire_applique",
      "credit_parrainage_applique",
      "note",
      "commentaire_avis",
      "commande_programmee",
      "heure_programmee",
      "fournisseur_livraison",
      "code_commande",
      "adresse_livraison",
      "ville_livraison",
      "code_postal_livraison",
    ]);
    const w03 = makeCsvWriter("03_details_commandes_articles.csv", [
      "id_commande",
      "id_client",
      "date_commande",
      "id_article",
      "nom_article",
      "categorie_article",
      "taille",
      "quantite",
      "prix_unitaire",
      "prix_total_ligne",
      "prix_base_unitaire",
      "supplements",
      "commentaire",
      "gratuit_abonnement",
      "gratuit_anniversaire",
      "gratuit_offre_personnalisee",
    ]);
    const w03b = makeCsvWriter("03b_details_commandes_offres_combos.csv", [
      "id_commande",
      "id_client",
      "date_commande",
      "id_offre",
      "nom_offre",
      "prix_offre",
      "articles_inclus",
    ]);
    const w03c = makeCsvWriter("03c_details_commandes_recompenses.csv", [
      "id_commande",
      "id_client",
      "date_commande",
      "id_recompense",
      "id_article",
      "nom_article",
      "taille",
      "points_utilises",
      "supplement_paye",
      "supplements",
      "commentaire",
    ]);
    const w05c = makeCsvWriter("05c_utilisation_codes_promo.csv", [
      "id_commande",
      "id_client",
      "date_utilisation",
      "id_code_promo",
      "code",
      "type",
      "montant_commande",
      "rabais_montant",
    ]);

    const cursor = db.collection("orders").find({});
    for await (const o of cursor) {
      const orderId = idStr(o._id);
      const userId = idStr(o.user);
      const dateCommande = fmtDate(o.createdAt);
      const restaurant = restaurantsById.get(idStr(o.restaurant));
      const promo = promoCodesById.get(idStr(o.promoCode));

      w02.write({
        id_commande: orderId,
        id_client: userId,
        date_heure: dateCommande,
        statut: o.status || "",
        type_commande: o.type || "",
        plateforme: o.platform || "",
        restaurant: restaurant?.name || "",
        montant_total: num(o.total_price),
        sous_total: num(o.sub_total),
        sous_total_apres_rabais: num(o.sub_total_after_discount),
        rabais_pourcentage: num(o.discount),
        frais_livraison: num(o.delivery_fee),
        pourboire: num(o.tip),
        mode_paiement: o.payment_method || "",
        paiement_confirme: fmtBool(!!o.payment_status),
        nb_articles_ligne: (o.orderItems || []).length,
        nb_offres_combos: (o.offers || []).length,
        nb_recompenses: (o.rewards || []).length,
        code_promo: promo?.code || "",
        offre_personnalisee_appliquee: fmtBool(!!o.personalizedOfferApplied),
        abonnement_applique: fmtBool(!!o.subscriptionBenefits?.isApplied),
        cadeau_anniversaire_applique: fmtBool(!!o.birthdayBenefits?.isApplied),
        credit_parrainage_applique: num(o.referralDiscountApplied, 0),
        note: num(o.review?.rating),
        commentaire_avis: o.review?.comment || "",
        commande_programmee: fmtBool(!!o.scheduled?.isScheduled),
        heure_programmee: fmtDate(o.scheduled?.scheduledFor),
        fournisseur_livraison: o.delivery_provider || "",
        code_commande: o.code || "",
        adresse_livraison: o.address || "",
        ville_livraison: o.detailed_address?.city || "",
        code_postal_livraison: o.detailed_address?.postal_code || "",
      });

      // --- 03: orderItems groupés par (article, taille, suppléments) ---
      const groups = new Map();
      for (const li of o.orderItems || []) {
        const itemId = idStr(li.item);
        const key = lineKey(itemId, li.size, li.customizations);
        if (!groups.has(key)) {
          groups.set(key, {
            itemId,
            size: li.size || "",
            customizations: li.customizations || [],
            qty: 0,
            priceSum: 0,
            basePriceSum: 0,
            comments: new Set(),
            subFree: false,
            bdayFree: false,
            smartFree: false,
          });
        }
        const g = groups.get(key);
        g.qty += 1;
        g.priceSum += num(li.price, 0);
        g.basePriceSum += num(li.basePrice, 0);
        if (li.comment) g.comments.add(li.comment);
        if (li.isSubscriptionFreeItem) g.subFree = true;
        if (li.isBirthdayFreeItem) g.bdayFree = true;
        if (li.isSmartOfferFreeItem) g.smartFree = true;
      }
      for (const g of groups.values()) {
        const mi = menuItemsById.get(g.itemId);
        w03.write({
          id_commande: orderId,
          id_client: userId,
          date_commande: dateCommande,
          id_article: g.itemId,
          nom_article: mi?.name || "",
          categorie_article: mi?.categoryName || "",
          taille: g.size,
          quantite: g.qty,
          prix_unitaire: round2(g.priceSum / g.qty),
          prix_total_ligne: round2(g.priceSum),
          prix_base_unitaire: round2(g.basePriceSum / g.qty),
          supplements: toppingNames(g.customizations),
          commentaire: Array.from(g.comments).join(" | "),
          gratuit_abonnement: fmtBool(g.subFree),
          gratuit_anniversaire: fmtBool(g.bdayFree),
          gratuit_offre_personnalisee: fmtBool(g.smartFree),
        });
      }

      // --- 03b: offres combos incluses dans la commande ---
      for (const off of o.offers || []) {
        const offerId = idStr(off.offer);
        const offerDef = offersDefsById.get(offerId);
        // Les commandes plus anciennes n'ont pas de tableau `items` détaillé par
        // commande : on retombe alors sur la composition actuelle de l'offre.
        const subItems = Array.isArray(off.items) && off.items.length
          ? off.items
          : offerDef?.items || [];
        const itemsText = subItems
          .map((it) => {
            const mi = menuItemsById.get(idStr(it.item));
            const custText = toppingNames(it.customizations);
            const sizeText = it.size ? ` (${it.size})` : "";
            return `${mi?.name || idStr(it.item)}${sizeText}${custText ? ` [${custText}]` : ""}`;
          })
          .join(" + ");
        w03b.write({
          id_commande: orderId,
          id_client: userId,
          date_commande: dateCommande,
          id_offre: offerId,
          nom_offre: offerDef?.name || "",
          prix_offre: num(off.price),
          articles_inclus: itemsText,
        });
      }

      // --- 03c: récompenses de fidélité utilisées ---
      for (const rwRaw of o.rewards || []) {
        let rewardId, itemId, size, customizations, points, extraPrice, comment;
        if (isDenormalizedReward(rwRaw)) {
          ({ reward: rewardId, item: itemId, size, customizations, points, extraPrice, comment } = rwRaw);
        } else {
          // Format hérité : seul l'id de la récompense était stocké.
          rewardId = rwRaw;
          const rewardDef = rewardsById.get(idStr(rewardId));
          itemId = rewardDef?.item;
          size = rewardDef?.size;
          points = rewardDef?.points;
          extraPrice = 0;
          customizations = [];
          comment = "";
        }
        const mi = menuItemsById.get(idStr(itemId));
        w03c.write({
          id_commande: orderId,
          id_client: userId,
          date_commande: dateCommande,
          id_recompense: idStr(rewardId),
          id_article: idStr(itemId),
          nom_article: mi?.name || "",
          taille: size || "",
          points_utilises: num(points),
          supplement_paye: num(extraPrice, 0),
          supplements: toppingNames(customizations),
          commentaire: comment || "",
        });
      }

      // --- 05c: utilisation des codes promo ---
      if (o.promoCode) {
        w05c.write({
          id_commande: orderId,
          id_client: userId,
          date_utilisation: dateCommande,
          id_code_promo: idStr(o.promoCode),
          code: promo?.code || "",
          type: promo?.type || "",
          montant_commande: num(o.total_price),
          rabais_montant: round2(num(o.sub_total, 0) - num(o.sub_total_after_discount, 0)),
        });
      }
    }

    await Promise.all([w02.close(), w03.close(), w03b.close(), w03c.close(), w05c.close()]);
  }

  console.log("\nExport terminé. Fichiers écrits dans :", OUTPUT_DIR);
}

main()
  .catch((err) => {
    console.error("Erreur pendant l'export :", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    process.exit();
  });
