const User = require("../models/User");
const Subscription = require("../models/Subscription");
const SubscriptionPayment = require("../models/SubscriptionPayment");
const SubscriptionHediPayout = require("../models/SubscriptionHediPayout");
const MenuItem = require("../models/MenuItem");
const Staff = require("../models/staff");
const {
  stripe,
  isActiveStatus,
  isSubscriptionCurrentlyActive,
  isOpenStatus,
  getOrCreateSettingDocument,
  getSubscriptionRenewalGraceEndFromDate,
  ensureSubscriptionStripePrice,
  ensureStripeCustomerForUser,
  syncUserWithStripeSubscription,
  buildUserSubscriptionSummary,
  refreshUserSubscriptionFromStripe,
  setUserSubscriptionInactive,
  SUBSCRIPTION_DISCOUNT_PERCENT,
} = require("../services/subscriptionServices/subscriptionHelpers");
const {
  sendSubscriptionActivationEmail,
  sendSubscriptionRenewalSuccessEmail,
  sendSubscriptionRenewalFailedEmail,
  sendSubscriptionSuspendedEmail,
} = require("../services/subscriptionServices/subscriptionMailService");

const HEDI_SHARE_PERCENT = 10;
const OPEN_STATUSES = new Set([
  "active",
  "trialing",
  "incomplete",
  "past_due",
  "unpaid",
]);
const DELINQUENT_SUBSCRIPTION_STATUSES = new Set(["past_due", "unpaid"]);

const SUBSCRIPTION_3DS_PAYMENT_SETTINGS = {
  payment_method_types: ["card"],
  payment_method_options: {
    card: {
      request_three_d_secure: "any",
    },
  },
};

const logWithTimestamp = (message, extra = {}) => {
  const timeStamp = new Date().toISOString();
  console.error(
    `${timeStamp} - ${message}`,
    Object.keys(extra).length ? extra : "",
  );
};

const toDateFromStripeTimestamp = (timestamp) => {
  if (!timestamp || !Number.isFinite(Number(timestamp))) return null;
  return new Date(Number(timestamp) * 1000);
};

const getRawStripePayload = (req) => {
  if (typeof req?.rawBody === "string" && req.rawBody.length > 0) {
    return req.rawBody;
  }

  if (Buffer.isBuffer(req?.body)) {
    return req.body;
  }

  if (typeof req?.body === "string" && req.body.length > 0) {
    return req.body;
  }

  return null;
};

const resolveStripeSubscriptionId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && typeof value.id === "string") {
    return value.id;
  }
  return "";
};

const resolveStripeCustomerId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && typeof value.id === "string") {
    return value.id;
  }
  return "";
};

const resolveStripeInvoiceId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && typeof value.id === "string") {
    return value.id;
  }
  return "";
};

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value, fallback = 0) => {
  const normalized = toSafeNumber(value, fallback);
  return Math.round(normalized * 100) / 100;
};

const normalizeCurrency = (currency) =>
  String(currency || "cad")
    .trim()
    .toLowerCase() || "cad";

const resolveInvoicePaidDate = (invoice) => {
  const paidAtTs =
    invoice?.status_transitions?.paid_at || invoice?.created || null;
  return toDateFromStripeTimestamp(paidAtTs) || new Date();
};

const resolvePaymentTypeFromInvoice = (invoice) => {
  const billingReason = String(invoice?.billing_reason || "")
    .trim()
    .toLowerCase();
  if (billingReason === "subscription_create") return "activation";
  if (billingReason === "subscription_cycle") return "renewal";
  return "subscription";
};

const isUserSubscriptionOpen = (user) => {
  const status = String(user?.subscriptionStatus || "")
    .trim()
    .toLowerCase();
  if (!OPEN_STATUSES.has(status)) return false;

  const periodEnd = user?.subscriptionCurrentPeriodEnd
    ? new Date(user.subscriptionCurrentPeriodEnd)
    : null;
  if (!(periodEnd instanceof Date) || Number.isNaN(periodEnd.getTime())) {
    return true;
  }
  return periodEnd.getTime() > Date.now();
};

const isUserSubscriptionActive = (user) => {
  return isSubscriptionCurrentlyActive(user);
};

const ensureAdminStaff = async (req, res) => {
  const staffId = req?.staff?.id;
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

const paymentMethodsAreSameCard = (candidate, reference) => {
  const candidateCard = candidate?.card;
  const referenceCard = reference?.card;
  if (!candidateCard || !referenceCard) return false;

  const candidateFp = candidateCard?.fingerprint || null;
  const referenceFp = referenceCard?.fingerprint || null;
  if (candidateFp && referenceFp) {
    return candidateFp === referenceFp;
  }

  return (
    candidateCard?.last4 === referenceCard?.last4 &&
    candidateCard?.brand === referenceCard?.brand &&
    Number(candidateCard?.exp_month) === Number(referenceCard?.exp_month) &&
    Number(candidateCard?.exp_year) === Number(referenceCard?.exp_year)
  );
};

const findMatchingSavedCard = async (customerId, paymentMethod) => {
  if (!customerId || !paymentMethod?.card) return null;

  let startingAfter;
  do {
    const list = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const savedPm of list?.data || []) {
      if (paymentMethodsAreSameCard(savedPm, paymentMethod)) {
        return savedPm;
      }
    }

    if (!list?.has_more || !(list?.data || []).length) {
      break;
    }
    startingAfter = list.data[list.data.length - 1].id;
  } while (true);

  return null;
};

const findUserByStripeSubscription = async (stripeSubscription) => {
  const metadataUserId =
    stripeSubscription?.metadata?.userId || stripeSubscription?.metadata?.user;
  if (metadataUserId) {
    const userByMetadata = await User.findById(metadataUserId);
    if (userByMetadata) return userByMetadata;
  }

  const subscriptionId = resolveStripeSubscriptionId(stripeSubscription?.id);
  if (subscriptionId) {
    const userBySubscriptionId = await User.findOne({
      subscriptionStripeSubscriptionId: subscriptionId,
    });
    if (userBySubscriptionId) return userBySubscriptionId;

    const subscriptionRecord = await Subscription.findOne({
      stripeSubscriptionId: subscriptionId,
    }).select("user");
    if (subscriptionRecord?.user) {
      const userByRecord = await User.findById(subscriptionRecord.user);
      if (userByRecord) return userByRecord;
    }
  }

  const customerId =
    typeof stripeSubscription?.customer === "string"
      ? stripeSubscription.customer
      : stripeSubscription?.customer?.id || "";
  if (customerId) {
    const userByCustomer = await User.findOne({ stripe_id: customerId });
    if (userByCustomer) return userByCustomer;
  }

  return null;
};

