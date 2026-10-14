const crypto = require("crypto");
const SmartClientRule = require("./smartClient.model");
const SmartClientExposure = require("./smartClientExposure.model");

const DAY_MS = 86400000;
const stableBucket = (value) => parseInt(crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 8), 16) % 100;
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const getPath = (object, path) => String(path).split(".").reduce((value, key) => value?.[key], object);

const compare = (actual, operator, expected) => {
  switch (operator) {
    case "eq": return actual === expected;
    case "neq": return actual !== expected;
    case "gt": return actual > expected;
    case "gte": return actual >= expected;
    case "lt": return actual < expected;
    case "lte": return actual <= expected;
    case "in": return Array.isArray(expected) && expected.includes(actual);
    case "not_in": return Array.isArray(expected) && !expected.includes(actual);
    case "contains": return Array.isArray(actual) ? actual.includes(expected) : String(actual || "").includes(String(expected));
    case "exists": return expected ? actual !== undefined && actual !== null : actual === undefined || actual === null;
    default: return false;
  }
};

const matchesRules = (definition, source) => {
  const rules = definition?.rules || [];
  if (!rules.length) return true;
  const results = rules.map((rule) => compare(getPath(source, rule.field), rule.operator, rule.value));
  return definition.operator === "OR" ? results.some(Boolean) : results.every(Boolean);
};

const matchesConditions = (conditions = {}, signals = {}) => {
  const cart = signals.cart || {};
  const session = signals.session || {};
  const context = signals.context || {};
  const checks = [];
  const configuredCart = conditions.cart || {};
  if ((configuredCart.minTotal || 0) > 0) checks.push((cart.total || 0) >= configuredCart.minTotal);
  if (configuredCart.maxTotal != null) checks.push((cart.total || 0) <= configuredCart.maxTotal);
  if ((configuredCart.minItems || 0) > 0) checks.push((cart.lines || 0) >= configuredCart.minItems);
  if (configuredCart.requiredCategories?.length) checks.push(configuredCart.requiredCategories.every((item) => (cart.categories || []).map(String).includes(String(item))));
  if (configuredCart.missingCategories?.length) checks.push(configuredCart.missingCategories.every((item) => !(cart.categories || []).map(String).includes(String(item))));
  if (configuredCart.itemRemovedAfterTotal) checks.push(Boolean(cart.itemRemovedAfterTotal));
  if (configuredCart.sizeDowngraded) checks.push(Boolean(cart.sizeDowngraded));
  if (configuredCart.cartRatioVsHabit && configuredCart.cartRatioVsHabit !== "any") {
    const ratio = Number(cart.ratioVsHabit || 0);
    checks.push(configuredCart.cartRatioVsHabit === "below" ? ratio < 1 : configuredCart.cartRatioVsHabit === "above" ? ratio > 1 : Math.abs(ratio - 1) < 0.05);
  }

  const behavior = conditions.behavior || {};
  if ((behavior.inactivitySeconds || 0) > 0) checks.push((session.idleTime || 0) >= behavior.inactivitySeconds * 1000);
  if ((behavior.sessionDurationMin || 0) > 0) checks.push((session.durationMs || 0) >= behavior.sessionDurationMin * 60000);
  if ((behavior.oscillationsMin || 0) > 0) {
    const observedOscillations = Math.max(
      Number(session.oscillationsCount || (session.isOscillating ? 1 : 0)),
      Number(session.productSwitchesCount || 0),
      Number(session.productRevisitsCount || 0),
    );
    checks.push(observedOscillations >= behavior.oscillationsMin);
  }
  if (behavior.cartCheckoutExit) checks.push(Boolean(session.cartCheckoutExit));
  if (behavior.promoCodeFailed) checks.push(Boolean(session.promoCodeFailed));

  const configuredContext = conditions.context || {};
  const now = new Date();
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const parseTime = (value) => {
    const [hours, minutes] = String(value || "").split(":").map(Number);
    return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
  };
  const builtInSlots = {
    breakfast: [5 * 60, 11 * 60],
    afternoon: [14 * 60, 17 * 60],
    lunch: [11 * 60 + 30, 13 * 60 + 30],
    dinner: [17 * 60 + 30, 20 * 60 + 30],
    late: [22 * 60, 24 * 60],
    late_night: [21 * 60, 24 * 60],
  };
  if (configuredContext.timeSlot && configuredContext.timeSlot !== "all") {
    const range = configuredContext.timeSlot === "custom"
      ? [parseTime(configuredContext.customStartTime), parseTime(configuredContext.customEndTime)]
      : builtInSlots[configuredContext.timeSlot];
    if (range && range.every(Number.isFinite)) checks.push(minutesNow >= range[0] && minutesNow < range[1]);
  }
  if (configuredContext.orderType && configuredContext.orderType !== "all") checks.push(context.orderType === configuredContext.orderType);
  if (configuredContext.channel && configuredContext.channel !== "all") checks.push(context.channel === configuredContext.channel);
  if (configuredContext.daysOfWeek?.length) checks.push(configuredContext.daysOfWeek.map(String).includes(String(new Date().getDay())));

  if (!matchesRules(conditions, signals)) checks.push(false);
  if (!checks.length) return true;
  return conditions.operator === "OR" ? checks.some(Boolean) : checks.every(Boolean);
};

