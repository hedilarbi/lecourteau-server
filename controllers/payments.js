const Stripe = require("stripe");
require("dotenv/config");

const stripe = Stripe(process.env.STRIPE_PRIVATE_KEY, {
  apiVersion: "2023-08-16",
});

const createPayment = async (req, res) => {
  const { amount } = req.body;
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount, //lowest denomination of particular currency
      currency: "cad",
      payment_method_types: ["card"], //by default
    });

    const clientSecret = paymentIntent.client_secret;

    res.json({
      clientSecret: clientSecret,
    });
  } catch (e) {
    res.json({ error: e.message });
  }
};

module.exports = { createPayment };