const syncSubscriptionFromWebhook = async (subscriptionId) => {
  const resolvedSubscriptionId = resolveStripeSubscriptionId(subscriptionId);
  if (!resolvedSubscriptionId) return;

  let stripeSubscription;
  try {
    stripeSubscription = await stripe.subscriptions.retrieve(
      resolvedSubscriptionId,
      { expand: ["items.data.price"] },
    );
  } catch (error) {
    return;
  }

  const user = await findUserByStripeSubscription(stripeSubscription);
  if (user) {
    await syncUserWithStripeSubscription(user, stripeSubscription, {
      customerId:
        typeof stripeSubscription.customer === "string"
          ? stripeSubscription.customer
          : stripeSubscription.customer?.id || user?.stripe_id || "",
    });
    return;
  }

  await Subscription.findOneAndUpdate(
    { stripeSubscriptionId: resolvedSubscriptionId },
    {
      status: String(stripeSubscription?.status || "inactive").toLowerCase(),
      cancelAtPeriodEnd: Boolean(stripeSubscription?.cancel_at_period_end),
      canceledAt: stripeSubscription?.cancel_at_period_end ? new Date() : null,
      currentPeriodStart: toDateFromStripeTimestamp(
        stripeSubscription?.current_period_start,
      ),
      currentPeriodEnd: toDateFromStripeTimestamp(
        stripeSubscription?.current_period_end,
      ),
      lastStripePayload: {
        id: stripeSubscription?.id || resolvedSubscriptionId,
        status: stripeSubscription?.status || "inactive",
        cancel_at_period_end: Boolean(stripeSubscription?.cancel_at_period_end),
        current_period_start: stripeSubscription?.current_period_start || null,
        current_period_end: stripeSubscription?.current_period_end || null,
      },
    },
    { new: true },
  );
};

const resolveUserFromInvoice = async (invoice, subscriptionId) => {
  const customerId = resolveStripeCustomerId(invoice?.customer);
  if (customerId) {
    const userByCustomer = await User.findOne({ stripe_id: customerId });
    if (userByCustomer) {
      return userByCustomer;
    }
  }

  const subscriptionRecord = await Subscription.findOne({
    stripeSubscriptionId: subscriptionId,
  }).select("user stripeCustomerId");
  if (subscriptionRecord?.user) {
    const userFromRecord = await User.findById(subscriptionRecord.user);
    if (userFromRecord) {
      return userFromRecord;
    }
  }

  if (subscriptionRecord?.stripeCustomerId) {
    const userByRecordCustomer = await User.findOne({
      stripe_id: subscriptionRecord.stripeCustomerId,
    });
    if (userByRecordCustomer) {
      return userByRecordCustomer;
    }
  }

  try {
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscriptionId,
      { expand: ["items.data.price"] },
    );
    const userFromStripe = await findUserByStripeSubscription(stripeSubscription);
    if (userFromStripe) {
      await syncUserWithStripeSubscription(userFromStripe, stripeSubscription, {
        customerId:
          resolveStripeCustomerId(stripeSubscription?.customer) ||
          customerId ||
          userFromStripe?.stripe_id ||
          "",
      });
      return userFromStripe;
    }
  } catch (error) {
    return null;
  }

  return null;
};

const toDateOrNull = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const isDelinquentSubscriptionStatus = (status) =>
  DELINQUENT_SUBSCRIPTION_STATUSES.has(String(status || "").toLowerCase());

const resolveUserFromSubscriptionId = async (subscriptionId) => {
  const resolvedSubscriptionId = resolveStripeSubscriptionId(subscriptionId);
  if (!resolvedSubscriptionId) return null;

  const byUserSubscriptionId = await User.findOne({
    subscriptionStripeSubscriptionId: resolvedSubscriptionId,
  });
  if (byUserSubscriptionId) {
    return byUserSubscriptionId;
  }

  const subscriptionRecord = await Subscription.findOne({
    stripeSubscriptionId: resolvedSubscriptionId,
  }).select("user");
  if (!subscriptionRecord?.user) {
    return null;
  }

  return User.findById(subscriptionRecord.user);
};

const clearRenewalFailureState = (user) => {
  if (!user) return;
  user.subscriptionRenewalFailureInvoiceId = null;
  user.subscriptionRenewalFailureStartedAt = null;
  user.subscriptionRenewalGraceEndsAt = null;
  user.subscriptionRenewalFirstFailureEmailSentAt = null;
  user.subscriptionSuspendedAt = null;
  user.subscriptionSuspensionReason = "";
  user.subscriptionSuspensionEmailSentAt = null;
};

const suspendSubscriptionAfterRetryWindow = async ({
  userId,
  subscriptionId,
  failureInvoiceId,
  now = new Date(),
}) => {
  if (!userId) {
    return { suspended: false, shouldSendSuspensionEmail: false };
  }

  const user = await User.findById(userId);
  if (!user) {
    return { suspended: false, shouldSendSuspensionEmail: false };
  }

  const currentStatus = String(user.subscriptionStatus || "").toLowerCase();
  if (!isDelinquentSubscriptionStatus(currentStatus)) {
    return { suspended: false, shouldSendSuspensionEmail: false };
  }

  const graceEndsAt = toDateOrNull(user.subscriptionRenewalGraceEndsAt);
  if (!graceEndsAt || graceEndsAt.getTime() > now.getTime()) {
    return { suspended: false, shouldSendSuspensionEmail: false };
  }

  const suspensionAlreadyEmailed = Boolean(
    toDateOrNull(user.subscriptionSuspensionEmailSentAt),
  );

  const resolvedSubscriptionId =
    resolveStripeSubscriptionId(subscriptionId) ||
    resolveStripeSubscriptionId(user.subscriptionStripeSubscriptionId);

  if (resolvedSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(resolvedSubscriptionId);
    } catch (error) {
      const errorMessage = String(error?.message || "").toLowerCase();
      const alreadyStopped =
        String(error?.code || "").toLowerCase() === "resource_missing" ||
        errorMessage.includes("already canceled") ||
        errorMessage.includes("no such subscription");

      if (!alreadyStopped) {
        logWithTimestamp(
          "Failed to suspend subscription after retry grace period",
          {
            subscriptionId: resolvedSubscriptionId,
            userId: String(user._id || ""),
            error: error.message,
          },
        );
        return { suspended: false, shouldSendSuspensionEmail: false };
      }
    }

    await syncSubscriptionFromWebhook(resolvedSubscriptionId);
  }

  const refreshedUser = await User.findById(user._id);
  if (!refreshedUser) {
    return { suspended: false, shouldSendSuspensionEmail: false };
  }

  refreshedUser.subscriptionIsActive = false;
  refreshedUser.subscriptionAutoRenew = false;
  refreshedUser.subscriptionSuspendedAt = now;
  refreshedUser.subscriptionSuspensionReason =
    "renewal_payment_failed_after_retry_window";
  if (!refreshedUser.subscriptionSuspensionEmailSentAt) {
    refreshedUser.subscriptionSuspensionEmailSentAt = now;
  }
  if (failureInvoiceId) {
    refreshedUser.subscriptionRenewalFailureInvoiceId = failureInvoiceId;
  }
  await refreshedUser.save();

  return {
    suspended: true,
    shouldSendSuspensionEmail: !suspensionAlreadyEmailed,
    userId: refreshedUser._id,
  };
};

