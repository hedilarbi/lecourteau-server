const Stripe = require("stripe");

require("dotenv/config");

const stripe = Stripe(process.env.STRIPE_PRIVATE_KEY, {
  apiVersion: "2023-08-16",
});

const CANCELLABLE_PAYMENT_INTENT_STATUSES = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
  "requires_capture",
]);

const normalizePaymentIntentId = (value) => String(value || "").trim();

const isAlreadyCanceledStripeError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("already canceled") ||
    message.includes("already been canceled")
  );
};

const cancelCheckoutPaymentIntentIfPossible = async (
  paymentIntentId,
  options = {},
) => {
  const normalizedPaymentIntentId = normalizePaymentIntentId(paymentIntentId);
  if (!normalizedPaymentIntentId) {
    return {
      status: false,
      skipped: true,
      reason: "missing_payment_intent_id",
    };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(
      normalizedPaymentIntentId,
    );
    const status = String(paymentIntent?.status || "").trim().toLowerCase();

    if (status === "canceled") {
      return {
        status: true,
        skipped: true,
        reason: "already_canceled",
        paymentIntent,
      };
    }

    if (!CANCELLABLE_PAYMENT_INTENT_STATUSES.has(status)) {
      return {
        status: false,
        skipped: true,
        reason: `not_cancellable:${status || "unknown"}`,
        paymentIntent,
      };
    }

    const canceledPaymentIntent = await stripe.paymentIntents.cancel(
      normalizedPaymentIntentId,
      {
        cancellation_reason: options?.cancellationReason || "abandoned",
      },
    );

    return {
      status: true,
      canceled: true,
      paymentIntent: canceledPaymentIntent,
    };
  } catch (error) {
    if (isAlreadyCanceledStripeError(error)) {
      return {
        status: true,
        skipped: true,
        reason: "already_canceled",
      };
    }

    return {
      status: false,
      error,
    };
  }
};

module.exports = {
  cancelCheckoutPaymentIntentIfPossible,
};
