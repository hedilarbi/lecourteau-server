const Order = require("../../models/Order");
const { SCHEDULED, ON_GOING } = require("../../utils/constants");
const {
  createUberDirectDeliveryForOrder,
} = require("../../controllers/uberDirect");

const isDeliveryOrderType = (type) =>
  ["delivery", "devliery"].includes(
    String(type || "")
      .toLowerCase()
      .trim(),
  );

const getRestaurantIdFromOrder = (order) =>
  (typeof order?.restaurant === "object"
    ? order?.restaurant?._id || order.restaurant
    : order?.restaurant) || null;

const buildDueScheduledOrdersQuery = ({ restaurantId } = {}) => {
  const now = new Date();
  const in45Min = new Date(now.getTime() + 45 * 60 * 1000);
  const in30Min = new Date(now.getTime() + 30 * 60 * 1000);

  const query = {
    confirmed: true,
    status: SCHEDULED,
    "scheduled.isScheduled": true,
    "scheduled.processed": false,
    "scheduled.scheduledFor": { $ne: null },
    $or: [
      {
        type: { $in: ["delivery", "devliery"] },
        "scheduled.scheduledFor": { $lte: in45Min },
      },
      {
        type: { $nin: ["delivery", "devliery"] },
        "scheduled.scheduledFor": { $lte: in30Min },
      },
    ],
  };

  if (restaurantId) {
    query.restaurant = restaurantId;
  }

  return query;
};

const createUberDeliveryForScheduledOrder = async (order, source) => {
  if (!isDeliveryOrderType(order?.type)) {
    return null;
  }

  const restaurantId = getRestaurantIdFromOrder(order);
  const result = await createUberDirectDeliveryForOrder({
    orderId: order._id,
    restaurantId,
  });

  if (result?.success) {
    console.log(
      `[scheduledOrdersPromotion] ${new Date().toISOString()} - Uber delivery created ${JSON.stringify(
        {
          orderId: order._id,
          restaurantId,
          source,
        },
      )}`,
    );
    return null;
  }

  const message =
    result?.message ||
    "Création de livraison Uber Direct échouée pour la commande programmée.";

  console.log(
    `[scheduledOrdersPromotion] ${new Date().toISOString()} - Error creating Uber delivery ${JSON.stringify(
      {
        orderId: order._id,
        restaurantId,
        source,
        message,
        details: result?.details || null,
      },
    )}`,
  );

  return {
    orderId: order._id,
    message,
  };
};

const promoteScheduledOrdersService = async ({ restaurantId } = {}) => {
  const query = buildDueScheduledOrdersQuery({ restaurantId });
  const candidates = await Order.find(query).select("_id").lean();
  const uberFailures = [];
  let promotedCount = 0;
  let uberCreationAttempts = 0;

  for (const candidate of candidates) {
    const promotedOrder = await Order.findOneAndUpdate(
      {
        ...query,
        _id: candidate._id,
      },
      {
        $set: {
          status: ON_GOING,
          "scheduled.processed": true,
        },
      },
      { new: true },
    ).select("_id type restaurant scheduled");

    if (!promotedOrder) continue;

    promotedCount += 1;

    if (isDeliveryOrderType(promotedOrder.type)) {
      uberCreationAttempts += 1;
      const failure = await createUberDeliveryForScheduledOrder(
        promotedOrder,
        "promotion",
      );

      if (failure) {
        uberFailures.push(failure);
      }
    }
  }

  return {
    promotedCount,
    uberCreationAttempts,
    uberFailures,
  };
};

module.exports = {
  promoteScheduledOrdersService,
};
