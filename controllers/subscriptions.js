const User = require("../models/User");
const Subscription = require("../models/Subscription");
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
      case "invoice.paid":
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
};
