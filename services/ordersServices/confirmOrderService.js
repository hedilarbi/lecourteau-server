// services/orders/confirmOrderService.js
const Order = require("../../models/Order");
const PromoCode = require("../../models/PromoCode");
const { default: mongoose } = require("mongoose");
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_PRIVATE_KEY, {
  apiVersion: "2023-08-16",
});
const { default: Expo } = require("expo-server-sdk");
const {
  generateOrderConfirmationEmail,
} = require("../../utils/mailTemplateGenerators");
const nodemailer = require("nodemailer");

const logWithTimestamp = (msg, extra = {}) => {
  const timeStamp = new Date().toISOString();
  console.error(
    `${timeStamp} - ${msg}`,
    Object.keys(extra).length ? extra : ""
  );
};

// Optional: ensure you have a unique index to avoid reusing a PI across orders
// In your schema once: orderSchema.index({ paymentIntentId: 1 }, { unique: true, sparse: true });

/**
 * Atomically "claim" the order for capture so only one runner captures it.
 * Returns the claimed order or null if someone else already claimed/confirmed.
 */
async function claimOrderForCapture(orderId) {
  // Create a transient captureLock with a timestamp to avoid stuck locks
  const now = new Date();
  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      confirmed: { $ne: true },
      "locks.capturing": { $ne: true },
    },
    {
      $set: { "locks.capturing": true, "locks.capturingAt": now },
    },
    { new: true }
  )
    .populate({ path: "orderItems", populate: "customizations item" })
    .populate({ path: "offers", populate: "offer " })
    .populate({ path: "rewards", populate: "item" })
    .populate({ path: "user" });

  return order;
}

async function releaseCaptureLock(orderId) {
  await Order.updateOne(
    { _id: orderId },
    { $unset: { "locks.capturing": "", "locks.capturingAt": "" } }
  );
}

function calculatePoints(order) {
  let points = 0;
  if (order.offers?.length)
    points += order.offers.reduce((acc, it) => acc + it.price, 0);
  if (order.orderItems?.length)
    points += order.orderItems.reduce((acc, it) => acc + it.price, 0);
  if (order.discount) points -= (points * order.discount) / 100;
  return points;
}

async function sendMail(order) {
  try {
    if (order.user?.email) {
      const transporter = nodemailer.createTransport({
        service: "icloud",
        host: "smtp.mail.me.com",
        port: 587,
        secure: false,
        auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
      });

      const items = [
        ...(order.orderItems || []).map((it) => ({
          name: it.item.name,
          price: it.price,
          customizations: it.customizations.map((c) => c.name),
        })),
        ...(order.offers || []).map((o) => ({
          name: o.offer.name,
          price: o.price,
        })),
      ];

      const mailOptions = {
        from: process.env.MAIL_USER,
        to: order.user.email,
        subject: "Reçu commande Casse-croûte Courteau",
        html: generateOrderConfirmationEmail(
          order.user.name,
          order.code,
          order.type,
          order.address,
          order.total_price.toFixed(2),
          items
        ),
      };

      await transporter.sendMail(mailOptions);
    }
  } catch (err) {
    logWithTimestamp("Error sending email", { err: err.message });
  }
}

async function sendPush(user, orderId, pointsEarned) {
  try {
    if (!user?.expo_token) return;
    const expo = new Expo({ useFcmV1: true });
    await expo.sendPushNotificationsAsync([
      {
        to: user.expo_token,
        sound: "default",
        title: "Commande confirmée",
        body: `Bienvenue chez Le Courteau ! Votre commande a été confirmée et est en cours de préparation, vous avez remporté ${
          pointsEarned * 10
        } points de fidélité.`,
        data: { order_id: orderId },
        priority: "high",
      },
    ]);
  } catch (err) {
    logWithTimestamp("Error sending push", { err: err.message });
  }
}

