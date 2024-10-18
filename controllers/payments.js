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

    // Check if the customer already exists
    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      // Create a new customer if one doesn't exist
      customer = await stripe.customers.create({ email });
      await User.findOneAndUpdate(
        { email },
        { stripe_id: customer.id },
        { new: true }
      );
    }

    // Attach payment method if not saved
    if (!saved) {
      await stripe.paymentMethods.attach(paymentMethod, {
        customer: customer.id,
      });
    }

    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      customer: customer.id,
      amount,
      currency: "cad",
      payment_method: paymentMethod,
      capture_method: "manual",
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
    });

    res.status(200).json(paymentIntent);
  } catch (error) {
    console.error("Error creating payment:", error);

    res.status(500).json({
      success: false,
      error: error.message || "An error occurred while processing the payment.",
    });
  }
};

const createSetupIntent = async (req, res) => {
  try {
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ["card"],
    });

    res.status(200).json({ clientSecret: setupIntent.client_secret });
  } catch (error) {
    console.error("Error creating setup intent:", error);
    res.status(500).json({
      success: false,
      error:
        error.message || "An error occurred while creating the setup intent.",
    });
  }
};

const getPaymentMethods = async (req, res) => {
  const { customerId } = req.params;

  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
    });

    res.status(200).json(paymentMethods.data);
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    res.status(500).json({
      success: false,
      error:
        error.message || "An error occurred while fetching payment methods.",
    });
  }
};

const verifyPayment = async (req, res) => {
  const { paymentIntentId } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    res.json(paymentIntent);
  } catch (error) {
    res.status(500).json(error.message);
  }
};

module.exports = {
  createPayment,
  createSetupIntent,
  getPaymentMethods,
  verifyPayment,
};
