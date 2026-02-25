const User = require("../models/User");
const Subscription = require("../models/Subscription");
const SubscriptionPayment = require("../models/SubscriptionPayment");
const SubscriptionHediPayout = require("../models/SubscriptionHediPayout");
const Staff = require("../models/Staff");
const {
  stripe,
  isOpenStatus,
  getOrCreateSettingDocument,
  ensureSubscriptionStripePrice,
  ensureStripeCustomerForUser,
  syncUserWithStripeSubscription,
  buildUserSubscriptionSummary,
  refreshUserSubscriptionFromStripe,
  setUserSubscriptionInactive,
} = require("../services/subscriptionServices/subscriptionHelpers");

const HEDI_SHARE_PERCENT = 10;
const ACTIVE_STATUSES = new Set(["active", "trialing"]);
const OPEN_STATUSES = new Set([
  "active",
  "trialing",
  "incomplete",
  "past_due",
  "unpaid",
]);

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
  const status = String(user?.subscriptionStatus || "")
    .trim()
    .toLowerCase();
  if (!ACTIVE_STATUSES.has(status)) return false;

  const periodEnd = user?.subscriptionCurrentPeriodEnd
    ? new Date(user.subscriptionCurrentPeriodEnd)
    : null;
  if (!(periodEnd instanceof Date) || Number.isNaN(periodEnd.getTime())) {
    return true;
  }
  return periodEnd.getTime() > Date.now();
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

const recordSubscriptionPaymentFromInvoice = async (invoice) => {
  const invoiceId = String(invoice?.id || "").trim();
  if (!invoiceId) return null;

  const existingPayment = await SubscriptionPayment.findOne({
    stripeInvoiceId: invoiceId,
  }).lean();
  if (existingPayment) {
    return existingPayment;
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
      return SubscriptionPayment.findOne({ stripeInvoiceId: invoiceId }).lean();
    }
    throw error;
  }

  user.subscriptionAmountPaidTotal = roundMoney(
    toSafeNumber(user.subscriptionAmountPaidTotal, 0) + amountPaid,
    0,
  );
  user.subscriptionPaymentsCount =
    Math.max(0, Math.floor(toSafeNumber(user.subscriptionPaymentsCount, 0))) + 1;
  await user.save();

  return createdPayment;
};