const handleRenewalFailedInvoice = async (invoice) => {
  const subscriptionId = resolveStripeSubscriptionId(invoice?.subscription);
  if (!subscriptionId) {
    return {
      shouldSendFirstFailureEmail: false,
      shouldSendSuspensionEmail: false,
      graceEndsAt: null,
      userId: null,
    };
  }

  const user = await resolveUserFromInvoice(invoice, subscriptionId);
  if (!user) {
    return {
      shouldSendFirstFailureEmail: false,
      shouldSendSuspensionEmail: false,
      graceEndsAt: null,
      userId: null,
    };
  }

  const currentStatus = String(user.subscriptionStatus || "").toLowerCase();
  if (!isDelinquentSubscriptionStatus(currentStatus)) {
    return {
      shouldSendFirstFailureEmail: false,
      shouldSendSuspensionEmail: false,
      graceEndsAt: toDateOrNull(user.subscriptionRenewalGraceEndsAt),
      userId: user._id,
    };
  }

  const now = new Date();
  const invoiceId = resolveStripeInvoiceId(invoice) || `sub-${subscriptionId}`;
  const previousInvoiceId = String(user.subscriptionRenewalFailureInvoiceId || "")
    .trim();
  const isNewFailureCycle =
    !previousInvoiceId ||
    previousInvoiceId !== invoiceId ||
    !toDateOrNull(user.subscriptionRenewalFailureStartedAt);

  let shouldSendFirstFailureEmail = false;
  if (isNewFailureCycle) {
    user.subscriptionRenewalFailureInvoiceId = invoiceId;
    user.subscriptionRenewalFailureStartedAt = now;
    user.subscriptionRenewalGraceEndsAt =
      getSubscriptionRenewalGraceEndFromDate(now);
    user.subscriptionRenewalFirstFailureEmailSentAt = now;
    user.subscriptionSuspendedAt = null;
    user.subscriptionSuspensionReason = "";
    user.subscriptionSuspensionEmailSentAt = null;
    shouldSendFirstFailureEmail = true;
  } else if (!toDateOrNull(user.subscriptionRenewalFirstFailureEmailSentAt)) {
    user.subscriptionRenewalFirstFailureEmailSentAt = now;
    shouldSendFirstFailureEmail = true;
  }

  user.subscriptionIsActive = true;

  await user.save();

  const graceEndsAt = toDateOrNull(user.subscriptionRenewalGraceEndsAt);
  const graceExpired =
    graceEndsAt instanceof Date && graceEndsAt.getTime() <= now.getTime();

  if (!graceExpired) {
    return {
      shouldSendFirstFailureEmail,
      shouldSendSuspensionEmail: false,
      graceEndsAt,
      userId: user._id,
    };
  }

  const suspensionResult = await suspendSubscriptionAfterRetryWindow({
    userId: user._id,
    subscriptionId,
    failureInvoiceId: invoiceId,
    now,
  });

  return {
    shouldSendFirstFailureEmail: false,
    shouldSendSuspensionEmail: Boolean(
      suspensionResult?.shouldSendSuspensionEmail,
    ),
    graceEndsAt,
    userId: user._id,
  };
};

const handleSubscriptionStatusRetryPolicy = async (subscriptionId) => {
  const resolvedSubscriptionId = resolveStripeSubscriptionId(subscriptionId);
  if (!resolvedSubscriptionId) {
    return { shouldSendSuspensionEmail: false, userId: null };
  }

  const user = await resolveUserFromSubscriptionId(resolvedSubscriptionId);
  if (!user) {
    return { shouldSendSuspensionEmail: false, userId: null };
  }

  const status = String(user.subscriptionStatus || "").toLowerCase();
  if (!isDelinquentSubscriptionStatus(status)) {
    return { shouldSendSuspensionEmail: false, userId: user._id };
  }

  const graceEndsAt = toDateOrNull(user.subscriptionRenewalGraceEndsAt);
  if (!graceEndsAt || graceEndsAt.getTime() > Date.now()) {
    return { shouldSendSuspensionEmail: false, userId: user._id };
  }

  const failureInvoiceId = String(
    user.subscriptionRenewalFailureInvoiceId || "",
  ).trim();

  return suspendSubscriptionAfterRetryWindow({
    userId: user._id,
    subscriptionId: resolvedSubscriptionId,
    failureInvoiceId,
    now: new Date(),
  });
};

