require("dotenv/config");

const Stripe = require("stripe");
const Setting = require("../../models/Setting");
const Subscription = require("../../models/Subscription");
const User = require("../../models/User");

const stripe = Stripe(process.env.STRIPE_PRIVATE_KEY, {
  apiVersion: "2023-08-16",
});

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);
const OPEN_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "incomplete",
  "past_due",
  "unpaid",
]);
const RETRY_GRACE_ELIGIBLE_STATUSES = new Set(["past_due", "unpaid"]);
const SUBSCRIPTION_RENEWAL_RETRY_GRACE_DAYS = Math.max(
  1,
  Math.floor(
    Number(process.env.SUBSCRIPTION_RENEWAL_RETRY_GRACE_DAYS || 3),
  ),
);
const SUBSCRIPTION_RENEWAL_RETRY_GRACE_MS =
  SUBSCRIPTION_RENEWAL_RETRY_GRACE_DAYS * 24 * 60 * 60 * 1000;
const SUBSCRIPTION_DISCOUNT_PERCENT = 15;
const SUBSCRIPTION_PLAN_NAME = "CLUB COURTEAU";
const SUBSCRIPTION_PLAN_DESCRIPTION =
  "Abonnement CLUB COURTEAU: 15% de reduction, 0 frais livraison, 1 article gratuit/mois.";
const SUBSCRIPTION_PLAN_METADATA = "club_courteau";

const normalizeCurrency = (currency) =>
  String(currency || "cad")
    .trim()
    .toLowerCase() || "cad";

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value, fallback = 0) => {
  const normalized = toSafeNumber(value, fallback);
  return Math.round(normalized * 100) / 100;
};

const getSubscriptionRecurringConfig = () => {
  const rawInterval = String(
    process.env.SUBSCRIPTION_STRIPE_INTERVAL || "month",
  )
    .trim()
    .toLowerCase();
  const interval = rawInterval === "day" ? "day" : "month";

  const rawIntervalCount = Number(process.env.SUBSCRIPTION_STRIPE_INTERVAL_COUNT);
  const intervalCount = Number.isFinite(rawIntervalCount) && rawIntervalCount > 0
    ? Math.floor(rawIntervalCount)
    : 1;

  return { interval, intervalCount };
};

const toDateFromStripeTimestamp = (timestamp) => {
  if (!timestamp || !Number.isFinite(Number(timestamp))) return null;
  return new Date(Number(timestamp) * 1000);
};

const getCycleKey = (date = new Date()) => {
  const target = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(target.getTime())) {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(
      2,
      "0",
    )}`;
  }
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}`;
};

const getSubscriptionFreeItemCycleKey = (user, fallbackDate = new Date()) => {
  const periodStart = user?.subscriptionCurrentPeriodStart
    ? new Date(user.subscriptionCurrentPeriodStart)
    : null;

  if (periodStart instanceof Date && !Number.isNaN(periodStart.getTime())) {
    return `period-${periodStart.toISOString()}`;
  }

  return getCycleKey(fallbackDate);
};

const isActiveStatus = (status) =>
  ACTIVE_SUBSCRIPTION_STATUSES.has(String(status || "").toLowerCase());

const isOpenStatus = (status) =>
  OPEN_SUBSCRIPTION_STATUSES.has(String(status || "").toLowerCase());

const toDateOrNull = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const getSubscriptionRenewalGraceEndFromDate = (date = new Date()) => {
  const startDate = toDateOrNull(date) || new Date();
  return new Date(startDate.getTime() + SUBSCRIPTION_RENEWAL_RETRY_GRACE_MS);
};

const clearUserRenewalFailureState = (user) => {
  if (!user) return;
  user.subscriptionRenewalFailureInvoiceId = null;
  user.subscriptionRenewalFailureStartedAt = null;
  user.subscriptionRenewalGraceEndsAt = null;
  user.subscriptionRenewalFirstFailureEmailSentAt = null;
  user.subscriptionSuspendedAt = null;
  user.subscriptionSuspensionReason = "";
  user.subscriptionSuspensionEmailSentAt = null;
};

const isSubscriptionInRetryGrace = (user) => {
  const status = String(user?.subscriptionStatus || "").toLowerCase();
  if (!RETRY_GRACE_ELIGIBLE_STATUSES.has(status)) return false;
  if (toDateOrNull(user?.subscriptionSuspendedAt)) return false;

  const graceEnd = toDateOrNull(user?.subscriptionRenewalGraceEndsAt);
  if (!graceEnd) return false;

  return graceEnd.getTime() > Date.now();
};

