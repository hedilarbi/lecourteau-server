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

const toNumberOrNullExpr = (fieldPath) => ({
  $let: {
    vars: {
      parsed: {
        $convert: {
          input: fieldPath,
          to: "double",
          onError: null,
          onNull: null,
        },
      },
    },
    in: {
      $cond: [
        {
          $or: [
            { $eq: ["$$parsed", null] },
            // NaN guard (NaN is the only value that is not equal to itself)
            { $ne: ["$$parsed", "$$parsed"] },
          ],
        },
        null,
        "$$parsed",
      ],
    },
  },
});

const toNumberOrZeroExpr = (fieldPath) => ({
  $ifNull: [toNumberOrNullExpr(fieldPath), 0],
});

const DAY_KEY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

// Decalage (ms) entre l'heure locale du fuseau et UTC a un instant donne
// (ex: -4h en ete / -5h en hiver pour America/Toronto, gere l'heure avancee).
const getTimezoneOffsetMs = (date, timezone = DEFAULT_TIMEZONE) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || DEFAULT_TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - (date.getTime() - date.getMilliseconds());
};

// Instant UTC correspondant a 00:00 (heure du fuseau) du jour "YYYY-MM-DD".
const startOfZonedDay = (dayKey, timezone = DEFAULT_TIMEZONE) => {
  const [, year, month, day] = dayKey.match(DAY_KEY_REGEX);
  const localMidnightAsUtc = Date.UTC(Number(year), Number(month) - 1, Number(day));
  let result = localMidnightAsUtc - getTimezoneOffsetMs(new Date(localMidnightAsUtc), timezone);
  // Recalcul avec le decalage a l'instant trouve (changement d'heure)
  result = localMidnightAsUtc - getTimezoneOffsetMs(new Date(result), timezone);
  return new Date(result);
};

const addDaysToDayKey = (dayKey, days) => {
  const [, year, month, day] = dayKey.match(DAY_KEY_REGEX);
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + days));
  return formatIsoDay(date);
};

// Fin de journee (23:59:59.999 heure du fuseau) du jour "YYYY-MM-DD".
const endOfZonedDay = (dayKey, timezone = DEFAULT_TIMEZONE) =>
  new Date(startOfZonedDay(addDaysToDayKey(dayKey, 1), timezone).getTime() - 1);

// Convertit une entree en jour calendaire "YYYY-MM-DD" du fuseau.
// "2026-10-16" est pris tel quel (jour de Quebec), un instant ISO est converti.
const parseDayKeyInput = (value, timezone = DEFAULT_TIMEZONE) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (DAY_KEY_REGEX.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatIsoDayInTimezone(parsed, timezone);
};

// Borne d'un jour de Quebec en instant UTC: "start" = 00:00, "end" = 23:59:59.999.
const getZonedDayBoundary = (value, mode = "start", timezone = DEFAULT_TIMEZONE) => {
  const dayKey = parseDayKeyInput(value, timezone);
  if (!dayKey) return null;
  return mode === "end"
    ? endOfZonedDay(dayKey, timezone)
    : startOfZonedDay(dayKey, timezone);
};

const formatIsoDay = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatIsoDayInTimezone = (date, timezone = DEFAULT_TIMEZONE) => {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || DEFAULT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value || "1970";
    const month = parts.find((part) => part.type === "month")?.value || "01";
    const day = parts.find((part) => part.type === "day")?.value || "01";
    return `${year}-${month}-${day}`;
  } catch (error) {
    return formatIsoDay(date);
  }
};

const normalizeDayKey = (value) => {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  const directMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directMatch?.[1]) {
    return directMatch[1];
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return formatIsoDay(parsed);
  }

  return raw;
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