const matchesOfferTarget = (offer = {}, signals = {}, userSnapshot = {}) => {
  const cart = signals.cart || {};
  const session = signals.session || {};
  const itemIds = (cart.itemIds || []).map(String);
  const categoryIds = (cart.categories || []).map(String);
  const removedItemIds = (cart.removedItemIds || []).map(String);
  const viewedItemIds = (session.viewedItemIds || []).map(String);
  const favoriteItemIds = (userSnapshot.favoriteItemIds || []).map(String);
  const productId = String(offer.productId || "");
  const categoryId = String(offer.categoryId || "");
  if ((offer.thresholdValue || 0) > 0 && (cart.total || 0) < offer.thresholdValue) return false;
  if ((offer.thresholdCeiling || 0) > 0 && (cart.total || 0) > offer.thresholdCeiling) return false;
  if (offer.eligibleProductIds?.length && !offer.eligibleProductIds.some((id) => itemIds.includes(String(id)))) return false;
  if (offer.excludedProductIds?.some((id) => itemIds.includes(String(id)))) return false;
  switch (offer.targetType) {
    case "item": return !productId || itemIds.includes(productId);
    case "category": return !categoryId || categoryIds.includes(categoryId);
    case "missing_role": return !categoryId || !(cart.roles || []).map(String).includes(categoryId);
    case "removed_item": return !productId || removedItemIds.includes(productId);
    case "viewed_item": return !productId || viewedItemIds.includes(productId);
    case "favorite_item": return !productId || favoriteItemIds.includes(productId);
    case "size_upgrade": return Boolean(cart.sizeDowngraded);
    default: return true;
  }
};

const expiryFor = (duration, now) => {
  const durations = { "10min": 600000, "15min": 900000, "30min": 1800000, "24h": DAY_MS, "48h": 2 * DAY_MS, "7_days": 7 * DAY_MS };
  if (duration === "session") return null;
  if (duration === "weekend") {
    const end = new Date(now);
    end.setDate(end.getDate() + ((7 - end.getDay()) % 7));
    end.setHours(23, 59, 59, 999);
    return end;
  }
  return new Date(now.getTime() + (durations[duration] || 0));
};

class SmartClientEligibilityService {
  async isWithinCaps(rule, userId, sessionId, now) {
    const safeguards = rule.safeguards || {};
    const day = startOfDay(now);
    const week = new Date(day.getTime() - 6 * DAY_MS);
    const [sessionCount, dayCount, weekCount, lastRefusal, dailyCost, totalCost] = await Promise.all([
      SmartClientExposure.countDocuments({ rule: rule._id, sessionId, group: "exposed" }),
      SmartClientExposure.countDocuments({ rule: rule._id, user: userId, group: "exposed", createdAt: { $gte: day } }),
      SmartClientExposure.countDocuments({ rule: rule._id, user: userId, group: "exposed", createdAt: { $gte: week } }),
      SmartClientExposure.findOne({ rule: rule._id, user: userId, status: "refused" }).sort({ refusedAt: -1 }).lean(),
      SmartClientExposure.aggregate([{ $match: { rule: rule._id, createdAt: { $gte: day } } }, { $group: { _id: null, value: { $sum: "$discountCost" } } }]),
      SmartClientExposure.aggregate([{ $match: { rule: rule._id } }, { $group: { _id: null, value: { $sum: "$discountCost" } } }]),
    ]);
    if (safeguards.maxPerSession != null && sessionCount >= safeguards.maxPerSession) return false;
    if (safeguards.maxPerDay != null && dayCount >= safeguards.maxPerDay) return false;
    if (safeguards.maxPerWeek != null && weekCount >= safeguards.maxPerWeek) return false;
    if (lastRefusal?.refusedAt && now - new Date(lastRefusal.refusedAt) < (safeguards.delayAfterRefusal || 0) * 3600000) return false;
    if (safeguards.maxBudgetDaily != null && (dailyCost[0]?.value || 0) >= safeguards.maxBudgetDaily) return false;
    if (safeguards.maxBudgetTotal != null && (totalCost[0]?.value || 0) >= safeguards.maxBudgetTotal) return false;
    return true;
  }