const isSubscriptionCurrentlyActive = (user) => {
  if (isActiveStatus(user?.subscriptionStatus)) {
    if (!user?.subscriptionCurrentPeriodEnd) return true;

    const periodEnd = new Date(user.subscriptionCurrentPeriodEnd);
    if (Number.isNaN(periodEnd.getTime())) return true;
    return periodEnd.getTime() > Date.now();
  }

  return isSubscriptionInRetryGrace(user);
};

const ensureUserSavingsDefaults = (user) => {
  const currentSavings = toSafeNumber(user.subscriptionSavingsTotal, 0);
  user.subscriptionSavingsTotal = currentSavings;
  user.subscriptionAmountPaidTotal = toSafeNumber(
    user.subscriptionAmountPaidTotal,
    0,
  );
  user.subscriptionPaymentsCount = toSafeNumber(user.subscriptionPaymentsCount, 0);
};

const ensureUserFreeItemCycle = (user, date = new Date()) => {
  const cycleKey = getSubscriptionFreeItemCycleKey(user, date);
  const previousCycleKey = String(user?.subscriptionFreeItemCycleKey || "").trim();

  if (user.subscriptionFreeItemCycleKey !== cycleKey) {
    const legacyCycleKey = getCycleKey(
      user?.subscriptionCurrentPeriodStart || date,
    );
    const legacyUsedCount = Number(user?.subscriptionFreeItemUsedCount);
    const shouldCarryLegacyUsage =
      previousCycleKey &&
      previousCycleKey === legacyCycleKey &&
      Number.isFinite(legacyUsedCount);

    user.subscriptionFreeItemCycleKey = cycleKey;
    user.subscriptionFreeItemUsedCount = shouldCarryLegacyUsage
      ? Math.max(0, Math.floor(legacyUsedCount))
      : 0;
  } else if (!Number.isFinite(Number(user.subscriptionFreeItemUsedCount))) {
    user.subscriptionFreeItemUsedCount = 0;
  }
};

const getOrCreateSettingDocument = async () => {
  let setting = await Setting.findOne().sort({ _id: 1 });
  if (!setting) {
    setting = new Setting({});
  }

  if (!setting.subscription) {
    setting.subscription = {};
  }

  if (!Number.isFinite(Number(setting.subscription.monthlyPrice))) {
    setting.subscription.monthlyPrice = 11.99;
  }
  setting.subscription.currency = normalizeCurrency(
    setting.subscription.currency || "cad",
  );
  if (typeof setting.subscription.freeItemMenuItemName !== "string") {
    setting.subscription.freeItemMenuItemName = "";
  }
  if (!setting.subscription.freeItemMenuItemId) {
    setting.subscription.freeItemMenuItemId = null;
  }
  setting.subscription.stripeProductId =
    setting.subscription.stripeProductId || "";
  setting.subscription.stripePriceId = setting.subscription.stripePriceId || "";

  await setting.save();
  return setting;
};

const ensureStripeCustomerForUser = async (user) => {
  if (!user) return null;

  if (user.stripe_id) {
    try {
      const existingCustomer = await stripe.customers.retrieve(user.stripe_id);
      if (!existingCustomer?.deleted) {
        return existingCustomer;
      }
    } catch (error) {
      // Ignore and create/resolve below
    }
  }

  let customer = null;
  if (user.email) {
    const listed = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });
    if (listed?.data?.length) {
      customer = listed.data[0];
    }
  }

  if (!customer) {
    customer = await stripe.customers.create({
      email: user.email || undefined,
      name: user.name || undefined,
      metadata: { userId: String(user._id) },
    });
  }

  user.stripe_id = customer.id;
  await user.save();

  return customer;
};

