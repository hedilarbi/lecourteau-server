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

const SEGMENT_LABELS = {
  very_active: "Très actif",
  normal: "Régulier",
  inactive: "Inactif",
  reactivate: "À réactiver",
  loyal: "Fidèle",
};

function buildTargetDescription(rule, categoriesById, menuItemsById) {
  const catName = categoriesById.get(idStr(rule.targetCategory))?.name || "";
  const itemName = menuItemsById.get(idStr(rule.targetMenuItem))?.name || "";
  const freeItemName = menuItemsById.get(idStr(rule.freeItem))?.name || "";
  const triggerName = menuItemsById.get(idStr(rule.triggerItem))?.name || "";
  const freeItemsNames = (rule.freeItems || [])
    .map((fi) => menuItemsById.get(idStr(fi.item))?.name || idStr(fi.item))
    .join(" | ");
  const seuil = rule.bonusThreshold ? ` (dès ${rule.bonusThreshold}$)` : "";

  switch (rule.offerType) {
    case "discount_category":
      return rule.targetCategory
        ? `${rule.discountValue}% de rabais sur la catégorie "${catName || rule.targetCategory}"`
        : `${rule.discountValue}% de rabais sur une catégorie déterminée individuellement par client`;
    case "discount_product":
      return rule.targetMenuItem
        ? `${rule.discountValue}% de rabais sur l'article "${itemName || rule.targetMenuItem}"`
        : `${rule.discountValue}% de rabais sur un article déterminé individuellement par client`;
    case "discount_order":
      return `${rule.discountValue}% de rabais sur toute la commande${seuil}`;
    case "free_item":
      return `Article gratuit${freeItemName ? ` : ${freeItemName}` : freeItemsNames ? ` : ${freeItemsNames}` : ""}${seuil}`;
    case "bonus_basket":
      return `Cadeau au panier${seuil}, valeur ${rule.discountValue}$`;
    case "free_delivery":
      return "Livraison gratuite";
    case "loyalty_points":
      return `${rule.bonusPoints} points de fidélité bonus${seuil}`;
    case "split_discount":
      return `Rabais progressif sur plusieurs commandes : ${(rule.discountSteps || []).join("% / ")}%`;
    case "buy_one_get_one":
      return `Achète "${triggerName || rule.triggerItem || "?"}"${rule.triggerItemSize ? ` (${rule.triggerItemSize})` : ""}, obtient "${freeItemName || rule.freeItem || "?"}"${rule.giftItemSize ? ` (${rule.giftItemSize})` : ""} gratuit`;
    default:
      return rule.offerType || "";
  }
}