const resolveDateRange = (
  query = {},
  defaultPreset = "day",
  timezone = DEFAULT_TIMEZONE,
) => {
  const preset = String(query?.preset || defaultPreset || "day")
    .trim()
    .toLowerCase();
  const pivotDay =
    parseDayKeyInput(query?.date, timezone) ||
    formatIsoDayInTimezone(new Date(), timezone);
  const fromDay = parseDayKeyInput(query?.from, timezone);
  const toDay = parseDayKeyInput(query?.to, timezone);

  const buildRange = (resolvedPreset, firstDay, lastDay) => ({
    preset: resolvedPreset,
    startDate: startOfZonedDay(firstDay, timezone),
    endDate: endOfZonedDay(lastDay, timezone),
  });

  if (preset === "all") {
    return {
      preset,
      startDate: null,
      endDate: null,
    };
  }

  if (preset === "custom") {
    if (!fromDay || !toDay) {
      return buildRange("day", pivotDay, pivotDay);
    }
    return fromDay <= toDay
      ? buildRange(preset, fromDay, toDay)
      : buildRange(preset, toDay, fromDay);
  }

  if (preset === "week") {
    return buildRange(preset, addDaysToDayKey(pivotDay, -6), pivotDay);
  }

  if (preset === "month") {
    return buildRange(preset, addDaysToDayKey(pivotDay, -29), pivotDay);
  }

  return buildRange("day", pivotDay, pivotDay);
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
  const normalizedPlatformExpr = {
    $toLower: {
      $trim: {
        input: { $ifNull: ["$platform", ""] },
      },
    },
  };
  const isAppPlatformExpr = { $eq: [normalizedPlatformExpr, "app"] };
  const isWebPlatformExpr = { $eq: [normalizedPlatformExpr, "web"] };
  const isUnknownPlatformExpr = {
    $and: [
      { $ne: [normalizedPlatformExpr, "app"] },
      { $ne: [normalizedPlatformExpr, "web"] },
    ],
  };
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

const fillRevenueByDay = (series, startDate, endDate, timezone = DEFAULT_TIMEZONE) => {
  if (
    !(startDate instanceof Date) ||
    !(endDate instanceof Date) ||
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return series;
  }

  const map = new Map(
    (series || [])
      .map((entry) => {
        const dayKey = normalizeDayKey(entry.day);
        if (!dayKey) return null;
        return [
          dayKey,
          {
            day: dayKey,
            revenue: roundMoney(entry.revenue, 0),
            orders: Math.max(0, Math.floor(safeNumber(entry.orders, 0))),
            referralOrders: Math.max(0, Math.floor(safeNumber(entry.referralOrders, 0))),
          },
        ];
      })
      .filter(Boolean),
  );

  const filled = [];
  const lastDay = formatIsoDayInTimezone(endDate, timezone);
  for (
    let dayKey = formatIsoDayInTimezone(startDate, timezone);
    dayKey <= lastDay;
    dayKey = addDaysToDayKey(dayKey, 1)
  ) {
    const existing = map.get(dayKey);
    filled.push(
      existing || {
        day: dayKey,
        revenue: 0,
        orders: 0,
        referralOrders: 0,
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
  const normalizedPlatformExpr = {
    $toLower: {
      $trim: {
        input: { $ifNull: ["$platform", ""] },
      },
    },
  };
  const isAppPlatformExpr = { $eq: [normalizedPlatformExpr, "app"] };
  const isWebPlatformExpr = { $eq: [normalizedPlatformExpr, "web"] };
  const isUnknownPlatformExpr = {
    $and: [
      { $ne: [normalizedPlatformExpr, "app"] },
      { $ne: [normalizedPlatformExpr, "web"] },
    ],
  };
  const totalPriceExpr = toNumberOrZeroExpr("$total_price");
  const deliveryFeeExpr = toNumberOrZeroExpr("$delivery_fee");
  const tipExpr = toNumberOrZeroExpr("$tip");
  const subTotalExpr = toNumberOrNullExpr("$sub_total");
  const subTotalAfterDiscountExpr = toNumberOrNullExpr(
    "$sub_total_after_discount",
  );
  const derivedNetSalesExpr = {
    $max: [
      0,
      {
        $subtract: [totalPriceExpr, { $add: [deliveryFeeExpr, tipExpr] }],
      },
    ],
  };
  const subTotalWithTaxExpr = {
    $max: [
      0,
      {
        $subtract: [
          totalPriceExpr,
          {
            $add: [
              tipExpr,
              { $multiply: [deliveryFeeExpr, 1.14975] }
            ]
          }
        ]
      }
    ]
  };
  const netSalesExpr = {
    $ifNull: [
      subTotalAfterDiscountExpr,
      {
        $ifNull: [subTotalExpr, derivedNetSalesExpr],
      },
    ],
  };

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
          totalRevenue: { $sum: totalPriceExpr },
          totalNetSales: { $sum: netSalesExpr },
          totalDeliveryFee: { $sum: deliveryFeeExpr },
          totalDeliveryFeeWithTax: { $sum: { $multiply: [deliveryFeeExpr, 1.14975] } },
          totalTip: { $sum: tipExpr },
          totalSubTotal: { $sum: subTotalExpr },
          totalSubTotalAfterDiscount: { $sum: subTotalAfterDiscountExpr },
          totalSubTotalAfterTax: { $sum: subTotalWithTaxExpr },
          totalOrders: { $sum: 1 },
          promoOrders: {
            $sum: {
              $cond: [{ $ne: ["$promoCode", null] }, 1, 0],
            },
          },
          referralOrders: {
            $sum: {
              $cond: [{ $gt: [{ $ifNull: ["$referralDiscountApplied", 0] }, 0] }, 1, 0],
            },
          },
          referralDiscountAmount: {
            $sum: { $ifNull: ["$referralDiscountApplied", 0] },
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
          appPlatformOrders: {
            $sum: {
              $cond: [isAppPlatformExpr, 1, 0],
            },
          },
          webPlatformOrders: {
            $sum: {
              $cond: [isWebPlatformExpr, 1, 0],
            },
          },
          unknownPlatformOrders: {
            $sum: {
              $cond: [isUnknownPlatformExpr, 1, 0],
            },
          },
          totalCounter: {
            $sum: {
              $cond: [
                { $eq: ["$payment_method", "cash_at_counter"] },
                totalPriceExpr,
                0,
              ],
            },
          },
          totalOnline: {
            $sum: {
              $cond: [
                { $ne: ["$payment_method", "cash_at_counter"] },
                totalPriceExpr,
                0,
              ],
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
          referralOrders: {
            $sum: {
              $cond: [{ $gt: [{ $ifNull: ["$referralDiscountApplied", 0] }, 0] }, 1, 0],
            },
          },
        },
      },
      { $sort: { "_id.day": 1 } },
      {
        $project: {
          _id: 0,
          day: "$_id.day",
          revenue: { $round: ["$revenue", 2] },
          orders: 1,
          referralOrders: 1,
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
  const totalNetSales = roundMoney(summary.totalNetSales, 0);
  const totalDeliveryFee = roundMoney(summary.totalDeliveryFee, 0);
  const totalDeliveryFeeWithTax = roundMoney(summary.totalDeliveryFeeWithTax, 0);
  const totalTip = roundMoney(summary.totalTip, 0);
  const totalSubTotal = roundMoney(summary.totalSubTotal, 0);
  const totalSubTotalAfterDiscount = roundMoney(summary.totalSubTotalAfterDiscount, 0);
  const totalSubTotalAfterTax = roundMoney(summary.totalSubTotalAfterTax, 0);
  const totalOrders = Math.max(0, Math.floor(safeNumber(summary.totalOrders, 0)));
  const promoOrders = Math.max(0, Math.floor(safeNumber(summary.promoOrders, 0)));
  const referralOrders = Math.max(0, Math.floor(safeNumber(summary.referralOrders, 0)));
  const referralDiscountAmount = roundMoney(summary.referralDiscountAmount, 0);
  const deliveryOrders = Math.max(
    0,
    Math.floor(safeNumber(summary.deliveryOrders, 0)),
  );
  const pickupOrders = Math.max(0, Math.floor(safeNumber(summary.pickupOrders, 0)));
  const appPlatformOrders = Math.max(
    0,
    Math.floor(safeNumber(summary.appPlatformOrders, 0)),
  );
  const webPlatformOrders = Math.max(
    0,
    Math.floor(safeNumber(summary.webPlatformOrders, 0)),
  );
  const unknownPlatformOrders = Math.max(
    0,
    Math.floor(safeNumber(summary.unknownPlatformOrders, 0)),
  );
  const noPromoOrders = Math.max(0, totalOrders - promoOrders);
  const noReferralOrders = Math.max(0, totalOrders - referralOrders);
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
      ? fillRevenueByDay(revenueByDayAgg || [], startDate, endDate, timezone)
      : (revenueByDayAgg || []).map((entry) => ({
          day: entry.day,
          revenue: roundMoney(entry.revenue, 0),
          orders: Math.max(0, Math.floor(safeNumber(entry.orders, 0))),
          referralOrders: Math.max(0, Math.floor(safeNumber(entry.referralOrders, 0))),
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
      totalNetSales,
      totalDeliveryFee,
      totalDeliveryFeeWithTax,
      totalTip,
      totalSubTotal,
      totalSubTotalAfterDiscount,
      totalSubTotalAfterTax,
      averageBasket,
      frequencyPerWeek,
      frequencyPerMonth,
      averageDaysBetweenOrders,
      promoOrders,
      noPromoOrders,
      referralOrders,
      referralDiscountAmount,
      promoUsageRate: totalOrders > 0 ? roundMoney((promoOrders / totalOrders) * 100, 0) : 0,
      deliveryOrders,
      pickupOrders,
      otherTypeOrders,
      appPlatformOrders,
      webPlatformOrders,
      unknownPlatformOrders,
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
      ordersByPlatform: [
        { label: "App", value: appPlatformOrders },
        { label: "Web", value: webPlatformOrders },
        { label: "Non défini", value: unknownPlatformOrders },
      ],
      topProducts,
      paymentBreakdown: [
        { label: "Comptoir", value: roundMoney(summary.totalCounter, 2) },
        { label: "En ligne", value: roundMoney(summary.totalOnline, 2) },
      ],
    },
  };
};

module.exports = {
  resolveDateRange,
  buildOrdersAnalytics,
  getZonedDayBoundary,
  toObjectId,
  DEFAULT_TIMEZONE,
};
