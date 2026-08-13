const UserSmartProfile = require("../models/UserSmartProfile");
const SmartOfferRule = require("../models/SmartOfferRule");
const PersonalizedOffer = require("../models/PersonalizedOffer");
const PersonalizedOfferEvent = require("../models/PersonalizedOfferEvent");
const Order = require("../models/Order");
const SmartOfferHediPayout = require("../models/SmartOfferHediPayout");
const Staff = require("../models/staff");

// 1. Get configuration rules for segments
const getRules = async (req, res) => {
  try {
    const rules = await SmartOfferRule.find()
      .populate("targetCategory")
      .populate("targetMenuItem")
      .populate("triggerItem")
      .populate("freeItem")
      .populate("freeItems.item");
    return res.status(200).json(rules);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 2. Create or Update configuration rules
const createOrUpdateRule = async (req, res) => {
  try {
    const { 
      strategyId,
      segment, 
      cooldownDays, 
      validityHours, 
      offerType, 
      discountValue,
      bonusThreshold,
      bonusPoints,
      discountSteps,
      followupValidityDays,
      triggerItem,
      triggerItemSize,
      giftItemSize,
      targetCategory,
      targetMenuItem,
      freeItem,
      freeItems,
      notificationTitle,
      notificationBody,
      isActive
    } = req.body;
    const normalizedFreeItems = offerType === "buy_one_get_one"
      ? []
      : Array.isArray(freeItems) ? freeItems : [];
    const normalizedFreeItem =
      offerType === "buy_one_get_one"
        ? freeItem || null
        : normalizedFreeItems.length > 0 ? null : freeItem || null;
    const normalizedDiscountSteps = Array.isArray(discountSteps)
      ? discountSteps.map(Number).filter((value) => Number.isFinite(value) && value > 0 && value <= 100)
      : [];
    if (offerType === "split_discount" && normalizedDiscountSteps.length < 2) {
      return res.status(400).json({ error: "Le rabais divisé doit contenir au moins deux étapes valides." });
    }
    if (offerType === "buy_one_get_one" && (!triggerItem || !normalizedFreeItem)) {
      return res.status(400).json({ error: "L'article acheté et l'article offert sont obligatoires." });
    }

    const query = strategyId ? { strategyId } : { segment };
    const rule = await SmartOfferRule.findOneAndUpdate(
      query,
      {
        strategyId,
        segment,
        cooldownDays,
        validityHours,
        offerType,
        discountValue,
        bonusThreshold,
        bonusPoints: offerType === "loyalty_points" ? Math.max(0, Math.floor(Number(bonusPoints) || 0)) : 0,
        discountSteps: offerType === "split_discount" ? normalizedDiscountSteps : undefined,
        followupValidityDays: Math.max(1, Math.floor(Number(followupValidityDays) || 7)),
        triggerItem: offerType === "buy_one_get_one" ? triggerItem : null,
        triggerItemSize: offerType === "buy_one_get_one" ? String(triggerItemSize || "") : "",
        giftItemSize: offerType === "buy_one_get_one" ? String(giftItemSize || "") : "",
        targetCategory: targetCategory || null,
        targetMenuItem: targetMenuItem || null,
        freeItem: normalizedFreeItem,
        freeItems: normalizedFreeItems,
        notificationTitle,
        notificationBody,
        isActive: isActive !== undefined ? isActive : true
      },
      { upsert: true, new: true }
    );

    if (rule?.strategyId) {
      await PersonalizedOffer.updateMany(
        { strategyId: rule.strategyId, status: { $in: ["prepared", "active", "viewed", "clicked"] } },
        {
          $set: {
            discountValue: rule.discountValue,
            bonusThreshold: rule.bonusThreshold,
            bonusPoints: rule.bonusPoints,
            discountSteps: rule.discountSteps,
            followupValidityDays: rule.followupValidityDays,
            triggerItem: rule.triggerItem || null,
            triggerItemSize: rule.triggerItemSize || "",
            giftItemSize: rule.giftItemSize || "",
            offerType: rule.offerType,
            targetCategory: rule.targetCategory || null,
            targetMenuItem: rule.targetMenuItem || null,
            freeItem: rule.freeItems?.length > 0 ? null : rule.freeItem || null,
            freeItems: rule.freeItems || [],
            notificationTitle: rule.notificationTitle,
            notificationBody: rule.notificationBody
          }
        }
      );
    }

    return res.status(200).json(rule);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 3. Get active offer for client
const getActiveOffer = async (req, res) => {
  try {
    const { userId } = req.params;
    const now = new Date();
    
    // Find active offer (most recent first)
    const activeOffer = await PersonalizedOffer.findOne({
      user: userId,
      status: { $in: ["active", "viewed", "clicked"] },
      validUntil: { $gt: now }
    })
      .sort({ createdAt: -1 })
      .populate("freeItem targetCategory targetMenuItem triggerItem")
      .populate({
        path: "freeItems.item",
        populate: { path: "category", select: "name slug" },
      });

    if (activeOffer) {
      const Order = require("../models/Order");
      const { CANCELED } = require("../utils/constants");
      const existingOrderQuery = {
        personalizedOffer: activeOffer._id,
        status: { $ne: CANCELED },
      };
      if (activeOffer.offerType === "split_discount") {
        existingOrderQuery.smartOfferUsageStep = activeOffer.currentStep || 0;
      }
      const existingOrder = await Order.findOne(existingOrderQuery);
      if (existingOrder) {
        return res.status(200).json(null);
      }
    }

    return res.status(200).json(activeOffer);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 4. Log event (e.g. view, click, notif_clicked)
const logEvent = async (req, res) => {
  try {
    const { offerId, userId, eventType } = req.body;

    const offer = await PersonalizedOffer.findById(offerId);
    if (!offer) {
      return res.status(404).json({ error: "Offer not found" });
    }

    // Update status or flags
    if (eventType === "notif_clicked") {
      offer.notifClicked = true;
      if (offer.status === "active") {
        offer.status = "viewed";
      }
      await offer.save();
    } else if (eventType === "viewed" && offer.status === "active") {
      offer.status = "viewed";
      await offer.save();
    } else if (eventType === "clicked" && (offer.status === "active" || offer.status === "viewed")) {
      offer.status = "clicked";
      await offer.save();
    }

    // Log event
    const event = new PersonalizedOfferEvent({
      personalizedOffer: offerId,
      user: userId,
      eventType
    });
    await event.save();

    return res.status(200).json({ success: true, offer });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 5. Get all user smart profiles for dashboard (with pagination & search)
const getUserProfiles = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
    const search = (req.query.search || req.query.q || "").trim();

    const query = {};
    if (search) {
      const User = require("../models/User");
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { phone_number: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      }).select("_id");
      const userIds = matchingUsers.map((u) => u._id);

      query.$or = [
        { user: { $in: userIds } },
        { segment: { $regex: search, $options: "i" } },
      ];
    }

    const total = await UserSmartProfile.countDocuments(query);
    const pages = Math.ceil(total / limit) || 1;
    const profiles = await UserSmartProfile.find(query)
      .populate("user", "name phone_number email")
      .sort({ orderCount: -1, lastOrderAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.status(200).json({
      profiles,
      page,
      pages,
      total,
      limit,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 6. Get offers history for dashboard (with pagination & search)
const getOffersHistory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
    const search = (req.query.search || req.query.q || "").trim();

    const query = {};
    if (search) {
      const User = require("../models/User");
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { phone_number: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      }).select("_id");
      const userIds = matchingUsers.map((u) => u._id);

      query.$or = [
        { user: { $in: userIds } },
        { notificationTitle: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
      ];
    }

    const total = await PersonalizedOffer.countDocuments(query);
    const pages = Math.ceil(total / limit) || 1;
    const history = await PersonalizedOffer.find(query)
      .populate("user", "name phone_number email")
      .populate("rule", "segment offerType")
      .populate("freeItem", "name")
      .populate("targetCategory", "name")
      .populate("targetMenuItem", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const Order = require("../models/Order");
    const usedOfferIds = history
      .filter((h) => h.status === "used" || h.status === "applied")
      .map((h) => h._id);

    const orders = await Order.find({
      personalizedOffer: { $in: usedOfferIds },
      status: { $ne: "Annulé" },
    }).select("personalizedOffer sub_total_after_discount sub_total total_price confirmed personalizedOfferApplied hediShareAmount");

    const ordersMap = {};
    orders.forEach((o) => {
      if (o.personalizedOffer) {
        ordersMap[String(o.personalizedOffer)] = o;
      }
    });

    const historyWithOrder = history.map((h) => {
      const order = ordersMap[String(h._id)];
      return {
        ...h,
        orderAmount: order ? (order.sub_total_after_discount || order.sub_total || order.total_price || 0) : 0,
        hediRoyalty:
          order?.confirmed && order?.personalizedOfferApplied
            ? Math.round(
                (order.sub_total_after_discount != null &&
                Number.isFinite(Number(order.sub_total_after_discount))
                  ? Number(order.sub_total_after_discount)
                  : Number(order.sub_total || 0)) * 5,
              ) / 100
            : 0,
      };
    });

    return res.status(200).json({
      history: historyWithOrder,
      page,
      pages,
      total,
      limit,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 6.b Get monitoring stats for dashboard
const getMonitoringStats = async (req, res) => {
  try {
    const totalProfilesCount = await UserSmartProfile.countDocuments();
    const [profilesBySegment] = await UserSmartProfile.aggregate([
      {
        $group: {
          _id: "$segment",
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          segments: {
            $push: { k: "$_id", v: "$count" },
          },
        },
      },
    ]);

    const segmentsUserCount = {};
    if (profilesBySegment?.segments) {
      profilesBySegment.segments.forEach((item) => {
        if (item.k) segmentsUserCount[item.k] = item.v;
      });
    }

    const offerStatsAgg = await PersonalizedOffer.aggregate([
      {
        $group: {
          _id: null,
          totalOffers: { $sum: 1 },
          notifClickedOffers: {
            $sum: {
              $cond: [{ $eq: ["$notifClicked", true] }, 1, 0],
            },
          },
          usedOffers: {
            $sum: {
              $cond: [{ $in: ["$status", ["used", "applied"]] }, 1, 0],
            },
          },
          clickedOffers: {
            $sum: {
              $cond: [{ $in: ["$status", ["clicked", "used", "applied"]] }, 1, 0],
            },
          },
          viewedOffers: {
            $sum: {
              $cond: [{ $in: ["$status", ["viewed", "clicked", "used", "applied"]] }, 1, 0],
            },
          },
        },
      },
    ]);

    const stats = offerStatsAgg[0] || {
      totalOffers: 0,
      notifClickedOffers: 0,
      usedOffers: 0,
      clickedOffers: 0,
      viewedOffers: 0,
    };

    // notifClicked is denormalized on the offer; avoid a full distinct scan of
    // the ever-growing events collection on every dashboard refresh.
    const totalNotifClicked = stats.notifClickedOffers || 0;

    const offerTypesAgg = await PersonalizedOffer.aggregate([
      {
        $group: {
          _id: "$offerType",
          count: { $sum: 1 },
          used: {
            $sum: {
              $cond: [{ $in: ["$status", ["used", "applied"]] }, 1, 0],
            },
          },
        },
      },
    ]);

    const offerTypesMap = {
      discount_order: { label: "Réduction sur commande (%)", count: 0, used: 0 },
      bonus_basket: { label: "Bonus panier ($)", count: 0, used: 0 },
      discount_category: { label: "Réduction sur catégorie (%)", count: 0, used: 0 },
      discount_product: { label: "Réduction sur article (%)", count: 0, used: 0 },
      free_item: { label: "Article gratuit", count: 0, used: 0 },
      free_delivery: { label: "Livraison gratuite", count: 0, used: 0 },
      loyalty_points: { label: "Points de fidélité bonus", count: 0, used: 0 },
      split_discount: { label: "Rabais divisé", count: 0, used: 0 },
      buy_one_get_one: { label: "1 acheté = 1 offert", count: 0, used: 0 },
    };

    offerTypesAgg.forEach((item) => {
      if (item._id && offerTypesMap[item._id]) {
        offerTypesMap[item._id].count = item.count || 0;
        offerTypesMap[item._id].used = item.used || 0;
      }
    });

    // Keep each historical configuration as a separate variant. This makes it
    // possible to compare, for example, the old S02 discount with the new S02
    // free-item offer instead of merging both under the same strategy id.
    const strategyVariants = await PersonalizedOffer.aggregate([
      {
        $addFields: {
          freeItemKey: { $ifNull: [{ $toString: "$freeItem" }, ""] },
          freeItemsKey: {
            $map: {
              input: { $ifNull: ["$freeItems", []] },
              as: "choice",
              in: {
                item: { $toString: "$$choice.item" },
                size: { $ifNull: ["$$choice.size", ""] },
              },
            },
          },
          targetItemKey: { $ifNull: [{ $toString: "$targetMenuItem" }, ""] },
        },
      },
      {
        $group: {
          _id: {
            strategyId: "$strategyId",
            offerType: "$offerType",
            discountValue: "$discountValue",
            bonusThreshold: "$bonusThreshold",
            bonusPoints: "$bonusPoints",
            freeItem: "$freeItemKey",
            freeItems: "$freeItemsKey",
            targetMenuItem: "$targetItemKey",
            discountSteps: "$discountSteps",
            triggerItem: { $ifNull: [{ $toString: "$triggerItem" }, ""] },
          },
          notificationTitle: { $first: "$notificationTitle" },
          notificationBody: { $first: "$notificationBody" },
          generated: { $sum: 1 },
          activated: { $sum: { $cond: [{ $ne: ["$validFrom", null] }, 1, 0] } },
          firstGeneratedAt: { $min: "$createdAt" },
          lastGeneratedAt: { $max: "$createdAt" },
        },
      },
      { $sort: { "_id.strategyId": 1, lastGeneratedAt: 1 } },
    ], { allowDiskUse: true });

    // Revenue is calculated from the much smaller set of converted orders.
    // Avoid joining every offer to the full orders/events collections: that
    // caused the production monitoring page to time out as history grew.
    const convertedOrderStats = await Order.aggregate([
      { $match: { personalizedOfferApplied: true, personalizedOffer: { $ne: null }, status: { $ne: "Annulé" } } },
      {
        $group: {
          _id: "$personalizedOffer",
          conversions: { $sum: 1 },
          revenue: { $sum: { $ifNull: ["$total_price", 0] } },
          subtotal: { $sum: { $ifNull: ["$sub_total", 0] } },
          discountedSubtotal: { $sum: { $ifNull: ["$sub_total_after_discount", 0] } },
          freeItemBenefit: {
            $sum: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: { $ifNull: ["$orderItems", []] },
                      as: "item",
                      cond: { $eq: ["$$item.isSmartOfferFreeItem", true] },
                    },
                  },
                  as: "freeItem",
                  in: { $ifNull: ["$$freeItem.basePrice", 0] },
                },
              },
            },
          },
        },
      },
    ], { allowDiskUse: true });

    const convertedOfferIds = convertedOrderStats.map((item) => item._id);
    const convertedOffers = convertedOfferIds.length > 0
      ? await PersonalizedOffer.find({ _id: { $in: convertedOfferIds } })
        .select("strategyId offerType discountValue bonusThreshold bonusPoints freeItem freeItems targetMenuItem discountSteps triggerItem validFrom validUntil")
        .lean()
      : [];
    const convertedOfferMap = new Map(convertedOffers.map((offer) => [String(offer._id), offer]));

    const variantKey = (config) => JSON.stringify({
      strategyId: Number(config.strategyId) || null,
      offerType: config.offerType || null,
      discountValue: Number(config.discountValue) || 0,
      bonusThreshold: Number(config.bonusThreshold) || 0,
      bonusPoints: Number(config.bonusPoints) || 0,
      freeItem: String(config.freeItem || ""),
      freeItems: (config.freeItems || []).map((choice) => ({
        item: String(choice?.item?._id || choice?.item || ""),
        size: String(choice?.size || ""),
      })),
      targetMenuItem: String(config.targetMenuItem || ""),
      discountSteps: config.discountSteps || null,
      triggerItem: String(config.triggerItem || ""),
    });

    const commercialStatsByVariant = new Map();
    convertedOrderStats.forEach((statsItem) => {
      const offer = convertedOfferMap.get(String(statsItem._id));
      if (!offer) return;
      const key = variantKey(offer);
      const current = commercialStatsByVariant.get(key) || {
        conversions: 0, revenue: 0, subtotal: 0, discountedSubtotal: 0, freeItemBenefit: 0,
      };
      current.conversions += statsItem.conversions || 0;
      current.revenue += statsItem.revenue || 0;
      current.subtotal += statsItem.subtotal || 0;
      current.discountedSubtotal += statsItem.discountedSubtotal || 0;
      current.freeItemBenefit += statsItem.freeItemBenefit || 0;
      commercialStatsByVariant.set(key, current);
    });

    strategyVariants.forEach((variant) => {
      const commercial = commercialStatsByVariant.get(variantKey(variant._id)) || {};
      variant.conversions = commercial.conversions || 0;
      variant.revenue = commercial.revenue || 0;
      variant.subtotal = commercial.subtotal || 0;
      variant.discountedSubtotal = commercial.discountedSubtotal || 0;
      variant.freeItemBenefit = commercial.freeItemBenefit || 0;
    });

    const roundRate = (value, total) =>
      total > 0 ? Math.round((value / total) * 10000) / 100 : 0;
    const variantCounters = {};
    const variantsByStrategy = {};
    strategyVariants.forEach((variant) => {
      const strategyId = variant._id.strategyId;
      variantCounters[strategyId] = (variantCounters[strategyId] || 0) + 1;
      if (!variantsByStrategy[strategyId]) variantsByStrategy[strategyId] = [];
      variantsByStrategy[strategyId].push({
        id: `S${strategyId}-V${variantCounters[strategyId]}`,
        strategyId,
        version: variantCounters[strategyId],
        ...variant._id,
        notificationTitle: variant.notificationTitle,
        notificationBody: variant.notificationBody,
        generated: variant.generated,
        activated: variant.activated,
        conversions: variant.conversions,
        revenue: Math.round(variant.revenue * 100) / 100,
        averageBasket: variant.conversions > 0
          ? Math.round((variant.subtotal / variant.conversions) * 100) / 100
          : 0,
        averageDiscount: variant.conversions > 0
          ? Math.round(((variant.subtotal - variant.discountedSubtotal) / variant.conversions) * 100) / 100
          : 0,
        totalDiscount: Math.round(
          Math.max(0, variant.subtotal - variant.discountedSubtotal + variant.freeItemBenefit) * 100,
        ) / 100,
        activationRate: roundRate(variant.activated, variant.generated),
        conversionRate: roundRate(variant.conversions, variant.activated),
        firstGeneratedAt: variant.firstGeneratedAt,
        lastGeneratedAt: variant.lastGeneratedAt,
      });
    });
    Object.values(variantsByStrategy).forEach((variants) => {
      if (variants.length > 0) variants[variants.length - 1].isLatest = true;
    });

    const [rulesPopulated] = await PersonalizedOffer.aggregate([
      {
        $lookup: {
          from: "smartofferrules",
          localField: "rule",
          foreignField: "_id",
          as: "ruleDoc",
        },
      },
      {
        $unwind: { path: "$ruleDoc", preserveNullAndEmptyArrays: true },
      },
      {
        $group: {
          _id: "$ruleDoc.segment",
          count: { $sum: 1 },
          used: {
            $sum: {
              $cond: [{ $in: ["$status", ["used", "applied"]] }, 1, 0],
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          data: { $push: { k: "$_id", count: "$count", used: "$used" } },
        },
      },
    ]);

    const segmentsMap = {
      very_active: { label: "Très Actif", users: segmentsUserCount["very_active"] || 0, offers: 0, used: 0 },
      normal: { label: "Normal", users: segmentsUserCount["normal"] || 0, offers: 0, used: 0 },
      loyal: { label: "Fidèle", users: segmentsUserCount["loyal"] || 0, offers: 0, used: 0 },
      inactive: { label: "Inactif", users: segmentsUserCount["inactive"] || 0, offers: 0, used: 0 },
      reactivate: { label: "À Réactiver", users: segmentsUserCount["reactivate"] || 0, offers: 0, used: 0 },
    };

    if (rulesPopulated?.data) {
      rulesPopulated.data.forEach((item) => {
        if (item.k && segmentsMap[item.k]) {
          segmentsMap[item.k].offers = item.count || 0;
          segmentsMap[item.k].used = item.used || 0;
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        totalProfilesCount,
        totalOffers: stats.totalOffers,
        notifClickedOffers: totalNotifClicked,
        usedOffers: stats.usedOffers,
        clickedOffers: stats.clickedOffers,
        viewedOffers: stats.viewedOffers,
        notifClickRate: stats.totalOffers > 0 ? Math.round((totalNotifClicked / stats.totalOffers) * 100) : 0,
        conversionRate: stats.totalOffers > 0 ? Math.round((stats.usedOffers / stats.totalOffers) * 100) : 0,
        engagementRate: stats.totalOffers > 0 ? Math.round((stats.viewedOffers / stats.totalOffers) * 100) : 0,
        clickRate: stats.totalOffers > 0 ? Math.round((stats.clickedOffers / stats.totalOffers) * 100) : 0,
        offerTypesMap,
        segmentsMap,
        variantsByStrategy,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// 7. Delete rule
const deleteRule = async (req, res) => {
  try {
    const { id } = req.params;
    await SmartOfferRule.findByIdAndDelete(id);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 8. Trigger manual scan
const { prepareDailyOffersJob, triggerScheduledOffersJob } = require("../jobs/personalizedOfferCron.job");
const triggerScan = async (req, res) => {
  try {
    console.log("[triggerScan] Manual scan triggered via admin dashboard API.");
    await prepareDailyOffersJob(true);
    await triggerScheduledOffersJob();
    return res.status(200).json({ success: true, message: "Le scan RFM et la génération des offres ont été exécutés avec succès." });
  } catch (error) {
    console.error("[triggerScan] Error during manual scan:", error);
    return res.status(500).json({ error: error.message });
  }
};

const getCronStatus = async (req, res) => {
  try {
    const SystemStat = require("../models/SystemStat");
    const stat = await SystemStat.findOne({ key: "smartOfferCronEnabled" }).lean();
    const isEnabled = stat?.value !== undefined ? Boolean(stat.value) : true;
    return res.status(200).json({ success: true, isEnabled });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const toggleCron = async (req, res) => {
  try {
    const SystemStat = require("../models/SystemStat");
    const { isEnabled } = req.body;
    const nextStatus = Boolean(isEnabled);
    await SystemStat.findOneAndUpdate(
      { key: "smartOfferCronEnabled" },
      { key: "smartOfferCronEnabled", value: nextStatus, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    console.log(`[toggleCron] Smart Offer Cron status updated to: ${nextStatus}`);
    return res.status(200).json({
      success: true,
      isEnabled: nextStatus,
      message: nextStatus
        ? "Le Cron des offres a été activé."
        : "Le Cron des offres a été désactivé."
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const ensureAdminStaff = async (req, res) => {
  const staffId =
    req?.staff?.id ||
    req?.staff?._id ||
    req?.staff?.staffId ||
    req?.staff?.userId;
  if (!staffId) {
    res.status(401).json({
      success: false,
      message: "Staff non authentifié.",
    });
    return null;
  }

  const staff = await Staff.findById(staffId).select("role");
  if (!staff) {
    res.status(403).json({
      success: false,
      message: "Staff introuvable.",
    });
    return null;
  }

  if (String(staff.role || "").toLowerCase() !== "admin") {
    res.status(403).json({
      success: false,
      message: "Accès réservé aux administrateurs.",
    });
    return null;
  }

  return staff;
};

const getSmartOfferHediSummary = async () => {
  const [ordersAgg] = await Order.aggregate([
    {
      $match: {
        status: { $ne: "Annulé" },
        confirmed: true,
        personalizedOfferApplied: true,
      },
    },
    {
      $group: {
        _id: null,
        totalCredits: {
          $sum: {
            $round: [
              {
                $multiply: [
                  {
                    $ifNull: [
                      "$sub_total_after_discount",
                      { $ifNull: ["$sub_total", 0] },
                    ],
                  },
                  0.05,
                ],
              },
              2,
            ],
          },
        },
        totalOrdersCount: {
          $sum: 1,
        },
      },
    },
  ]);

  const [payoutAgg] = await SmartOfferHediPayout.aggregate([
    {
      $group: {
        _id: null,
        totalPayouts: { $sum: "$amount" },
      },
    },
  ]);

  const totalCredits = Math.round((ordersAgg?.totalCredits || 0) * 100) / 100;
  const totalPayouts = Math.round((payoutAgg?.totalPayouts || 0) * 100) / 100;
  const balance = Math.round((totalCredits - totalPayouts) * 100) / 100;

  return {
    totalCredits,
    totalPayouts,
    balance,
    totalOrdersCount: ordersAgg?.totalOrdersCount || 0,
    sharePercent: 5,
  };
};

const getSmartOfferHediStats = async (req, res) => {
  try {
    const summary = await getSmartOfferHediSummary();
    const payouts = await SmartOfferHediPayout.find()
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        ...summary,
        payouts: payouts.map((entry) => ({
          _id: entry._id,
          amount: Math.round(entry.amount * 100) / 100,
          paidAt: entry.paidAt || entry.createdAt,
          note: entry.note || "",
          createdAt: entry.createdAt || null,
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const createSmartOfferHediPayout = async (req, res) => {
  try {
    const staff = await ensureAdminStaff(req, res);
    if (!staff) return;

    const amount = Number(req.body?.amount || 0);
    const note = String(req.body?.note || "").trim().slice(0, 240);
    const paidAtInput = req.body?.paidAt;
    const paidAt = paidAtInput ? new Date(paidAtInput) : new Date();

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Le montant du paiement est invalide.",
      });
    }

    if (!(paidAt instanceof Date) || Number.isNaN(paidAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: "La date du paiement est invalide.",
      });
    }

    const summary = await getSmartOfferHediSummary();
    if (amount > summary.balance) {
      return res.status(400).json({
        success: false,
        message: "Montant supérieur au solde de Hedi disponible. Ajustez le montant.",
      });
    }

    const payout = await SmartOfferHediPayout.create({
      amount,
      paidAt,
      note,
      createdByStaffId: staff._id,
    });

    const updatedSummary = await getSmartOfferHediSummary();
    return res.status(200).json({
      success: true,
      data: {
        payout: {
          _id: payout._id,
          amount: Math.round(payout.amount * 100) / 100,
          paidAt: payout.paidAt,
          note: payout.note || "",
          createdAt: payout.createdAt || null,
        },
        hedi: {
          totalCredits: updatedSummary.totalCredits,
          totalPayouts: updatedSummary.totalPayouts,
          balance: updatedSummary.balance,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Erreur lors de l'enregistrement du paiement.",
    });
  }
};

// Unsubscribe from Smart Offer emails
const unsubscribeEmail = async (req, res) => {
  try {
    const userId = req.query.userId || req.params.userId;
    if (!userId) {
      return res.status(400).send("ID utilisateur manquant.");
    }
    await User.findByIdAndUpdate(userId, {
      emailUnsubscribed: true,
      emailUnsubscribedAt: new Date(),
    });

    const htmlResponse = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Désabonnement confirmé - Club Courteau</title>
        <style>
          body { margin:0; padding:0; background:#0f172a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#f8fafc; display:flex; justify-content:center; align-items:center; min-height:100vh; text-align:center; }
          .card { background:#1e293b; padding:40px 30px; border-radius:24px; max-width:480px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); border:1px solid #334155; margin:20px; }
          .icon { font-size:48px; margin-bottom:20px; }
          h1 { font-size:24px; font-weight:700; margin:0 0 16px; color:#f8fafc; }
          p { font-size:16px; line-height:24px; color:#94a3b8; margin:0 0 24px; }
          .badge { display:inline-block; padding:6px 14px; background:rgba(247,166,0,0.15); color:#f7a600; border-radius:9999px; font-size:12px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; margin-bottom:24px; border:1px solid rgba(247,166,0,0.3); }
          .btn { display:inline-block; padding:12px 24px; background:#f7a600; color:#0f172a; font-weight:700; text-decoration:none; border-radius:12px; transition:all 0.2s; }
          .btn:hover { background:#eab308; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">Club Courteau</div>
          <div class="icon">✉️</div>
          <h1>Désabonnement confirmé</h1>
          <p>Vous avez été désabonné avec succès de nos e-mails d'offres promotionnelles et personnalisées. Vous ne recevrez plus ces messages par courrier électronique.</p>
          <p style="font-size:13px; color:#64748b;">Note : Vous pouvez à tout moment réactiver vos notifications et profiter de vos avantages en réinstallant l'application.</p>
          <a href="https://lecourteau.com" class="btn">Retour au site Courteau</a>
        </div>
      </body>
      </html>
    `;
    return res.status(200).send(htmlResponse);
  } catch (error) {
    console.error("[unsubscribeEmail] Error:", error);
    return res.status(500).send("Erreur lors du désabonnement.");
  }
};

module.exports = {
  getRules,
  createOrUpdateRule,
  getActiveOffer,
  logEvent,
  getUserProfiles,
  getOffersHistory,
  deleteRule,
  triggerScan,
  getCronStatus,
  toggleCron,
  getSmartOfferHediStats,
  createSmartOfferHediPayout,
  getMonitoringStats,
  unsubscribeEmail,
};