async function main() {
  console.log("Connexion à la base de données...");
  await mongoose.connect(process.env.DEV_DB_CONNECTION);
  const db = mongoose.connection.db;
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("Chargement des tables de référence...");
  const [categories, menuItems, smartOfferRules] = await Promise.all([
    db.collection("categories").find({}).toArray(),
    db.collection("menuitems").find({}).toArray(),
    db.collection("smartofferrules").find({}).sort({ strategyId: 1 }).toArray(),
  ]);
  const categoriesById = new Map(categories.map((c) => [idStr(c._id), c]));
  const menuItemsById = new Map(menuItems.map((m) => [idStr(m._id), m]));

  console.log("Agrégation des statuts des offres personnalisées par stratégie...");
  const statusStats = await db
    .collection("personalizedoffers")
    .aggregate([{ $group: { _id: { rule: "$rule", status: "$status" }, count: { $sum: 1 } } }])
    .toArray();

  const statsByRule = new Map();
  for (const s of statusStats) {
    const ruleId = idStr(s._id.rule);
    if (!statsByRule.has(ruleId)) {
      statsByRule.set(ruleId, {
        total: 0,
        prepared: 0,
        active: 0,
        viewed: 0,
        clicked: 0,
        applied: 0,
        expired: 0,
      });
    }
    const bucket = statsByRule.get(ruleId);
    bucket.total += s.count;
    if (s._id.status in bucket) bucket[s._id.status] += s.count;
  }

  console.log("Agrégation des revenus générés par stratégie (commandes non annulées)...");
  const revenueStats = await db
    .collection("orders")
    .aggregate([
      { $match: { personalizedOfferApplied: true, status: { $ne: "Annulé" } } },
      {
        $lookup: {
          from: "personalizedoffers",
          localField: "personalizedOffer",
          foreignField: "_id",
          as: "po",
        },
      },
      { $unwind: "$po" },
      {
        $group: {
          _id: "$po.rule",
          nbCommandes: { $sum: 1 },
          revenu: { $sum: { $ifNull: ["$total_price", 0] } },
          sousTotal: { $sum: { $ifNull: ["$sub_total", 0] } },
          sousTotalApresRabais: { $sum: { $ifNull: ["$sub_total_after_discount", 0] } },
        },
      },
    ])
    .toArray();
  const revenueByRule = new Map(revenueStats.map((r) => [idStr(r._id), r]));

  // ---------------- 07_strategies_smart_offers_performance.csv ----------------
  console.log("Export des stratégies et de leurs performances...");
  {
    const w = makeCsvWriter("07_strategies_smart_offers_performance.csv", [
      "id_regle",
      "strategie_id",
      "nom",
      "actif",
      "segment",
      "segment_libelle",
      "groupe",
      "type_offre",
      "cible_description",
      "id_categorie_ciblee",
      "categorie_ciblee_nom",
      "id_article_cible",
      "article_cible_nom",
      "id_article_declencheur",
      "article_declencheur_nom",
      "taille_declencheur",
      "id_article_gratuit",
      "article_gratuit_nom",
      "taille_cadeau",
      "valeur_rabais",
      "seuil_bonus",
      "points_bonus",
      "etapes_rabais",
      "priorite",
      "cooldown_jours",
      "validite_heures",
      "jours_validite_suivi",
      "date_creation",
      "nb_offres_generees",
      "nb_prepared",
      "nb_active",
      "nb_viewed",
      "nb_clicked",
      "nb_applied",
      "nb_expired",
      "taux_conversion_pct",
      "taux_engagement_pct",
      "nb_commandes_generees",
      "revenu_total",
      "sous_total_total",
      "sous_total_apres_rabais_total",
      "cout_rabais_total",
      "panier_moyen",
      "revenu_par_offre_envoyee",
      "roi_dollar_par_dollar_rabais",
    ]);

    for (const rule of smartOfferRules) {
      const ruleId = idStr(rule._id);
      const st = statsByRule.get(ruleId) || {
        total: 0,
        prepared: 0,
        active: 0,
        viewed: 0,
        clicked: 0,
        applied: 0,
        expired: 0,
      };
      const rev = revenueByRule.get(ruleId) || {
        nbCommandes: 0,
        revenu: 0,
        sousTotal: 0,
        sousTotalApresRabais: 0,
      };
      const coutRabais = round2(rev.sousTotal - rev.sousTotalApresRabais);

      w.write({
        id_regle: ruleId,
        strategie_id: num(rule.strategyId),
        nom: rule.name || "",
        actif: fmtBool(rule.isActive !== false),
        segment: rule.segment || "",
        segment_libelle: SEGMENT_LABELS[rule.segment] || "",
        groupe: rule.group || "",
        type_offre: rule.offerType || "",
        cible_description: buildTargetDescription(rule, categoriesById, menuItemsById),
        id_categorie_ciblee: idStr(rule.targetCategory),
        categorie_ciblee_nom: categoriesById.get(idStr(rule.targetCategory))?.name || "",
        id_article_cible: idStr(rule.targetMenuItem),
        article_cible_nom: menuItemsById.get(idStr(rule.targetMenuItem))?.name || "",
        id_article_declencheur: idStr(rule.triggerItem),
        article_declencheur_nom: menuItemsById.get(idStr(rule.triggerItem))?.name || "",
        taille_declencheur: rule.triggerItemSize || "",
        id_article_gratuit: idStr(rule.freeItem),
        article_gratuit_nom: menuItemsById.get(idStr(rule.freeItem))?.name || "",
        taille_cadeau: rule.giftItemSize || "",
        valeur_rabais: num(rule.discountValue),
        seuil_bonus: num(rule.bonusThreshold),
        points_bonus: num(rule.bonusPoints),
        etapes_rabais: (rule.discountSteps || []).join(" | "),
        priorite: num(rule.priority),
        cooldown_jours: num(rule.cooldownDays),
        validite_heures: num(rule.validityHours),
        jours_validite_suivi: num(rule.followupValidityDays),
        date_creation: fmtDate(rule.createdAt),
        nb_offres_generees: st.total,
        nb_prepared: st.prepared,
        nb_active: st.active,
        nb_viewed: st.viewed,
        nb_clicked: st.clicked,
        nb_applied: st.applied,
        nb_expired: st.expired,
        taux_conversion_pct: st.total ? round2((st.applied / st.total) * 100) : 0,
        taux_engagement_pct: st.total
          ? round2(((st.viewed + st.clicked + st.applied) / st.total) * 100)
          : 0,
        nb_commandes_generees: rev.nbCommandes,
        revenu_total: round2(rev.revenu),
        sous_total_total: round2(rev.sousTotal),
        sous_total_apres_rabais_total: round2(rev.sousTotalApresRabais),
        cout_rabais_total: coutRabais,
        panier_moyen: rev.nbCommandes ? round2(rev.revenu / rev.nbCommandes) : "",
        revenu_par_offre_envoyee: st.total ? round2(rev.revenu / st.total) : "",
        roi_dollar_par_dollar_rabais: coutRabais > 0 ? round2(rev.revenu / coutRabais) : "",
      });
    }
    await w.close();
  }

  // ---------------- 08_historique_offres_par_strategie.csv ----------------
  console.log("Chargement des commandes liées à une offre personnalisée...");
  const linkedOrders = await db
    .collection("orders")
    .find(
      { personalizedOffer: { $ne: null } },
      {
        projection: {
          personalizedOffer: 1,
          createdAt: 1,
          status: 1,
          total_price: 1,
          sub_total: 1,
          sub_total_after_discount: 1,
        },
      },
    )
    .toArray();
  const ordersByPoId = new Map();
  for (const o of linkedOrders) {
    const key = idStr(o.personalizedOffer);
    if (!ordersByPoId.has(key)) ordersByPoId.set(key, []);
    ordersByPoId.get(key).push(o);
  }

  const rulesById = new Map(smartOfferRules.map((r) => [idStr(r._id), r]));

  console.log("Export de l'historique des offres personnalisées par stratégie...");
  {
    const w = makeCsvWriter("08_historique_offres_par_strategie.csv", [
      "id_offre_personnalisee",
      "id_regle",
      "strategie_id",
      "nom_strategie",
      "segment",
      "groupe",
      "id_client",
      "type_offre",
      "statut",
      "score",
      "valeur_rabais_offre",
      "seuil_bonus_offre",
      "points_bonus_offre",
      "etapes_rabais_offre",
      "etape_actuelle_offre",
      "id_categorie_ciblee_offre",
      "categorie_ciblee_offre_nom",
      "id_article_cible_offre",
      "article_cible_offre_nom",
      "id_article_gratuit_offre",
      "article_gratuit_offre_nom",
      "date_creation",
      "date_notification_programmee",
      "valide_du",
      "valide_jusqua",
      "notification_cliquee",
      "date_premiere_application",
      "id_commande_liee",
      "date_commande",
      "statut_commande",
      "montant_commande",
      "sous_total_commande",
      "rabais_commande",
    ]);

    const cursor = db.collection("personalizedoffers").find({});
    for await (const po of cursor) {
      const rule = rulesById.get(idStr(po.rule));
      const baseRow = {
        id_offre_personnalisee: idStr(po._id),
        id_regle: idStr(po.rule),
        strategie_id: num(po.strategyId ?? rule?.strategyId),
        nom_strategie: rule?.name || "",
        segment: rule?.segment || "",
        groupe: rule?.group || "",
        id_client: idStr(po.user),
        type_offre: po.offerType || "",
        statut: po.status || "",
        score: num(po.score),
        valeur_rabais_offre: num(po.discountValue),
        seuil_bonus_offre: num(po.bonusThreshold),
        points_bonus_offre: num(po.bonusPoints),
        etapes_rabais_offre: (po.discountSteps || []).join(" | "),
        etape_actuelle_offre: num(po.currentStep),
        id_categorie_ciblee_offre: idStr(po.targetCategory),
        categorie_ciblee_offre_nom: categoriesById.get(idStr(po.targetCategory))?.name || "",
        id_article_cible_offre: idStr(po.targetMenuItem),
        article_cible_offre_nom: menuItemsById.get(idStr(po.targetMenuItem))?.name || "",
        id_article_gratuit_offre: idStr(po.freeItem),
        article_gratuit_offre_nom: menuItemsById.get(idStr(po.freeItem))?.name || "",
        date_creation: fmtDate(po.createdAt),
        date_notification_programmee: fmtDate(po.scheduledNotifyAt),
        valide_du: fmtDate(po.validFrom),
        valide_jusqua: fmtDate(po.validUntil),
        notification_cliquee: fmtBool(!!po.notifClicked),
        date_premiere_application: fmtDate(po.firstAppliedAt),
      };

      const linked = ordersByPoId.get(idStr(po._id));
      if (!linked || !linked.length) {
        w.write({
          ...baseRow,
          id_commande_liee: "",
          date_commande: "",
          statut_commande: "",
          montant_commande: "",
          sous_total_commande: "",
          rabais_commande: "",
        });
      } else {
        for (const o of linked) {
          w.write({
            ...baseRow,
            id_commande_liee: idStr(o._id),
            date_commande: fmtDate(o.createdAt),
            statut_commande: o.status || "",
            montant_commande: num(o.total_price),
            sous_total_commande: num(o.sub_total),
            rabais_commande: round2(num(o.sub_total, 0) - num(o.sub_total_after_discount, 0)),
          });
        }
      }
    }
    await w.close();
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