const ensureSubscriptionStripePrice = async (monthlyPriceInput) => {
  const setting = await getOrCreateSettingDocument();
  const monthlyPrice = roundMoney(
    monthlyPriceInput,
    setting.subscription.monthlyPrice || 11.99,
  );
  const currency = normalizeCurrency(setting.subscription.currency || "cad");
  const recurringConfig = getSubscriptionRecurringConfig();
  const desiredPriceNickname = `${SUBSCRIPTION_PLAN_NAME} ${monthlyPrice.toFixed(2)} ${currency.toUpperCase()}`;

  let stripeProductId = setting.subscription.stripeProductId || "";
  let stripePriceId = setting.subscription.stripePriceId || "";

  if (stripeProductId) {
    try {
      const existingProduct = await stripe.products.retrieve(stripeProductId);
      const existingMetadata = existingProduct?.metadata || {};
      const metadataPlan = String(existingMetadata?.plan || "").trim();
      const productNameChanged =
        String(existingProduct?.name || "") !== SUBSCRIPTION_PLAN_NAME;
      const productDescriptionChanged =
        String(existingProduct?.description || "") !==
        SUBSCRIPTION_PLAN_DESCRIPTION;
      const productMetadataChanged = metadataPlan !== SUBSCRIPTION_PLAN_METADATA;

      if (productNameChanged || productDescriptionChanged || productMetadataChanged) {
        await stripe.products.update(stripeProductId, {
          name: SUBSCRIPTION_PLAN_NAME,
          description: SUBSCRIPTION_PLAN_DESCRIPTION,
          metadata: {
            ...existingMetadata,
            plan: SUBSCRIPTION_PLAN_METADATA,
          },
        });
      }
    } catch (error) {
      stripeProductId = "";
    }
  }

  if (!stripeProductId) {
    const product = await stripe.products.create({
      name: SUBSCRIPTION_PLAN_NAME,
      description: SUBSCRIPTION_PLAN_DESCRIPTION,
      metadata: { plan: SUBSCRIPTION_PLAN_METADATA },
    });
    stripeProductId = product.id;
  }

  let shouldCreateNewPrice = !stripePriceId;
  if (stripePriceId) {
    try {
      const existingPrice = await stripe.prices.retrieve(stripePriceId);
      const existingAmount = toSafeNumber(existingPrice?.unit_amount, 0) / 100;
      const amountHasChanged =
        Math.round(existingAmount * 100) !== Math.round(monthlyPrice * 100);
      const currencyChanged =
        normalizeCurrency(existingPrice?.currency || "cad") !== currency;
      const priceInactive = existingPrice?.active === false;
      const recurringInterval = String(
        existingPrice?.recurring?.interval || "",
      ).toLowerCase();
      const recurringIntervalCount = toSafeNumber(
        existingPrice?.recurring?.interval_count,
        1,
      );
      const recurringChanged =
        recurringInterval !== recurringConfig.interval ||
        recurringIntervalCount !== recurringConfig.intervalCount;

      shouldCreateNewPrice =
        amountHasChanged || currencyChanged || priceInactive || recurringChanged;

      if (!shouldCreateNewPrice) {
        const existingMetadata = existingPrice?.metadata || {};
        const metadataPlan = String(existingMetadata?.plan || "").trim();
        const nicknameChanged =
          String(existingPrice?.nickname || "") !== desiredPriceNickname;
        const metadataChanged = metadataPlan !== SUBSCRIPTION_PLAN_METADATA;

        if (nicknameChanged || metadataChanged) {
          await stripe.prices.update(stripePriceId, {
            nickname: desiredPriceNickname,
            metadata: {
              ...existingMetadata,
              plan: SUBSCRIPTION_PLAN_METADATA,
            },
          });
        }
      }
    } catch (error) {
      shouldCreateNewPrice = true;
    }
  }

  if (shouldCreateNewPrice) {
    const createdPrice = await stripe.prices.create({
      currency,
      product: stripeProductId,
      unit_amount: Math.round(monthlyPrice * 100),
      recurring: {
        interval: recurringConfig.interval,
        interval_count: recurringConfig.intervalCount,
      },
      nickname: desiredPriceNickname,
      metadata: { plan: SUBSCRIPTION_PLAN_METADATA },
    });
    stripePriceId = createdPrice.id;
  }

  setting.subscription.monthlyPrice = monthlyPrice;
  setting.subscription.currency = currency;
  setting.subscription.stripeProductId = stripeProductId;
  setting.subscription.stripePriceId = stripePriceId;
  await setting.save();

  return {
    setting,
    monthlyPrice,
    currency,
    stripeProductId,
    stripePriceId,
  };
};