const recordSubscriptionPaymentFromInvoice = async (invoice) => {
  const invoiceId = String(invoice?.id || "").trim();
  if (!invoiceId) return null;

  const existingPayment = await SubscriptionPayment.findOne({
    stripeInvoiceId: invoiceId,
  }).lean();
  if (existingPayment) {
    return {
      payment: existingPayment,
      isNew: false,
      userId: existingPayment?.user || null,
    };
  }

  const subscriptionId = resolveStripeSubscriptionId(invoice?.subscription);
  if (!subscriptionId) return null;

  const rawAmountPaid = toSafeNumber(invoice?.amount_paid, 0);
  const amountPaid = roundMoney(rawAmountPaid / 100, 0);
  if (amountPaid <= 0) return null;

  const user = await resolveUserFromInvoice(invoice, subscriptionId);
  if (!user) return null;

  const currency = normalizeCurrency(invoice?.currency || "cad");
  const paymentType = resolvePaymentTypeFromInvoice(invoice);
  const billingReason = String(invoice?.billing_reason || "subscription")
    .trim()
    .toLowerCase();
  const paidAt = resolveInvoicePaidDate(invoice);
  const hediShareAmount = roundMoney(
    (amountPaid * HEDI_SHARE_PERCENT) / 100,
    0,
  );

  let createdPayment;
  try {
    createdPayment = await SubscriptionPayment.create({
      user: user._id,
      stripeCustomerId:
        resolveStripeCustomerId(invoice?.customer) || user?.stripe_id || "",
      stripeSubscriptionId: subscriptionId,
      stripeInvoiceId: invoiceId,
      stripePaymentIntentId: String(invoice?.payment_intent || "").trim(),
      amount: amountPaid,
      currency,
      billingReason,
      paymentType,
      paidAt,
      hediSharePercent: HEDI_SHARE_PERCENT,
      hediShareAmount,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicatedPayment = await SubscriptionPayment.findOne({
        stripeInvoiceId: invoiceId,
      }).lean();
      return {
        payment: duplicatedPayment,
        isNew: false,
        userId: duplicatedPayment?.user || null,
      };
    }
    throw error;
  }

  user.subscriptionAmountPaidTotal = roundMoney(
    toSafeNumber(user.subscriptionAmountPaidTotal, 0) + amountPaid,
    0,
  );
  user.subscriptionPaymentsCount =
    Math.max(0, Math.floor(toSafeNumber(user.subscriptionPaymentsCount, 0))) + 1;
  clearRenewalFailureState(user);
  await user.save();

  return {
    payment: createdPayment?.toObject ? createdPayment.toObject() : createdPayment,
    isNew: true,
    userId: user?._id || null,
  };
};

const runBackgroundJobs = (jobs = []) => {
  if (!Array.isArray(jobs) || jobs.length === 0) return;

  process.nextTick(async () => {
    for (const job of jobs) {
      try {
        await job();
      } catch (error) {
        logWithTimestamp("Subscription background job failed", {
          error: error.message,
        });
      }
    }
  });
};

const createPaymentSuccessEmailJob = (paymentRecord) => async () => {
  if (!paymentRecord?.user) return;

  const user = await User.findById(paymentRecord.user).select(
    "name email subscriptionCurrentPeriodEnd subscriptionPaymentsCount",
  );
  if (!user?.email) return;

  const rawPaymentType = String(paymentRecord.paymentType || "")
    .trim()
    .toLowerCase();
  const paymentType =
    rawPaymentType === "activation" || rawPaymentType === "renewal"
      ? rawPaymentType
      : Math.max(0, Math.floor(toSafeNumber(user.subscriptionPaymentsCount, 0))) > 1
        ? "renewal"
        : "activation";
  if (rawPaymentType !== "activation" && rawPaymentType !== "renewal") {
    logWithTimestamp("Subscription payment type fallback applied for email", {
      paymentType: rawPaymentType || "unknown",
      resolvedType: paymentType,
      userId: String(user._id),
      paymentId: String(paymentRecord?._id || ""),
    });
  }
  const amount = roundMoney(paymentRecord.amount, 0);
  const currency = normalizeCurrency(paymentRecord.currency || "cad");

  if (paymentType === "activation") {
    await sendSubscriptionActivationEmail({
      userEmail: user.email,
      userName: user.name || "Client",
      monthlyPrice: amount,
      currency,
      currentPeriodEnd: user.subscriptionCurrentPeriodEnd || null,
    });
    return;
  }

  if (paymentType === "renewal") {
    await sendSubscriptionRenewalSuccessEmail({
      userEmail: user.email,
      userName: user.name || "Client",
      amountPaid: amount,
      currency,
      currentPeriodEnd: user.subscriptionCurrentPeriodEnd || null,
    });
  }
};

const createRenewalFailureEmailJob = ({ invoice, graceEndsAt }) => async () => {
  const subscriptionId = resolveStripeSubscriptionId(invoice?.subscription);
  if (!subscriptionId) return;

  const user = await resolveUserFromInvoice(invoice, subscriptionId);
  if (!user?.email) return;

  const amountDue = roundMoney(toSafeNumber(invoice?.amount_due, 0) / 100, 0);
  const nextAttemptDate = toDateFromStripeTimestamp(invoice?.next_payment_attempt);

  await sendSubscriptionRenewalFailedEmail({
    userEmail: user.email,
    userName: user.name || "Client",
    amountDue,
    currency: normalizeCurrency(invoice?.currency || "cad"),
    nextAttemptDate,
    graceEndDate: graceEndsAt,
  });
};

const createRenewalSuspendedEmailJob = ({ invoice, userId }) => async () => {
  let user = null;
  if (userId) {
    user = await User.findById(userId).select(
      "name email subscriptionMonthlyPrice",
    );
  } else {
    const subscriptionId = resolveStripeSubscriptionId(invoice?.subscription);
    if (!subscriptionId) return;
    user = await resolveUserFromInvoice(invoice, subscriptionId);
  }
  if (!user?.email) return;

  let amountDue = roundMoney(toSafeNumber(invoice?.amount_due, 0) / 100, 0);
  if (amountDue <= 0) {
    amountDue = roundMoney(toSafeNumber(user.subscriptionMonthlyPrice, 11.99), 11.99);
  }

  await sendSubscriptionSuspendedEmail({
    userEmail: user.email,
    userName: user.name || "Client",
    amountDue,
    currency: normalizeCurrency(invoice?.currency || "cad"),
  });
};

const getHediBalanceSummary = async () => {
  const [usersAgg] = await User.aggregate([
    {
      $group: {
        _id: null,
        totalRevenue: {
          $sum: {
            $ifNull: ["$subscriptionAmountPaidTotal", 0],
          },
        },
        totalPaymentsCount: {
          $sum: {
            $ifNull: ["$subscriptionPaymentsCount", 0],
          },
        },
        totalRenewalsCount: {
          $sum: {
            $cond: [
              { $gt: [{ $ifNull: ["$subscriptionPaymentsCount", 0] }, 1] },
              { $subtract: [{ $ifNull: ["$subscriptionPaymentsCount", 0] }, 1] },
              0,
            ],
          },
        },
      },
    },
  ]);

  const [payoutAgg] = await SubscriptionHediPayout.aggregate([
    {
      $group: {
        _id: null,
        totalPayouts: { $sum: "$amount" },
      },
    },
  ]);

  const totalRevenue = roundMoney(usersAgg?.totalRevenue, 0);
  const totalPaymentsCount = Math.max(
    0,
    Math.floor(toSafeNumber(usersAgg?.totalPaymentsCount, 0)),
  );
  const totalRenewalsCount = Math.max(
    0,
    Math.floor(toSafeNumber(usersAgg?.totalRenewalsCount, 0)),
  );
  const totalHediCredits = roundMoney(
    (totalRevenue * HEDI_SHARE_PERCENT) / 100,
    0,
  );
  const totalPayouts = roundMoney(payoutAgg?.totalPayouts, 0);
  const balance = roundMoney(totalHediCredits - totalPayouts, 0);

  return {
    totalRevenue,
    totalPaymentsCount,
    totalRenewalsCount,
    totalHediCredits,
    totalPayouts,
    balance,
    sharePercent: HEDI_SHARE_PERCENT,
  };
};

const handleStripeWebhook = async (req, res) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(500).json({
      success: false,
      message: "Clé webhook Stripe manquante.",
    });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).json({
      success: false,
      message: "Signature Stripe manquante.",
    });
  }

  const rawPayload = getRawStripePayload(req);
  if (!rawPayload) {
    return res.status(400).json({
      success: false,
      message: "Payload webhook Stripe invalide.",
    });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawPayload, signature, webhookSecret);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: `Signature webhook invalide: ${error.message}`,
    });
  }

  try {
    const backgroundJobs = [];

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const stripeSubscription = event.data?.object;
        const stripeSubscriptionId = stripeSubscription?.id;
        await syncSubscriptionFromWebhook(stripeSubscriptionId);
        const statusPolicyResult = await handleSubscriptionStatusRetryPolicy(
          stripeSubscriptionId,
        );
        if (statusPolicyResult?.shouldSendSuspensionEmail) {
          backgroundJobs.push(
            createRenewalSuspendedEmailJob({
              invoice: null,
              userId: statusPolicyResult?.userId || null,
            }),
          );
        }
        break;
      }
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data?.object;
        const paymentResult = await recordSubscriptionPaymentFromInvoice(invoice);
        const invoiceSubscriptionId = resolveStripeSubscriptionId(
          invoice?.subscription,
        );
        if (invoiceSubscriptionId) {
          await syncSubscriptionFromWebhook(invoiceSubscriptionId);
        }
        if (paymentResult?.isNew && paymentResult?.payment) {
          backgroundJobs.push(createPaymentSuccessEmailJob(paymentResult.payment));
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data?.object;
        const paymentType = resolvePaymentTypeFromInvoice(invoice);
        const invoiceSubscriptionId = resolveStripeSubscriptionId(
          invoice?.subscription,
        );
        if (invoiceSubscriptionId) {
          await syncSubscriptionFromWebhook(invoiceSubscriptionId);
        }
        if (paymentType === "renewal") {
          const failureResult = await handleRenewalFailedInvoice(invoice);
          if (failureResult?.shouldSendFirstFailureEmail) {
            backgroundJobs.push(
              createRenewalFailureEmailJob({
                invoice,
                graceEndsAt: failureResult?.graceEndsAt || null,
              }),
            );
          }
          if (failureResult?.shouldSendSuspensionEmail) {
            backgroundJobs.push(
              createRenewalSuspendedEmailJob({
                invoice,
                userId: failureResult?.userId || null,
              }),
            );
          }
        }
        break;
      }
      default:
        break;
    }

    res.status(200).json({ received: true });
    runBackgroundJobs(backgroundJobs);
    return;
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Erreur traitement webhook Stripe.",
    });
  }
};

