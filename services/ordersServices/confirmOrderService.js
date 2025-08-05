const Order = require("../../models/Order");
require("dotenv").config();
const nodemailer = require("nodemailer");
const Stripe = require("stripe");

const stripe = Stripe(process.env.STRIPE_PRIVATE_KEY, {
  apiVersion: "2023-08-16",
});
const {
  generateOrderConfirmationEmail,
} = require("../../utils/mailTemplateGenerators");
const { default: mongoose } = require("mongoose");
const { default: Expo } = require("expo-server-sdk");
const PromoCode = require("../../models/PromoCode");
const confirmOrderService = async (id) => {
  try {
    const order = await Order.findById(id)
      .populate({
        path: "orderItems",
        populate: "customizations item",
      })
      .populate({ path: "offers", populate: "offer " })
      .populate({ path: "rewards", populate: "item" })
      .populate({ path: "user" });

    if (!order) {
      return { error: "Order not found" };
    }

    try {
      if (order.paymentIntentId) {
        const paymentIntent = await stripe.paymentIntents.capture(
          order.paymentIntentId
        );

        if (paymentIntent.status !== "succeeded") {
          return { error: "Payment not confirmed" };
        }
        order.payment_status = true;
      }
    } catch (err) {
      order.status = "Annulé";
      await order.save();

      return { error: err.message };
    }

    order.confirmed = true;

    await order.save();

    const user = await mongoose.models.User.findById(order.user._id);

    const pointsToremove = order.rewards.reduce(
      (acc, item) => acc + item.points,
      0
    );

    const pointsEarned = calculatePoints(order);

    const totalPoints = Math.floor(pointsEarned * 10 - pointsToremove);

    user.fidelity_points += totalPoints;

    if (!user.firstOrderDiscountApplied) {
      user.firstOrderDiscountApplied = true;
    }
    if (order.promoCode) {
      const usedPromo = user.usedPromoCodes.find(
        (used) => used.promoCode?.toString() === order.promoCode.toString()
      );

      if (!usedPromo) {
        user.usedPromoCodes.push({
          promoCode: order.promoCode,
          numberOfUses: 1,
        });
      } else {
        usedPromo.numberOfUses += 1;
      }
    }

    const promoCode = await PromoCode.findById(order.promoCode);

    if (promoCode) {
      promoCode.totalUsage += 1;
      await promoCode.save();
    }

    await user.save();

    process.nextTick(() => sentNotification(user, order._id, pointsEarned));
    process.nextTick(() => sendMail(order));

    return { response: "Order confirmed" };
  } catch (err) {
    logWithTimestamp(`Error confirming order: ${err}`);

    return { error: err.message };
  }
};

const sentNotification = async (user, orderId, pointsEarned) => {
  try {
    const expo = new Expo({ useFcmV1: true });
    const userMessage = {
      to: user.expo_token,
      sound: "default",
      body: `Bienvenue chez Le Courteau ! Votre commande a été confirmée et est en cours de préparation, vous avez remporté ${
        pointsEarned * 10
      } points de fidélité.`,
      data: { order_id: orderId },
      title: "Commande confirmée",
      priority: "high",
    };

    if (user.expo_token) {
      const response = await expo.sendPushNotificationsAsync([userMessage]);
    }
  } catch (err) {
    logWithTimestamp(`Error sending notifications: ${err.message}`);
  }
};

const calculatePoints = (order) => {
  let points = 0;

  if (order.offers.length > 0) {
    points += order.offers.reduce((acc, item) => acc + item.price, 0);
  }

  if (order.orderItems.length > 0) {
    points += order.orderItems.reduce((acc, item) => acc + item.price, 0);
  }

  if (order.discount) {
    points -= (points * order.discount) / 100;
  }

  return points;
};

const sendMail = async (order) => {
  try {
    if (order.user && order.user.email) {
      const transporter = nodemailer.createTransport({
        service: "icloud",
        host: "smtp.mail.me.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      });
      let items = [];

      if (order.orderItems.length > 0) {
        items = order.orderItems.map((item) => ({
          name: item.item.name,
          price: item.price,
          customizations: item.customizations.map(
            (customization) => customization.name
          ),
        }));
      }

      if (order.offers.length > 0) {
        order.offers.forEach((offer) => {
          items.push({
            name: offer.offer.name,
            price: offer.price,
          });
        });
      }

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

      const response = await transporter.sendMail(mailOptions);
    }
  } catch (err) {
    logWithTimestamp(`Error sending email: ${err.message}`);
  }
};
const logWithTimestamp = (message) => {
  const timeStamp = new Date().toISOString();
  console.error(`${timeStamp} - ${message}`);
};

module.exports = confirmOrderService;
