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
const confirmOrderService = async (id) => {
  try {
    const order = await Order.findById(id)
      .populate({
        path: "orderItems",
        populate: "customizations item",
      })
      .populate({ path: "offers", populate: "offer customizations" })
      .populate({ path: "rewards", populate: "item" })
      .populate({ path: "user" });

    if (!order) {
      return { error: "Order not found" };
    }

    // Attempt to capture the payment
    if (order.paymentIntentId) {
      const paymentIntent = await stripe.paymentIntents.capture(
        order.paymentIntentId
      );

      if (paymentIntent.status !== "succeeded") {
        return { error: "Payment not confirmed" };
      }
    }
    // Update order confirmation status
    order.confirmed = true;
    await order.save();

    // Send confirmation email if the user has an email
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

      // Build the items list for the email
      const items = order.orderItems.map((item) => ({
        name: item.item.name,
        price: item.price,
        customizations: item.customizations.map(
          (customization) => customization.name
        ),
      }));

      // Add offers if they exist
      if (order.offers.length > 0) {
        order.offers.forEach((offer) => {
          items.push({
            name: offer.offer.name,
            price: offer.price,
            customizations: offer.customizations.map(
              (customization) => customization.name
            ),
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

      await transporter.sendMail(mailOptions);
    }

    return { response: "Order confirmed" };
  } catch (err) {
    logWithTimestamp(`Error confirming order: ${err}`);

    return { error: err.message };
  }
};
const logWithTimestamp = (message) => {
  const timeStamp = new Date().toISOString();
  console.error(`${timeStamp} - ${message}`);
};

module.exports = confirmOrderService;