const syncUserWithStripeSubscription = async (
  user,
  stripeSubscription,
  options = {},
) => {
  if (!user || !stripeSubscription) return null;

  const status = String(stripeSubscription.status || "inactive").toLowerCase();
  const cancelAtPeriodEnd = Boolean(stripeSubscription.cancel_at_period_end);
  const currentPeriodStart = toDateFromStripeTimestamp(
    stripeSubscription.current_period_start,
  );
  const currentPeriodEnd = toDateFromStripeTimestamp(
    stripeSubscription.current_period_end,
  );
  const stripePriceId = stripeSubscription.items?.data?.[0]?.price?.id || "";
  const monthlyPriceFromStripe = toSafeNumber(
    stripeSubscription.items?.data?.[0]?.price?.unit_amount,
    0,
  );
  const monthlyPrice = roundMoney(
    monthlyPriceFromStripe > 0
      ? monthlyPriceFromStripe / 100
      : options.monthlyPrice || user.subscriptionMonthlyPrice || 11.99,
    11.99,
  );

  ensureUserSavingsDefaults(user);
  user.subscriptionStatus = status;
  user.subscriptionAutoRenew = !cancelAtPeriodEnd;
  user.subscriptionStripeSubscriptionId = stripeSubscription.id;
  user.subscriptionCurrentPeriodStart = currentPeriodStart;
  user.subscriptionCurrentPeriodEnd = currentPeriodEnd;
  user.subscriptionMonthlyPrice = monthlyPrice;
  ensureUserFreeItemCycle(user, currentPeriodStart || new Date());
  if (isActiveStatus(status)) {
    clearUserRenewalFailureState(user);
  }
  user.subscriptionIsActive = isSubscriptionCurrentlyActive(user);

  await user.save();

  const persisted = await Subscription.findOneAndUpdate(
    { stripeSubscriptionId: stripeSubscription.id },
    {
      user: user._id,
      stripeCustomerId:
        stripeSubscription.customer || user.stripe_id || options.customerId || "",
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId,
      status,
      cancelAtPeriodEnd,
      canceledAt: cancelAtPeriodEnd ? new Date() : null,
      currentPeriodStart,
      currentPeriodEnd,
      monthlyPrice,
      currency: normalizeCurrency(
        stripeSubscription.items?.data?.[0]?.price?.currency ||
          options.currency ||
          "cad",
      ),
      freeItemCycleKey:
        user.subscriptionFreeItemCycleKey ||
        getSubscriptionFreeItemCycleKey(user, currentPeriodStart || new Date()),
      freeItemUsedCount: toSafeNumber(user.subscriptionFreeItemUsedCount, 0),
      savingsTotal: toSafeNumber(user.subscriptionSavingsTotal, 0),
      lastStripePayload: {
        id: stripeSubscription.id,
        status,
        cancel_at_period_end: cancelAtPeriodEnd,
        current_period_start: stripeSubscription.current_period_start,
        current_period_end: stripeSubscription.current_period_end,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return persisted;
};

const setUserSubscriptionInactive = async (user, status = "canceled") => {
  if (!user) return;
  ensureUserSavingsDefaults(user);
  ensureUserFreeItemCycle(user);

  user.subscriptionIsActive = false;
  user.subscriptionStatus = String(status || "inactive");
  user.subscriptionAutoRenew = false;
  user.subscriptionCurrentPeriodStart = null;
  user.subscriptionCurrentPeriodEnd = null;
  await user.save();
};

const buildUserSubscriptionSummary = (user, config = {}) => {
  const currentCycleKey = getSubscriptionFreeItemCycleKey(user, new Date());
  const usedInCurrentCycle =
    user?.subscriptionFreeItemCycleKey === currentCycleKey
      ? toSafeNumber(user?.subscriptionFreeItemUsedCount, 0)
      : 0;
  const freeItemRemaining = Math.max(0, 1 - usedInCurrentCycle);
  const status = String(user?.subscriptionStatus || "inactive")
    .trim()
    .toLowerCase();
  const isDelinquent = RETRY_GRACE_ELIGIBLE_STATUSES.has(status);
  const isInRetryGrace = isSubscriptionInRetryGrace(user);

  return {
    isActive: isSubscriptionCurrentlyActive(user),
    status,
    autoRenew: Boolean(user?.subscriptionAutoRenew),
    stripeSubscriptionId: user?.subscriptionStripeSubscriptionId || null,
    currentPeriodStart: user?.subscriptionCurrentPeriodStart || null,
    currentPeriodEnd: user?.subscriptionCurrentPeriodEnd || null,
    renewalFailureStartedAt: user?.subscriptionRenewalFailureStartedAt || null,
    renewalGraceEndsAt: user?.subscriptionRenewalGraceEndsAt || null,
    renewalFailureInvoiceId: user?.subscriptionRenewalFailureInvoiceId || null,
    suspendedAt: user?.subscriptionSuspendedAt || null,
    suspensionReason: user?.subscriptionSuspensionReason || "",
    isDelinquent,
    isInRetryGrace,
    monthlyPrice: roundMoney(
      user?.subscriptionMonthlyPrice || config.monthlyPrice || 11.99,
      11.99,
    ),
    currency: normalizeCurrency(config.currency || "cad"),
    savingsTotal: roundMoney(user?.subscriptionSavingsTotal, 0),
    freeItemCycleKey: currentCycleKey,
    freeItemUsedCount: usedInCurrentCycle,
    freeItemRemaining,
    benefits: {
      percentDiscount: SUBSCRIPTION_DISCOUNT_PERCENT,
      freeDelivery: true,
      freeItemPerMonth: 1,
    },
  };
};

const refreshUserSubscriptionFromStripe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;

  if (!user.subscriptionStripeSubscriptionId) {
    ensureUserSavingsDefaults(user);
    ensureUserFreeItemCycle(user);
    await user.save();
    return user;
  }

  try {
    const stripeSubscription = await stripe.subscriptions.retrieve(
      user.subscriptionStripeSubscriptionId,
      { expand: ["items.data.price"] },
    );

    if (!isOpenStatus(stripeSubscription?.status)) {
      await setUserSubscriptionInactive(user, stripeSubscription?.status);
      return user;
    }

    await syncUserWithStripeSubscription(user, stripeSubscription);
    return user;
  } catch (error) {
    return user;
  }
};

const applyConfirmedOrderSubscriptionBenefits = async (order) => {
  if (!order?.subscriptionBenefits?.isApplied) return null;
  if (!order?.confirmed && !order?.payment_status) return null;

  const userId = order?.user?._id || order?.user;
  if (!userId) return null;

  const user = await User.findById(userId);
  if (!user) return null;

  ensureUserSavingsDefaults(user);
  ensureUserFreeItemCycle(user);

  const discountAmount = toSafeNumber(order?.subscriptionBenefits?.discountAmount, 0);
  const freeDeliveryAmount = toSafeNumber(
    order?.subscriptionBenefits?.freeDeliveryAmount,
    0,
  );
  const freeItemAmount = toSafeNumber(order?.subscriptionBenefits?.freeItemAmount, 0);

  const totalSavings = roundMoney(
    discountAmount + freeDeliveryAmount + freeItemAmount,
    0,
  );

  if (totalSavings > 0) {
    user.subscriptionSavingsTotal = roundMoney(
      toSafeNumber(user.subscriptionSavingsTotal, 0) + totalSavings,
      0,
    );
  }

  if (order?.subscriptionBenefits?.freeItemApplied) {
    const cycleKey = String(
      order?.subscriptionBenefits?.cycleKey ||
        getSubscriptionFreeItemCycleKey(user, new Date()),
    );
    if (user.subscriptionFreeItemCycleKey !== cycleKey) {
      user.subscriptionFreeItemCycleKey = cycleKey;
      user.subscriptionFreeItemUsedCount = 0;
    }
    user.subscriptionFreeItemUsedCount = Math.max(
      1,
      toSafeNumber(user.subscriptionFreeItemUsedCount, 0),
    );
  }

  await user.save();

  if (user.subscriptionStripeSubscriptionId) {
    await Subscription.findOneAndUpdate(
      {
        stripeSubscriptionId: user.subscriptionStripeSubscriptionId,
      },
      {
        savingsTotal: toSafeNumber(user.subscriptionSavingsTotal, 0),
        freeItemCycleKey:
          user.subscriptionFreeItemCycleKey ||
          getSubscriptionFreeItemCycleKey(user, new Date()),
        freeItemUsedCount: toSafeNumber(user.subscriptionFreeItemUsedCount, 0),
      },
      { new: true },
    );
  }

  return user;
};

module.exports = {
  stripe,
  isActiveStatus,
  isOpenStatus,
  getCycleKey,
  getSubscriptionFreeItemCycleKey,
  getSubscriptionRenewalGraceEndFromDate,
  isSubscriptionInRetryGrace,
  isSubscriptionCurrentlyActive,
  clearUserRenewalFailureState,
  buildUserSubscriptionSummary,
  ensureStripeCustomerForUser,
  ensureSubscriptionStripePrice,
  syncUserWithStripeSubscription,
  setUserSubscriptionInactive,
  refreshUserSubscriptionFromStripe,
  getOrCreateSettingDocument,
  ensureUserFreeItemCycle,
  ensureUserSavingsDefaults,
  applyConfirmedOrderSubscriptionBenefits,
  SUBSCRIPTION_DISCOUNT_PERCENT,
  SUBSCRIPTION_RENEWAL_RETRY_GRACE_DAYS,
};