module.exports = async function confirmOrderService(orderId) {
  // 1) Claim order (idempotent, atomic)
  const order = await claimOrderForCapture(orderId);

  if (!order) {
    // Someone else already confirmed or is capturing
    const current = await Order.findById(orderId);
    if (!current) return { error: "Order not found" };
    if (current.confirmed || current.payment_status) {
      return { response: "Order already confirmed" };
    }
    // Still not confirmed but lock held by someone else: tell client to refresh
    return { error: "Order is being confirmed. Please refresh." };
  }

  try {
    if (!order.paymentIntentId) {
      // No card payment (e.g., cash), just mark confirmed
      order.confirmed = true;
      await order.save();
      return { response: "Order confirmed (no card capture)" };
    }

    // 2) Inspect PI first
    const pi = await stripe.paymentIntents.retrieve(order.paymentIntentId, {
      expand: ["latest_charge"],
    });

    // 3) Handle states safely
    if (pi.status === "succeeded") {
      // Already captured previously => treat as success (idempotent)
      order.payment_status = true;
      order.confirmed = true;
      await order.save();
      // Loyalty + promo bookkeeping (run once; guard via flags if needed)
      await finalizeLoyaltyAndPromo(order);
      process.nextTick(() =>
        sendPush(order.user, order._id, calculatePoints(order))
      );
      process.nextTick(() => sendMail(order));
      return { response: "Order already captured; confirmed" };
    }

    if (pi.status === "canceled") {
      // Actual canceled PI => mark order canceled (your choice)
      order.status = "Annulé";
      await order.save();
      return { error: "PaymentIntent is canceled" };
    }

    if (pi.status !== "requires_capture") {
      // Unexpected state: don't cancel the order; bubble up a safe error
      logWithTimestamp("PI not capturable", { status: pi.status, id: pi.id });
      return { error: `PaymentIntent not capturable (status: ${pi.status})` };
    }

    // 4) Capture with an idempotency key (dedupe retries)
    const idempotencyKey = `capture:${order._id}:${pi.id}`;
    const captured = await stripe.paymentIntents.capture(
      pi.id,
      // You can optionally set { amount_to_capture } here
      {},
      { idempotencyKey }
    );

    if (captured.status !== "succeeded") {
      // Don't cancel; let a webhook / retry handle it gracefully
      logWithTimestamp("Capture did not succeed immediately", {
        status: captured.status,
        id: captured.id,
      });
      return { error: `Capture state: ${captured.status}` };
    }

    // 5) Mark order paid/confirmed
    order.payment_status = true;
    order.confirmed = true;
    await order.save();

    // 6) Loyalty + promo bookkeeping
    await finalizeLoyaltyAndPromo(order);
    process.nextTick(() =>
      sendPush(order.user, order._id, calculatePoints(order))
    );
    process.nextTick(() => sendMail(order));

    return { response: "Order confirmed" };
  } catch (err) {
    // IMPORTANT: do not auto-cancel on “already captured”
    const msg = (err && err.message) || "Unknown error";
    const code = err && err.code;

    // If duplicate capture attempt, treat as success
    if (
      code === "payment_intent_unexpected_state" &&
      /already been captured|already captured/i.test(msg)
    ) {
      order.payment_status = true;
      order.confirmed = true;
      await order.save();
      await finalizeLoyaltyAndPromo(order);
      process.nextTick(() =>
        sendPush(order.user, order._id, calculatePoints(order))
      );
      process.nextTick(() => sendMail(order));
      return { response: "Order already captured; confirmed" };
    }

    logWithTimestamp("Error confirming order", { orderId, code, msg });
    // Do NOT cancel here. Just release the lock and surface the error.
    return { error: msg };
  } finally {
    await releaseCaptureLock(orderId);
  }
};

async function finalizeLoyaltyAndPromo(order) {
  const user = await mongoose.models.User.findById(order.user._id);
  const pointsToremove = (order.rewards || []).reduce(
    (acc, it) => acc + it.points,
    0
  );
  const pointsEarned = calculatePoints(order);
  const totalPoints = Math.floor(pointsEarned * 10 - pointsToremove);
  user.fidelity_points += totalPoints;
  if (!user.firstOrderDiscountApplied) user.firstOrderDiscountApplied = true;

  if (order.promoCode) {
    const used = user.usedPromoCodes.find(
      (u) => String(u.promoCode) === String(order.promoCode)
    );
    if (!used)
      user.usedPromoCodes.push({ promoCode: order.promoCode, numberOfUses: 1 });
    else used.numberOfUses += 1;

    const promo = await PromoCode.findById(order.promoCode);
    if (promo) {
      promo.totalUsage += 1;
      await promo.save();
    }
  }

  await user.save();
}
