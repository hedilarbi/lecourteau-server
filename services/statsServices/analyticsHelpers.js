const { default: mongoose } = require("mongoose");

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIMEZONE = "America/Toronto";
const WEEKDAY_LABELS = {
  1: "Dimanche",
  2: "Lundi",
  3: "Mardi",
  4: "Mercredi",
  5: "Jeudi",
  6: "Vendredi",
  7: "Samedi",
};

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value, fallback = 0) => {
  const normalized = safeNumber(value, fallback);
  return Math.round(normalized * 100) / 100;
};

const startOfUtcDay = (date) => {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
};

const endOfUtcDay = (date) => {
  const result = new Date(date);
  result.setUTCHours(23, 59, 59, 999);
  return result;
};

const parseDateInput = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatIsoDay = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toObjectId = (value) => {
  if (!value || typeof value !== "string") return null;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const getOrderTypeExpressions = () => {
  const orderTypeExpr = {
    $toLower: {
      $trim: {
        input: { $ifNull: ["$type", ""] },
      },
    },
  };

  const isDeliveryExpr = {
    $or: [
      { $regexMatch: { input: orderTypeExpr, regex: "delivery" } },
      { $regexMatch: { input: orderTypeExpr, regex: "livraison" } },
    ],
  };

  const isPickupExpr = {
    $or: [
      { $regexMatch: { input: orderTypeExpr, regex: "pick\\s*-?\\s*up" } },
      { $regexMatch: { input: orderTypeExpr, regex: "ramassage" } },
      { $regexMatch: { input: orderTypeExpr, regex: "takeout" } },
      { $regexMatch: { input: orderTypeExpr, regex: "take-away" } },
    ],
  };

  return {
    isDeliveryExpr,
    isPickupExpr,
  };
};

const resolveDateRange = (query = {}, defaultPreset = "day") => {
  const preset = String(query?.preset || defaultPreset || "day")
    .trim()
    .toLowerCase();
  const pivotDate = parseDateInput(query?.date) || new Date();
  const fromInput = parseDateInput(query?.from);
  const toInput = parseDateInput(query?.to);

  if (preset === "all") {
    return {
      preset,
      startDate: null,
      endDate: null,
    };
  }

  if (preset === "custom") {
    const fromDate = fromInput ? startOfUtcDay(fromInput) : null;
    const toDate = toInput ? endOfUtcDay(toInput) : null;
    if (!fromDate || !toDate) {
      return {
        preset: "day",
        startDate: startOfUtcDay(pivotDate),
        endDate: endOfUtcDay(pivotDate),
      };
    }

    if (fromDate.getTime() <= toDate.getTime()) {
      return {
        preset,
        startDate: fromDate,
        endDate: toDate,
      };
    }

    return {
      preset,
      startDate: startOfUtcDay(toInput),
      endDate: endOfUtcDay(fromInput),
    };
  }

  if (preset === "week") {
    const endDate = endOfUtcDay(pivotDate);
    const startDate = startOfUtcDay(new Date(endDate.getTime() - 6 * DAY_MS));
    return {
      preset,
      startDate,
      endDate,
    };
  }

  if (preset === "month") {
    const endDate = endOfUtcDay(pivotDate);
    const startDate = startOfUtcDay(new Date(endDate.getTime() - 29 * DAY_MS));
    return {
      preset,
      startDate,
      endDate,
    };
  }

  return {
    preset: "day",
    startDate: startOfUtcDay(pivotDate),
    endDate: endOfUtcDay(pivotDate),
  };
};

const getRangeDays = (startDate, endDate) => {
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) return 0;
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  const diff = endDate.getTime() - startDate.getTime();
  if (diff < 0) return 0;
  return Math.max(1, Math.ceil((diff + 1) / DAY_MS));
};

