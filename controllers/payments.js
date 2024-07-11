const Stripe = require("stripe");
const User = require("../models/User");
require("dotenv/config");

const stripe = Stripe(process.env.STRIPE_PRIVATE_KEY, {
  apiVersion: "2023-08-16",
});

const createPayment = async (req, res) => {
  const { amount, email, paymentMethod, saved } = req.body;

  try {
    let customer;
    const customers = await stripe.customers.list({ email });

    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await stripe.customers.create({ email });
      await User.findOneAndUpdate(
        { email },
        { stripe_id: customer.id },
        { new: true }
      );
    }

    if (!saved) {
      await stripe.paymentMethods.attach(paymentMethod, {
        customer: customer.id,
      });
    }
    const paymentIntent = await stripe.paymentIntents.create({
      customer: customer.id,
      amount,
      currency: "cad",
      payment_method: paymentMethod,
    });

    const clientSecret = paymentIntent.client_secret;

    res.json({
      clientSecret: clientSecret,
    });
  } catch (e) {
    console.log(e);
    res.json({ error: e.message });
  }
};
const createSetupIntent = async (req, res) => {
  try {
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ["card"],
    });

    res.json({
      clientSecret: setupIntent.client_secret,
    });
  } catch (e) {
    res.json({ error: e.message });
  }
};

const getPaymentMethods = async (req, res) => {
  const { customerId } = req.params;

  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
    });

    res.json(paymentMethods.data);
  } catch (error) {
    res.status(500).json(error.message);
  }
};

module.exports = { createPayment, createSetupIntent, getPaymentMethods };