  async evaluate({ userId, sessionId, event, state, location, signals = {}, userSnapshot = {} }) {
    const now = new Date();
    const currentExposure = await SmartClientExposure.findOne({
      user: userId,
      group: "exposed",
      status: { $in: ["displayed", "accepted"] },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }).lean();
    if (currentExposure) {
      return { eligible: false, group: "exposed", exposureId: currentExposure._id, rule: null, blockedBy: "active_smart_client_offer" };
    }
    const profile = {
      accountAgeDays: userSnapshot.accountAgeDays || 0,
      orderCount: userSnapshot.orderCount || 0,
      fidelityPoints: userSnapshot.fidelityPoints || 0,
      favoriteCount: userSnapshot.favoriteItemIds?.length || 0,
      subscriptionIsActive: Boolean(userSnapshot.subscriptionIsActive),
      hasDateOfBirth: Boolean(userSnapshot.hasDateOfBirth),
    };
    const query = {
      status: "active",
      triggerEvent: event,
      $and: [
        { $or: [{ "safeguards.startDate": null }, { "safeguards.startDate": { $lte: now } }] },
        { $or: [{ "safeguards.endDate": null }, { "safeguards.endDate": { $gte: now } }] },
      ],
    };
    const normalizedLocation = String(location || "").toLowerCase();
    const knownLocations = new Set(["home", "category", "product", "cart_banner", "checkout", "confirmation", "in_app"]);
    if (knownLocations.has(normalizedLocation)) {
      query.location = normalizedLocation === "in_app"
        ? "in_app"
        : { $in: [normalizedLocation, "in_app"] };
    }
    const rules = await SmartClientRule.find(query).sort({ "safeguards.priority": -1, createdAt: -1 });

    for (const rule of rules) {
      if (rule.selectedStates?.length && !rule.selectedStates.includes(state)) continue;
      if (!matchesConditions(rule.conditions, signals)) continue;
      if (!matchesOfferTarget(rule.offer, signals, userSnapshot)) continue;
      if (rule.hasProfileFilter && !matchesRules(rule.profileConditions, profile)) continue;
      if (!(await this.isWithinCaps(rule, userId, sessionId, now))) continue;

      const assignmentKey = `${rule._id}:${userId}`;
      const bucket = stableBucket(assignmentKey);
      if (bucket >= (rule.safeguards?.triggerRate ?? 100)) continue;
      const group = bucket < (rule.safeguards?.controlGroupPct ?? 0) ? "control" : "exposed";
      const variant = this.selectVariant(rule, `${assignmentKey}:variant`);
      const exposure = await SmartClientExposure.create({
        rule: rule._id, ruleVersion: rule.version,
        user: userId, sessionId, assignmentKey, group, variant,
        expiresAt: expiryFor(rule.validityDuration, now), context: { state, event, location },
      });
      const resolvedRule = rule.toObject();
      const variantConfig = rule.offer?.variants?.find((item) => item.key === variant);
      if (variantConfig) {
        if (variantConfig.value != null) resolvedRule.offer.value = variantConfig.value;
        if (variantConfig.productId) resolvedRule.offer.productId = variantConfig.productId;
      }
      return { eligible: group === "exposed", group, exposureId: exposure._id, variant, rule: group === "exposed" ? resolvedRule : null };
    }
    return { eligible: false, group: null, exposureId: null, rule: null };
  }

  selectVariant(rule, key) {
    const variants = rule.offer?.variants || [];
    if (!variants.length || rule.offer?.distribution === "single") return "default";
    const bucket = stableBucket(key);
    let cursor = 0;
    for (const variant of variants) {
      cursor += variant.weight || 0;
      if (bucket < cursor) return variant.key;
    }
    return variants[variants.length - 1]?.key || "default";
  }

  async recordOutcome(exposureId, userId, status, payload = {}) {
    const allowed = { displayed: "displayedAt", accepted: "acceptedAt", refused: "refusedAt", converted: "convertedAt", ignored: "ignoredAt" };
    if (!allowed[status]) {
      const error = new Error("Statut d'exposition invalide.");
      error.statusCode = 400;
      throw error;
    }
    return SmartClientExposure.findOneAndUpdate(
      { _id: exposureId, user: userId },
      { $set: { status, [allowed[status]]: new Date(), ...(payload.orderId ? { order: payload.orderId } : {}), ...(payload.discountCost != null ? { discountCost: payload.discountCost } : {}), ...(payload.revenue != null ? { revenue: payload.revenue } : {}) } },
      { new: true, runValidators: true },
    );
  }
}

module.exports = new SmartClientEligibilityService();
