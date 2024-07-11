const Order = require("../../models/Order");
require("dotenv").config();
const nodemailer = require("nodemailer");
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
    order.confirmed = true;
    await order.save();
    if (order.user.email) {
      const transporter = nodemailer.createTransport({
        service: "icloud",
        secure: false,
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      });

      let items = [];
      order.orderItems.map((item) => {
        items.push({
          name: item.item.name,
          price: item.price,
          customizations: item.customizations.map((customization) => {
            return customization.name;
          }),
        });
      });

      if (order.offers.length > 0) {
        order.offers.map((offer) => {
          items.push({
            name: offer.offer.name,
            price: offer.price,
            customizations: offer.customizations.map((customization) => {
              return customization.name;
            }),
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
      transporter.sendMail(mailOptions);
    }
    return { response: "Order confirmed" };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = confirmOrderService;