const formatSubscriptionConfig = (setting) => {
  const monthlyPrice = Number(setting?.subscription?.monthlyPrice || 11.99);
  const currency = String(setting?.subscription?.currency || "cad")
    .trim()
    .toLowerCase();
  const freeItemMenuItemId = setting?.subscription?.freeItemMenuItemId
    ? String(setting.subscription.freeItemMenuItemId)
    : null;
  const freeItemMenuItemName = String(
    setting?.subscription?.freeItemMenuItemName || "",
  ).trim();
  const birthdayFreeItemMenuItemId = setting?.birthday?.freeItemMenuItemId
    ? String(setting.birthday.freeItemMenuItemId)
    : null;
  const birthdayFreeItemMenuItemName = String(
    setting?.birthday?.freeItemMenuItemName || "",
  ).trim();

  return {
    monthlyPrice: Number.isFinite(monthlyPrice) ? monthlyPrice : 11.99,
    currency: currency || "cad",
    freeItem: freeItemMenuItemId
      ? {
          menuItemId: freeItemMenuItemId,
          menuItemName: freeItemMenuItemName,
        }
      : null,
    birthdayFreeItem: birthdayFreeItemMenuItemId
      ? {
          menuItemId: birthdayFreeItemMenuItemId,
          menuItemName: birthdayFreeItemMenuItemName,
        }
      : null,
    benefits: {
      percentDiscount: SUBSCRIPTION_DISCOUNT_PERCENT,
      freeDelivery: true,
      freeItemPerMonth: 1,
      birthdayFreeItemPerYear: 1,
    },
  };
};

const getSubscriptionConfig = async (req, res) => {
  try {
    const setting = await getOrCreateSettingDocument();
    return res.status(200).json({
      success: true,
      data: formatSubscriptionConfig(setting),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Erreur lors du chargement de la configuration.",
    });
  }
};

const updateSubscriptionConfig = async (req, res) => {
  try {
    const staff = await ensureAdminStaff(req, res);
    if (!staff) return;

    const hasMonthlyPriceUpdate = Object.prototype.hasOwnProperty.call(
      req.body || {},
      "monthlyPrice",
    );
    const hasFreeItemUpdate = Object.prototype.hasOwnProperty.call(
      req.body || {},
      "freeItemMenuItemId",
    );
    const hasBirthdayFreeItemUpdate = Object.prototype.hasOwnProperty.call(
      req.body || {},
      "birthdayFreeItemMenuItemId",
    );

    if (
      !hasMonthlyPriceUpdate &&
      !hasFreeItemUpdate &&
      !hasBirthdayFreeItemUpdate
    ) {
      return res.status(400).json({
        success: false,
        message: "Aucun changement à appliquer.",
      });
    }

    let setting;
    if (hasMonthlyPriceUpdate) {
      const nextPrice = Number(req.body?.monthlyPrice);
      if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: "Le prix mensuel est invalide.",
        });
      }

      const normalizedPrice = Math.round(nextPrice * 100) / 100;
      const ensurePriceResult = await ensureSubscriptionStripePrice(normalizedPrice);
      setting = ensurePriceResult.setting;
    } else {
      setting = await getOrCreateSettingDocument();
    }

    if (!setting.subscription || typeof setting.subscription !== "object") {
      setting.subscription = {};
    }
    if (!setting.birthday || typeof setting.birthday !== "object") {
      setting.birthday = {};
    }

    if (hasFreeItemUpdate) {
      const rawFreeItemMenuItemId = String(req.body?.freeItemMenuItemId || "")
        .trim();

      if (!rawFreeItemMenuItemId) {
        setting.subscription.freeItemMenuItemId = null;
        setting.subscription.freeItemMenuItemName = "";
      } else {
        const selectedMenuItem = await MenuItem.findById(rawFreeItemMenuItemId)
          .select("name")
          .lean();

        if (!selectedMenuItem) {
          return res.status(404).json({
            success: false,
            message: "Article introuvable pour l'article gratuit.",
          });
        }

        setting.subscription.freeItemMenuItemId = selectedMenuItem._id;
        setting.subscription.freeItemMenuItemName = String(
          selectedMenuItem.name || "",
        ).trim();
      }
    }

    if (hasBirthdayFreeItemUpdate) {
      const rawBirthdayFreeItemMenuItemId = String(
        req.body?.birthdayFreeItemMenuItemId || "",
      ).trim();

      if (!rawBirthdayFreeItemMenuItemId) {
        setting.birthday.freeItemMenuItemId = null;
        setting.birthday.freeItemMenuItemName = "";
      } else {
        const selectedMenuItem = await MenuItem.findById(
          rawBirthdayFreeItemMenuItemId,
        )
          .select("name")
          .lean();

        if (!selectedMenuItem) {
          return res.status(404).json({
            success: false,
            message: "Article anniversaire introuvable.",
          });
        }

        setting.birthday.freeItemMenuItemId = selectedMenuItem._id;
        setting.birthday.freeItemMenuItemName = String(
          selectedMenuItem.name || "",
        ).trim();
      }
    }

    await setting.save();

    return res.status(200).json({
      success: true,
      data: formatSubscriptionConfig(setting),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Erreur lors de la mise à jour de la configuration abonnement.",
    });
  }
};