const getHediBalanceSummary = async () => {
  const [creditAgg] = await SubscriptionPayment.aggregate([
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$amount" },
        totalPaymentsCount: { $sum: 1 },
        totalRenewalsCount: {
          $sum: {
            $cond: [{ $eq: ["$paymentType", "renewal"] }, 1, 0],
          },
        },
        totalHediCredits: { $sum: "$hediShareAmount" },
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

  const totalRevenue = roundMoney(creditAgg?.totalRevenue, 0);
  const totalPaymentsCount = Math.max(
    0,
    Math.floor(toSafeNumber(creditAgg?.totalPaymentsCount, 0)),
  );
  const totalRenewalsCount = Math.max(
    0,
    Math.floor(toSafeNumber(creditAgg?.totalRenewalsCount, 0)),
  );
  const totalHediCredits = roundMoney(creditAgg?.totalHediCredits, 0);
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
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const stripeSubscription = event.data?.object;
        await syncSubscriptionFromWebhook(stripeSubscription?.id);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data?.object;
        await recordSubscriptionPaymentFromInvoice(invoice);
        const invoiceSubscriptionId = resolveStripeSubscriptionId(
          invoice?.subscription,
        );
        if (invoiceSubscriptionId) {
          await syncSubscriptionFromWebhook(invoiceSubscriptionId);
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data?.object;
        const invoiceSubscriptionId = resolveStripeSubscriptionId(
          invoice?.subscription,
        );
        if (invoiceSubscriptionId) {
          await syncSubscriptionFromWebhook(invoiceSubscriptionId);
        }
        break;
      }
      default:
        break;
    }

    return res.status(200).json({ received: true });
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

  return {
    monthlyPrice: Number.isFinite(monthlyPrice) ? monthlyPrice : 11.99,
    currency: currency || "cad",
    benefits: {
      percentDiscount: 20,
      freeDelivery: true,
      freeItemPerMonth: 1,
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

    const nextPrice = Number(req.body?.monthlyPrice);
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Le prix mensuel est invalide.",
      });
    }

    const normalizedPrice = Math.round(nextPrice * 100) / 100;
    const { setting } = await ensureSubscriptionStripePrice(normalizedPrice);

    return res.status(200).json({
      success: true,
      data: formatSubscriptionConfig(setting),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error.message || "Erreur lors de la mise à jour du prix abonnement.",
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
          let synchronizedSubscription = existing;

          if (existing.cancel_at_period_end !== desiredCancelAtPeriodEnd) {
            synchronizedSubscription = await stripe.subscriptions.update(
              existing.id,
              {
                cancel_at_period_end: desiredCancelAtPeriodEnd,
                default_payment_method: resolvedPaymentMethodId,
                expand: ["items.data.price", "latest_invoice.payment_intent"],
              },
            );
          } else if (existing.default_payment_method !== resolvedPaymentMethodId) {
            synchronizedSubscription = await stripe.subscriptions.update(
              existing.id,
              {
                default_payment_method: resolvedPaymentMethodId,
                expand: ["items.data.price", "latest_invoice.payment_intent"],
              },
            );
          }

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

    const stripeSubscription = await stripe.subscriptions.retrieve(
      resolvedSubscriptionId,
      { expand: ["items.data.price", "latest_invoice.payment_intent"] },
    );

    await syncUserWithStripeSubscription(user, stripeSubscription);
    const refreshedUser = await User.findById(user._id);
    const setting = await getOrCreateSettingDocument();
    const config = formatSubscriptionConfig(setting);

    return res.status(200).json({
      success: true,
      data: {
        subscription: buildUserSubscriptionSummary(refreshedUser, config),
        stripe: {
          subscriptionId: stripeSubscription.id,
          status: stripeSubscription.status,
          paymentIntentId:
            stripeSubscription.latest_invoice?.payment_intent?.id || null,
          clientSecret:
            stripeSubscription.latest_invoice?.payment_intent?.client_secret ||
            null,
          requiresAction:
            stripeSubscription.latest_invoice?.payment_intent?.status ===
            "requires_action",
        },
      },
    });
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
    const hediSummary = await getHediBalanceSummary();

    const subscribedUsers = await User.find({
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
    })
      .select(
        "name email phone_number subscriptionStatus subscriptionIsActive subscriptionAutoRenew subscriptionCurrentPeriodStart subscriptionCurrentPeriodEnd subscriptionMonthlyPrice subscriptionSavingsTotal subscriptionAmountPaidTotal subscriptionPaymentsCount createdAt",
      )
      .sort({ subscriptionAmountPaidTotal: -1, createdAt: -1 })
      .lean();

    const paymentStatsByUser = await SubscriptionPayment.aggregate([
      {
        $group: {
          _id: "$user",
          totalPaid: { $sum: "$amount" },
          paymentsCount: { $sum: 1 },
        },
      },
    ]);
    const paymentStatsMap = new Map(
      paymentStatsByUser.map((entry) => [String(entry._id), entry]),
    );

    const activeSubscribersCount = subscribedUsers.reduce((count, user) => {
      if (isUserSubscriptionActive(user) || Boolean(user?.subscriptionIsActive)) {
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
      const paymentStats = paymentStatsMap.get(String(user._id));
      const totalPaid = roundMoney(
        paymentStats?.totalPaid ?? user.subscriptionAmountPaidTotal,
        0,
      );
      const paymentCount = Math.max(
        0,
        Math.floor(
          toSafeNumber(
            paymentStats?.paymentsCount ?? user.subscriptionPaymentsCount,
            0,
          ),
        ),
      );
      const renewalsCount = Math.max(0, paymentCount - 1);

      return {
        _id: user._id,
        name: user.name || "Sans nom",
        email: user.email || "",
        phoneNumber: user.phone_number || "",
        status: user.subscriptionStatus || "inactive",
        isActive: isUserSubscriptionActive(user) || Boolean(user.subscriptionIsActive),
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
