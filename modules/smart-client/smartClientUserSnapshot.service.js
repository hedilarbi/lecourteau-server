const User = require("../../models/User");
const Order = require("../../models/Order");

const HISTORY_LIMIT = 20;

class SmartClientUserSnapshotService {
  async get(userId) {
    const [user, recentOrders] = await Promise.all([
      User.findById(userId).select("favorites createdAt orders fidelity_points subscriptionIsActive date_of_birth").lean(),
      Order.find({ user: userId, $or: [{ confirmed: true }, { payment_status: true }] })
        .select("orderItems.item sub_total total_price type createdAt")
        .sort({ createdAt: -1 })
        .limit(HISTORY_LIMIT)
        .lean(),
    ]);

    const totals = recentOrders
      .map((order) => Number(order.sub_total ?? order.total_price))
      .filter(Number.isFinite);
    const itemFrequency = new Map();
    const orderTypeFrequency = new Map();
    recentOrders.forEach((order) => {
      (order.orderItems || []).forEach(({ item }) => {
        const id = String(item || "");
        if (id) itemFrequency.set(id, (itemFrequency.get(id) || 0) + 1);
      });
      const orderType = String(order.type || "").toLowerCase();
      if (orderType) orderTypeFrequency.set(orderType, (orderTypeFrequency.get(orderType) || 0) + 1);
    });
    const habitualMinimum = Math.max(2, Math.ceil(recentOrders.length * 0.3));
    const preferredOrderType = [...orderTypeFrequency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";

    return {
      generatedAt: new Date(),
      historyWindow: recentOrders.length,
      averageBasket: totals.length ? totals.reduce((sum, total) => sum + total, 0) / totals.length : 0,
      habitualItemIds: [...itemFrequency.entries()].filter(([, count]) => count >= habitualMinimum).map(([id]) => id),
      favoriteItemIds: (user?.favorites || []).map(String),
      preferredOrderType,
      orderCount: user?.orders?.length || recentOrders.length,
      accountAgeDays: user?.createdAt ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000) : 0,
      fidelityPoints: user?.fidelity_points || 0,
      subscriptionIsActive: Boolean(user?.subscriptionIsActive),
      hasDateOfBirth: Boolean(user?.date_of_birth),
    };
  }

  enrichSignals(signals = {}, snapshot = {}) {
    const enriched = JSON.parse(JSON.stringify(signals || {}));
    enriched.cart = enriched.cart || {};
    enriched.session = enriched.session || {};
    enriched.context = enriched.context || {};
    const total = Number(enriched.cart.total || 0);
    const average = Number(snapshot.averageBasket || 0);
    const itemIds = (enriched.cart.itemIds || []).map(String);
    const habitualIds = new Set((snapshot.habitualItemIds || []).map(String));
    const interactionTimestamps = (enriched.session.interactionTimestamps || []).map(Number).filter(Number.isFinite);
    const cutoff = Date.now() - 2000;

    enriched.cart.ratioVsHabit = average > 0 ? total / average : 0;
    enriched.cart.belowHabitPct = average > 0 ? Math.max(0, ((average - total) / average) * 100) : 0;
    enriched.cart.habitualItemsOnly = itemIds.length > 0 && itemIds.every((id) => habitualIds.has(id));
    enriched.session.velocityScore = interactionTimestamps.filter((timestamp) => timestamp >= cutoff).length;
    enriched.context.preferredOrderType = snapshot.preferredOrderType || "unknown";
    return enriched;
  }
}

module.exports = new SmartClientUserSnapshotService();