const getUserSubscription = async (req, res) => {
  try {
    const userId = req.params?.userId || req.query?.userId;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Identifiant utilisateur requis.",
      });
    }

    let user = await refreshUserSubscriptionFromStripe(userId);
    if (!user) {
      user = await User.findById(userId);
    }
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur introuvable.",
      });
    }

    const setting = await getOrCreateSettingDocument();
    const config = formatSubscriptionConfig(setting);
    const summary = buildUserSubscriptionSummary(user, config);

    const subscriptionRecord = await Subscription.findOne({
      $or: [
        { user: user._id },
        {
          stripeSubscriptionId: user.subscriptionStripeSubscriptionId || "",
        },
      ],
    })
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        config,
        summary,
        subscriptionRecord: subscriptionRecord || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Erreur lors du chargement des informations abonnement utilisateur.",
    });
  }
};

const createSubscription = async (req, res) => {
  try {
    const userId = req.body?.userId;
    const paymentMethodId = req.body?.paymentMethodId;
    const autoRenew = req.body?.autoRenew !== false;

    if (!userId || !paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: "Utilisateur et méthode de paiement requis.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur introuvable.",
      });
    }

    if (!user.email) {
      return res.status(400).json({
        success: false,
        message:
          "Une adresse email est requise sur le profil pour créer un abonnement.",
      });
    }

    const { monthlyPrice, currency, stripePriceId } =
      await ensureSubscriptionStripePrice();
    const customer = await ensureStripeCustomerForUser(user);

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (!paymentMethod || paymentMethod.type !== "card") {
      return res.status(400).json({
        success: false,
        message: "Méthode de paiement invalide.",
      });
    }

    const paymentMethodCustomerId = resolveStripeCustomerId(paymentMethod.customer);
    if (paymentMethodCustomerId && paymentMethodCustomerId !== customer.id) {
      return res.status(400).json({
        success: false,
        message:
          "Cette méthode de paiement est liée à un autre client Stripe.",
      });
    }

    let resolvedPaymentMethodId = paymentMethodId;
    if (!paymentMethodCustomerId) {
      const existingCard = await findMatchingSavedCard(customer.id, paymentMethod);
      if (existingCard?.id) {
        resolvedPaymentMethodId = existingCard.id;
      } else {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customer.id,
        });
      }
    }

    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: resolvedPaymentMethodId,
      },
    });

    if (user.subscriptionStripeSubscriptionId) {
      try {
        const existing = await stripe.subscriptions.retrieve(
          user.subscriptionStripeSubscriptionId,
          { expand: ["items.data.price", "latest_invoice.payment_intent"] },
        );
        if (isOpenStatus(existing?.status)) {
          const desiredCancelAtPeriodEnd = !autoRenew;
          const synchronizedSubscription = await stripe.subscriptions.update(
            existing.id,
            {
              cancel_at_period_end: desiredCancelAtPeriodEnd,
              default_payment_method: resolvedPaymentMethodId,
              payment_settings: SUBSCRIPTION_3DS_PAYMENT_SETTINGS,
              expand: ["items.data.price", "latest_invoice.payment_intent"],
            },
          );

          await syncUserWithStripeSubscription(user, synchronizedSubscription, {
            monthlyPrice,
            currency,
            customerId: customer.id,
          });
          const refreshedUser = await User.findById(user._id);
          return res.status(200).json({
            success: true,
            data: {
              alreadySubscribed: true,
              subscription: buildUserSubscriptionSummary(refreshedUser, {
                monthlyPrice,
                currency,
              }),
              stripe: {
                subscriptionId: synchronizedSubscription.id,
                status: synchronizedSubscription.status,
                paymentIntentId:
                  synchronizedSubscription.latest_invoice?.payment_intent?.id ||
                  null,
                paymentIntentStatus:
                  synchronizedSubscription.latest_invoice?.payment_intent
                    ?.status || null,
                clientSecret:
                  synchronizedSubscription.latest_invoice?.payment_intent
                    ?.client_secret || null,
                requiresAction:
                  synchronizedSubscription.latest_invoice?.payment_intent
                    ?.status ===
                  "requires_action",
              },
            },
          });
        }
      } catch (error) {
        user.subscriptionStripeSubscriptionId = null;
        await user.save();
      }
    }

    const createdSubscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: stripePriceId }],
      default_payment_method: resolvedPaymentMethodId,
      payment_behavior: "default_incomplete",
      collection_method: "charge_automatically",
      payment_settings: SUBSCRIPTION_3DS_PAYMENT_SETTINGS,
      cancel_at_period_end: !autoRenew,
      metadata: {
        userId: String(user._id),
      },
      expand: ["items.data.price", "latest_invoice.payment_intent"],
    });

    await syncUserWithStripeSubscription(user, createdSubscription, {
      monthlyPrice,
      currency,
      customerId: customer.id,
    });
    const refreshedUser = await User.findById(user._id);
    const paymentIntent = createdSubscription.latest_invoice?.payment_intent;

    return res.status(200).json({
      success: true,
      data: {
        alreadySubscribed: false,
        subscription: buildUserSubscriptionSummary(refreshedUser, {
          monthlyPrice,
          currency,
        }),
        stripe: {
          subscriptionId: createdSubscription.id,
          status: createdSubscription.status,
          paymentIntentId: paymentIntent?.id || null,
          paymentIntentStatus: paymentIntent?.status || null,
          clientSecret: paymentIntent?.client_secret || null,
          requiresAction: paymentIntent?.status === "requires_action",
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error.message || "Erreur lors de la création de l'abonnement Stripe.",
    });
  }
};