const buildOrdersMatch = ({
  startDate,
  endDate,
  restaurantId,
  userId,
  orderType = "all",
}) => {
  const normalizedStatusExpr = {
    $toLower: {
      $trim: {
        input: { $ifNull: ["$status", ""] },
      },
    },
  };
  const canceledStatuses = [
    "annule",
    "annulé",
    "annulee",
    "annulée",
    "cancelled",
    "canceled",
  ];

  const { isDeliveryExpr, isPickupExpr } = getOrderTypeExpressions();
  const normalizedOrderType = String(orderType || "all")
    .trim()
    .toLowerCase();
  const shouldFilterDelivery = ["delivery", "livraison"].includes(
    normalizedOrderType,
  );
  const shouldFilterPickup = ["pickup", "pick up", "pick-up", "ramassage"].includes(
    normalizedOrderType,
  );

  const exprConditions = [
    {
      $not: [{ $in: [normalizedStatusExpr, canceledStatuses] }],
    },
  ];

  if (shouldFilterDelivery) {
    exprConditions.push(isDeliveryExpr);
  } else if (shouldFilterPickup) {
    exprConditions.push(isPickupExpr);
  }

  const match = {
    confirmed: true,
    $expr:
      exprConditions.length === 1
        ? exprConditions[0]
        : { $and: exprConditions },
  };

  if (startDate instanceof Date && endDate instanceof Date) {
    match.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  const restaurantObjectId = toObjectId(restaurantId);
  if (restaurantObjectId) {
    match.restaurant = restaurantObjectId;
  }

  const userObjectId = toObjectId(userId);
  if (userObjectId) {
    match.user = userObjectId;
  }

  return match;
};

const fillRevenueByDay = (series, startDate, endDate) => {
  if (
    !(startDate instanceof Date) ||
    !(endDate instanceof Date) ||
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return series;
  }

  const map = new Map(
    (series || []).map((entry) => [
      String(entry.day || ""),
      {
        day: String(entry.day || ""),
        revenue: roundMoney(entry.revenue, 0),
        orders: Math.max(0, Math.floor(safeNumber(entry.orders, 0))),
      },
    ]),
  );

  const filled = [];
  for (
    let cursor = startOfUtcDay(startDate);
    cursor.getTime() <= endDate.getTime();
    cursor = new Date(cursor.getTime() + DAY_MS)
  ) {
    const key = formatIsoDay(cursor);
    const existing = map.get(key);
    filled.push(
      existing || {
        day: key,
        revenue: 0,
        orders: 0,
      },
    );
  }

  return filled;
};

const buildOrdersAnalytics = async ({
  startDate = null,
  endDate = null,
  restaurantId = "",
  userId = "",
  orderType = "all",
  timezone = DEFAULT_TIMEZONE,
  topProductsLimit = 10,
  includeFrequency = true,
}) => {
  const Order = mongoose.models.Order;
  const match = buildOrdersMatch({
    startDate,
    endDate,
    restaurantId,
    userId,
    orderType,
  });
  const { isDeliveryExpr, isPickupExpr } = getOrderTypeExpressions();

  const [
    summaryAgg,
    revenueByDayAgg,
    revenueByRestaurantAgg,
    ordersByHourAgg,
    ordersByWeekdayAgg,
    topMenuItemsAgg,
    topOffersAgg,
  ] = await Promise.all([
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $ifNull: ["$total_price", 0] } },
          totalOrders: { $sum: 1 },
          promoOrders: {
            $sum: {
              $cond: [{ $ne: ["$promoCode", null] }, 1, 0],
            },
          },
          deliveryOrders: {
            $sum: {
              $cond: [isDeliveryExpr, 1, 0],
            },
          },
          pickupOrders: {
            $sum: {
              $cond: [isPickupExpr, 1, 0],
            },
          },
          firstOrderAt: { $min: "$createdAt" },
          lastOrderAt: { $max: "$createdAt" },
        },
      },
    ]),
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            day: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone,
              },
            },
          },
          revenue: { $sum: { $ifNull: ["$total_price", 0] } },
          orders: { $sum: 1 },
        },
      },
      { $sort: { "_id.day": 1 } },
      {
        $project: {
          _id: 0,
          day: "$_id.day",
          revenue: { $round: ["$revenue", 2] },
          orders: 1,
        },
      },
    ]),
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$restaurant",
          revenue: { $sum: { $ifNull: ["$total_price", 0] } },
          orders: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "restaurants",
          localField: "_id",
          foreignField: "_id",
          as: "restaurant",
        },
      },
      {
        $project: {
          _id: 0,
          restaurantId: "$_id",
          restaurantName: {
            $ifNull: [{ $arrayElemAt: ["$restaurant.name", 0] }, "Sans restaurant"],
          },
          revenue: { $round: ["$revenue", 2] },
          orders: 1,
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            hour: { $hour: { date: "$createdAt", timezone } },
          },
          orders: { $sum: 1 },
          revenue: { $sum: { $ifNull: ["$total_price", 0] } },
        },
      },
      { $sort: { "_id.hour": 1 } },
      {
        $project: {
          _id: 0,
          hour: "$_id.hour",
          orders: 1,
          revenue: { $round: ["$revenue", 2] },
        },
      },
    ]),
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            dayOfWeek: { $dayOfWeek: { date: "$createdAt", timezone } },
          },
          orders: { $sum: 1 },
          revenue: { $sum: { $ifNull: ["$total_price", 0] } },
        },
      },
      { $sort: { "_id.dayOfWeek": 1 } },
      {
        $project: {
          _id: 0,
          dayOfWeek: "$_id.dayOfWeek",
          orders: 1,
          revenue: { $round: ["$revenue", 2] },
        },
      },
    ]),
    Order.aggregate([
      { $match: match },
      { $unwind: { path: "$orderItems", preserveNullAndEmptyArrays: false } },
      {
        $match: {
          "orderItems.item": { $ne: null },
        },
      },
      {
        $group: {
          _id: "$orderItems.item",
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ["$orderItems.price", 0] } },
        },
      },
      {
        $lookup: {
          from: "menuitems",
          localField: "_id",
          foreignField: "_id",
          as: "menuItem",
        },
      },
      {
        $project: {
          _id: 0,
          key: { $concat: ["item:", { $toString: "$_id" }] },
          name: {
            $ifNull: [{ $arrayElemAt: ["$menuItem.name", 0] }, "Article supprime"],
          },
          count: 1,
          revenue: { $round: ["$revenue", 2] },
          itemType: { $literal: "article" },
        },
      },
    ]),
    Order.aggregate([
      { $match: match },
      { $unwind: { path: "$offers", preserveNullAndEmptyArrays: false } },
      {
        $match: {
          "offers.offer": { $ne: null },
        },
      },
      {
        $group: {
          _id: "$offers.offer",
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ["$offers.price", 0] } },
        },
      },
      {
        $lookup: {
          from: "offers",
          localField: "_id",
          foreignField: "_id",
          as: "offer",
        },
      },
      {
        $project: {
          _id: 0,
          key: { $concat: ["offer:", { $toString: "$_id" }] },
          name: {
            $ifNull: [{ $arrayElemAt: ["$offer.name", 0] }, "Offre supprimee"],
          },
          count: 1,
          revenue: { $round: ["$revenue", 2] },
          itemType: { $literal: "offre" },
        },
      },
    ]),
  ]);

  const summary = summaryAgg?.[0] || {};
  const totalRevenue = roundMoney(summary.totalRevenue, 0);
  const totalOrders = Math.max(0, Math.floor(safeNumber(summary.totalOrders, 0)));
  const promoOrders = Math.max(0, Math.floor(safeNumber(summary.promoOrders, 0)));
  const deliveryOrders = Math.max(
    0,
    Math.floor(safeNumber(summary.deliveryOrders, 0)),
  );
  const pickupOrders = Math.max(0, Math.floor(safeNumber(summary.pickupOrders, 0)));
  const noPromoOrders = Math.max(0, totalOrders - promoOrders);
  const otherTypeOrders = Math.max(0, totalOrders - deliveryOrders - pickupOrders);
  const averageBasket = totalOrders > 0 ? roundMoney(totalRevenue / totalOrders, 0) : 0;

  let frequencyPerWeek = null;
  let frequencyPerMonth = null;
  let averageDaysBetweenOrders = null;
  if (includeFrequency) {
    const summaryStart = startDate || summary.firstOrderAt || null;
    const summaryEnd = endDate || summary.lastOrderAt || null;
    const rangeDays =
      getRangeDays(summaryStart, summaryEnd) || (totalOrders > 0 ? 1 : 0);
    frequencyPerWeek =
      rangeDays > 0 ? roundMoney((totalOrders / rangeDays) * 7, 0) : 0;
    frequencyPerMonth =
      rangeDays > 0 ? roundMoney((totalOrders / rangeDays) * 30, 0) : 0;
    averageDaysBetweenOrders =
      totalOrders > 1 && rangeDays > 0
        ? roundMoney(rangeDays / (totalOrders - 1), 0)
        : 0;
  }

  const revenueByDaySeries =
    startDate && endDate
      ? fillRevenueByDay(revenueByDayAgg || [], startDate, endDate)
      : (revenueByDayAgg || []).map((entry) => ({
          day: entry.day,
          revenue: roundMoney(entry.revenue, 0),
          orders: Math.max(0, Math.floor(safeNumber(entry.orders, 0))),
        }));

  const ordersByHourMap = new Map(
    (ordersByHourAgg || []).map((entry) => [
      Math.max(0, Math.min(23, Math.floor(safeNumber(entry.hour, 0)))),
      {
        orders: Math.max(0, Math.floor(safeNumber(entry.orders, 0))),
        revenue: roundMoney(entry.revenue, 0),
      },
    ]),
  );
  const ordersByHour = Array.from({ length: 24 }, (_, hour) => {
    const existing = ordersByHourMap.get(hour);
    return {
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      orders: existing?.orders || 0,
      revenue: existing?.revenue || 0,
    };
  });

  const ordersByWeekdayMap = new Map(
    (ordersByWeekdayAgg || []).map((entry) => [
      Math.max(1, Math.min(7, Math.floor(safeNumber(entry.dayOfWeek, 1)))),
      {
        orders: Math.max(0, Math.floor(safeNumber(entry.orders, 0))),
        revenue: roundMoney(entry.revenue, 0),
      },
    ]),
  );
  const orderedWeekdays = [2, 3, 4, 5, 6, 7, 1];
  const ordersByWeekday = orderedWeekdays.map((dayOfWeek) => ({
    dayOfWeek,
    label: WEEKDAY_LABELS[dayOfWeek],
    orders: ordersByWeekdayMap.get(dayOfWeek)?.orders || 0,
    revenue: ordersByWeekdayMap.get(dayOfWeek)?.revenue || 0,
  }));

  const topProducts = [...(topMenuItemsAgg || []), ...(topOffersAgg || [])]
    .map((entry) => ({
      key: entry.key,
      name: String(entry.name || "Produit"),
      count: Math.max(0, Math.floor(safeNumber(entry.count, 0))),
      revenue: roundMoney(entry.revenue, 0),
      itemType: entry.itemType || "article",
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.revenue - a.revenue;
    })
    .slice(0, Math.max(1, Math.floor(safeNumber(topProductsLimit, 10))));

  const preferredHour = ordersByHour.reduce(
    (best, current) => (current.orders > best.orders ? current : best),
    { hour: null, label: "-", orders: 0 },
  );
  const preferredDay = ordersByWeekday.reduce(
    (best, current) => (current.orders > best.orders ? current : best),
    { dayOfWeek: null, label: "-", orders: 0 },
  );

  return {
    summary: {
      totalOrders,
      totalRevenue,
      averageBasket,
      frequencyPerWeek,
      frequencyPerMonth,
      averageDaysBetweenOrders,
      promoOrders,
      noPromoOrders,
      promoUsageRate: totalOrders > 0 ? roundMoney((promoOrders / totalOrders) * 100, 0) : 0,
      deliveryOrders,
      pickupOrders,
      otherTypeOrders,
      deliveryRate:
        totalOrders > 0 ? roundMoney((deliveryOrders / totalOrders) * 100, 0) : 0,
      pickupRate:
        totalOrders > 0 ? roundMoney((pickupOrders / totalOrders) * 100, 0) : 0,
      preferredOrderHour: preferredHour.label || "-",
      preferredOrderDay: preferredDay.label || "-",
      favoriteProduct: topProducts?.[0]?.name || "-",
      firstOrderAt: summary.firstOrderAt || null,
      lastOrderAt: summary.lastOrderAt || null,
    },
    charts: {
      revenueByDay: revenueByDaySeries,
      revenueByRestaurant: (revenueByRestaurantAgg || []).map((entry) => ({
        restaurantId: entry.restaurantId || null,
        restaurantName: entry.restaurantName || "Sans restaurant",
        revenue: roundMoney(entry.revenue, 0),
        orders: Math.max(0, Math.floor(safeNumber(entry.orders, 0))),
      })),
      ordersByHour,
      ordersByWeekday,
      promoUsage: [
        { label: "Avec promo", value: promoOrders },
        { label: "Sans promo", value: noPromoOrders },
      ],
      deliveryVsPickup: [
        { label: "Livraison", value: deliveryOrders },
        { label: "Ramassage", value: pickupOrders },
        { label: "Autre", value: otherTypeOrders },
      ],
      topProducts,
    },
  };
};

module.exports = {
  resolveDateRange,
  buildOrdersAnalytics,
  toObjectId,
  DEFAULT_TIMEZONE,
};