const confirmSubscriptionPayment = async (req, res) => {
  try {
    const userId = req.body?.userId;
    const subscriptionId =
      req.body?.subscriptionId || req.body?.stripeSubscriptionId;
    const paymentIntentId = req.body?.paymentIntentId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Identifiant utilisateur requis.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur introuvable.",
      });
    }

    if (paymentIntentId) {
      let paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent?.status === "requires_confirmation") {
        paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
      }

      if (paymentIntent?.status === "requires_action") {
        return res.status(409).json({
          success: false,
          message: "Authentification 3DS requise.",
          data: {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            paymentIntentStatus: paymentIntent.status,
            subscriptionId:
              subscriptionId || user.subscriptionStripeSubscriptionId || null,
          },
        });
      }

      if (paymentIntent?.status === "requires_payment_method") {
        return res.status(409).json({
          success: false,
          message:
            "Le paiement a échoué. Veuillez utiliser une autre carte ou réessayer.",
          data: {
            paymentIntentId: paymentIntent.id,
            paymentIntentStatus: paymentIntent.status,
            subscriptionId:
              subscriptionId || user.subscriptionStripeSubscriptionId || null,
          },
        });
      }
    }

    const resolvedSubscriptionId =
      subscriptionId || user.subscriptionStripeSubscriptionId;
    if (!resolvedSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: "Aucun abonnement Stripe à confirmer.",
      });
    }

    let stripeSubscription = await stripe.subscriptions.retrieve(
      resolvedSubscriptionId,
      { expand: ["items.data.price", "latest_invoice.payment_intent"] },
    );

    if (!paymentIntentId) {
      const latestPaymentIntent = stripeSubscription?.latest_invoice?.payment_intent;
      if (latestPaymentIntent?.id && latestPaymentIntent?.status === "requires_confirmation") {
        await stripe.paymentIntents.confirm(latestPaymentIntent.id);
        stripeSubscription = await stripe.subscriptions.retrieve(
          resolvedSubscriptionId,
          { expand: ["items.data.price", "latest_invoice.payment_intent"] },
        );
      }
    }

    let fallbackPaymentResult = null;
    try {
      const latestInvoiceId = resolveStripeInvoiceId(
        stripeSubscription?.latest_invoice,
      );
      if (latestInvoiceId) {
        const latestInvoice = await stripe.invoices.retrieve(latestInvoiceId, {
          expand: ["payment_intent"],
        });
        const amountPaid = roundMoney(
          toSafeNumber(latestInvoice?.amount_paid, 0) / 100,
          0,
        );
        if (latestInvoice?.status === "paid" || amountPaid > 0) {
          fallbackPaymentResult = await recordSubscriptionPaymentFromInvoice(
            latestInvoice,
          );
        }
      }
    } catch (error) {
      // No-op: webhook remains the primary source, this is a safety fallback.
    }

    const stripeStatus = String(stripeSubscription?.status || "").toLowerCase();
    const latestPaymentIntent = stripeSubscription?.latest_invoice?.payment_intent;
    if (!isActiveStatus(stripeStatus)) {
      if (
        latestPaymentIntent?.status === "requires_action" &&
        latestPaymentIntent?.client_secret
      ) {
        return res.status(409).json({
          success: false,
          message: "Authentification 3DS requise.",
          data: {
            clientSecret: latestPaymentIntent.client_secret,
            paymentIntentId: latestPaymentIntent.id,
            paymentIntentStatus: latestPaymentIntent.status,
            subscriptionId: stripeSubscription?.id || resolvedSubscriptionId,
            status: stripeStatus || "incomplete",
          },
        });
      }

      return res.status(409).json({
        success: false,
        message:
          "Le paiement de l'abonnement n'est pas finalisé. Veuillez réessayer.",
        data: {
          status: stripeStatus || "incomplete",
          paymentIntentStatus: latestPaymentIntent?.status || null,
          subscriptionId: stripeSubscription?.id || resolvedSubscriptionId,
        },
      });
    }

    await syncUserWithStripeSubscription(user, stripeSubscription);
    const refreshedUser = await User.findById(user._id);
    const setting = await getOrCreateSettingDocument();
    const config = formatSubscriptionConfig(setting);

    const responsePayload = {
      success: true,
      data: {
        subscription: buildUserSubscriptionSummary(refreshedUser, config),
        stripe: {
          subscriptionId: stripeSubscription.id,
          status: stripeSubscription.status,
          paymentIntentId:
            stripeSubscription.latest_invoice?.payment_intent?.id || null,
          paymentIntentStatus:
            stripeSubscription.latest_invoice?.payment_intent?.status || null,
          clientSecret:
            stripeSubscription.latest_invoice?.payment_intent?.client_secret ||
            null,
          requiresAction:
            stripeSubscription.latest_invoice?.payment_intent?.status ===
            "requires_action",
        },
      },
    };

    const backgroundJobs = [];
    if (fallbackPaymentResult?.isNew && fallbackPaymentResult?.payment) {
      backgroundJobs.push(
        createPaymentSuccessEmailJob(fallbackPaymentResult.payment),
      );
    }

    res.status(200).json(responsePayload);
    runBackgroundJobs(backgroundJobs);
    return;
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Erreur lors de la confirmation du paiement d'abonnement.",
    });
  }
};

const setSubscriptionAutoRenew = async (req, res) => {
  try {
    const userId = req.body?.userId;
    const autoRenew = req.body?.autoRenew !== false;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Identifiant utilisateur requis.",
      });
    }

    const user = await User.findById(userId);
    if (!user || !user.subscriptionStripeSubscriptionId) {
      return res.status(404).json({
        success: false,
        message: "Aucun abonnement actif pour cet utilisateur.",
      });
    }

    await stripe.subscriptions.update(user.subscriptionStripeSubscriptionId, {
      cancel_at_period_end: !autoRenew,
    });

    const stripeSubscription = await stripe.subscriptions.retrieve(
      user.subscriptionStripeSubscriptionId,
      { expand: ["items.data.price"] },
    );
    await syncUserWithStripeSubscription(user, stripeSubscription);

    const refreshedUser = await User.findById(user._id);
    const setting = await getOrCreateSettingDocument();
    const config = formatSubscriptionConfig(setting);

    return res.status(200).json({
      success: true,
      data: buildUserSubscriptionSummary(refreshedUser, config),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Erreur lors de la mise à jour du renouvellement automatique.",
    });
  }
};

const cancelSubscription = async (req, res) => {
  try {
    const userId = req.body?.userId;
    const immediate = Boolean(req.body?.immediate);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Identifiant utilisateur requis.",
      });
    }

    const user = await User.findById(userId);
    if (!user || !user.subscriptionStripeSubscriptionId) {
      return res.status(404).json({
        success: false,
        message: "Aucun abonnement à annuler.",
      });
    }

    if (immediate) {
      const canceled = await stripe.subscriptions.cancel(
        user.subscriptionStripeSubscriptionId,
      );
      await setUserSubscriptionInactive(user, canceled?.status || "canceled");
      await Subscription.findOneAndUpdate(
        { stripeSubscriptionId: user.subscriptionStripeSubscriptionId },
        {
          status: canceled?.status || "canceled",
          cancelAtPeriodEnd: true,
          canceledAt: new Date(),
        },
        { new: true },
      );
    } else {
      await stripe.subscriptions.update(user.subscriptionStripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      const stripeSubscription = await stripe.subscriptions.retrieve(
        user.subscriptionStripeSubscriptionId,
        { expand: ["items.data.price"] },
      );
      await syncUserWithStripeSubscription(user, stripeSubscription);
    }

    const refreshedUser = await User.findById(user._id);
    const setting = await getOrCreateSettingDocument();
    const config = formatSubscriptionConfig(setting);

    return res.status(200).json({
      success: true,
      data: buildUserSubscriptionSummary(refreshedUser, config),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Erreur lors de l'annulation de l'abonnement.",
    });
  }
};

const refreshUserSubscription = async (req, res) => {
  try {
    const userId = req.params?.userId || req.body?.userId || req.query?.userId;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Identifiant utilisateur requis.",
      });
    }

    const user = await refreshUserSubscriptionFromStripe(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur introuvable.",
      });
    }

    const setting = await getOrCreateSettingDocument();
    const config = formatSubscriptionConfig(setting);

    return res.status(200).json({
      success: true,
      data: buildUserSubscriptionSummary(user, config),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Erreur lors du rafraîchissement abonnement.",
    });
  }
};

const getSubscriptionAdminStats = async (req, res) => {
  try {
    const staff = await ensureAdminStaff(req, res);
    if (!staff) return;

    const setting = await getOrCreateSettingDocument();
    const config = formatSubscriptionConfig(setting);
    const subscribedUsersQuery = {
      $or: [
        { subscriptionIsActive: true },
        { subscriptionStatus: { $in: Array.from(OPEN_STATUSES) } },
        {
          subscriptionStripeSubscriptionId: {
            $exists: true,
            $nin: [null, ""],
          },
        },
        { subscriptionPaymentsCount: { $gt: 0 } },
        { subscriptionAmountPaidTotal: { $gt: 0 } },
      ],
    };

    const hediSummary = await getHediBalanceSummary();

    const subscribedUsers = await User.find(subscribedUsersQuery)
      .select(
        "name email phone_number subscriptionStatus subscriptionIsActive subscriptionAutoRenew subscriptionCurrentPeriodStart subscriptionCurrentPeriodEnd subscriptionMonthlyPrice subscriptionSavingsTotal subscriptionAmountPaidTotal subscriptionPaymentsCount createdAt",
      )
      .sort({ subscriptionAmountPaidTotal: -1, createdAt: -1 })
      .lean();

    const activeSubscribersCount = subscribedUsers.reduce((count, user) => {
      if (isUserSubscriptionActive(user)) {
        return count + 1;
      }
      return count;
    }, 0);

    const openSubscribersCount = subscribedUsers.reduce((count, user) => {
      if (isUserSubscriptionOpen(user)) {
        return count + 1;
      }
      return count;
    }, 0);

    const normalizedUsers = subscribedUsers.map((user) => {
      const totalPaid = roundMoney(user.subscriptionAmountPaidTotal, 0);
      const paymentCount = Math.max(
        0,
        Math.floor(toSafeNumber(user.subscriptionPaymentsCount, 0)),
      );
      const renewalsCount = Math.max(0, paymentCount - 1);

      return {
        _id: user._id,
        name: user.name || "Sans nom",
        email: user.email || "",
        phoneNumber: user.phone_number || "",
        status: user.subscriptionStatus || "inactive",
        isActive: isUserSubscriptionActive(user),
        isOpen: isUserSubscriptionOpen(user),
        autoRenew: Boolean(user.subscriptionAutoRenew),
        currentPeriodStart: user.subscriptionCurrentPeriodStart || null,
        currentPeriodEnd: user.subscriptionCurrentPeriodEnd || null,
        monthlyPrice: roundMoney(user.subscriptionMonthlyPrice, config.monthlyPrice),
        savingsTotal: roundMoney(user.subscriptionSavingsTotal, 0),
        amountPaidTotal: totalPaid,
        paymentsCount: paymentCount,
        renewalsCount,
        createdAt: user.createdAt || null,
      };
    });

    const payouts = await SubscriptionHediPayout.find()
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(100)
      .lean();

    const recentPayments = await SubscriptionPayment.find()
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(50)
      .select(
        "user amount currency paymentType billingReason paidAt stripeInvoiceId hediShareAmount",
      )
      .populate("user", "name email phone_number")
      .lean();

    const avgRevenuePerSubscriber =
      normalizedUsers.length > 0
        ? roundMoney(hediSummary.totalRevenue / normalizedUsers.length, 0)
        : 0;

    return res.status(200).json({
      success: true,
      data: {
        config,
        overview: {
          subscribersCount: normalizedUsers.length,
          activeSubscribersCount,
          openSubscribersCount,
          totalRevenue: hediSummary.totalRevenue,
          totalPaymentsCount: hediSummary.totalPaymentsCount,
          totalRenewalsCount: hediSummary.totalRenewalsCount,
          averageRevenuePerSubscriber: avgRevenuePerSubscriber,
        },
        hedi: {
          sharePercent: hediSummary.sharePercent,
          totalCredits: hediSummary.totalHediCredits,
          totalPayouts: hediSummary.totalPayouts,
          balance: hediSummary.balance,
          payouts: payouts.map((entry) => ({
            _id: entry._id,
            amount: roundMoney(entry.amount, 0),
            paidAt: entry.paidAt || entry.createdAt,
            note: entry.note || "",
            createdAt: entry.createdAt || null,
          })),
        },
        users: normalizedUsers,
        recentPayments: recentPayments.map((payment) => ({
          _id: payment._id,
          userId: payment?.user?._id || null,
          userName: payment?.user?.name || "Utilisateur",
          userEmail: payment?.user?.email || "",
          amount: roundMoney(payment?.amount, 0),
          currency: normalizeCurrency(payment?.currency || "cad"),
          paymentType: payment?.paymentType || "subscription",
          billingReason: payment?.billingReason || "subscription",
          paidAt: payment?.paidAt || payment?.createdAt || null,
          stripeInvoiceId: payment?.stripeInvoiceId || "",
          hediShareAmount: roundMoney(payment?.hediShareAmount, 0),
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Erreur lors du chargement des statistiques d'abonnement.",
    });
  }
};

const createHediPayout = async (req, res) => {
  try {
    const staff = await ensureAdminStaff(req, res);
    if (!staff) return;

    const amount = roundMoney(req.body?.amount, 0);
    const note = String(req.body?.note || "")
      .trim()
      .slice(0, 240);
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

    const hediSummary = await getHediBalanceSummary();
    if (amount > hediSummary.balance) {
      return res.status(400).json({
        success: false,
        message:
          "Montant supérieur au solde de Hedi disponible. Ajustez le montant.",
      });
    }

    const payout = await SubscriptionHediPayout.create({
      amount,
      paidAt,
      note,
      createdByStaffId: staff._id,
    });

    const updatedSummary = await getHediBalanceSummary();
    return res.status(200).json({
      success: true,
      data: {
        payout: {
          _id: payout._id,
          amount: roundMoney(payout.amount, 0),
          paidAt: payout.paidAt,
          note: payout.note || "",
          createdAt: payout.createdAt || null,
        },
        hedi: {
          sharePercent: updatedSummary.sharePercent,
          totalCredits: updatedSummary.totalHediCredits,
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

module.exports = {
  handleStripeWebhook,
  getSubscriptionConfig,
  updateSubscriptionConfig,
  getUserSubscription,
  createSubscription,
  confirmSubscriptionPayment,
  setSubscriptionAutoRenew,
  cancelSubscription,
  refreshUserSubscription,
  getSubscriptionAdminStats,
  createHediPayout,
};
