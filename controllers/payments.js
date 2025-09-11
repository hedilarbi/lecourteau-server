const Stripe = require("stripe");
const User = require("../models/User");
const { default: mongoose } = require("mongoose");
require("dotenv/config");

const stripe = Stripe(process.env.STRIPE_PRIVATE_KEY, {
  apiVersion: "2023-08-16",
});
const logWithTimestamp = (message) => {
  const timeStamp = new Date().toISOString();
  console.error(`${timeStamp} - ${message}`);
};
const createPayment = async (req, res) => {
  const { amount, email, paymentMethod, saved, userId } = req.body;

  try {
    if (!amount || !email || !paymentMethod) {
      return res.status(400).json({
        success: false,
        error: "Le montant, l'email et la méthode de paiement sont requis.",
      });
    }
    if (userId) {
      const user = await mongoose.models.User.findById(userId).populate(
        "orders"
      );
      if (user.orders.length > 0) {
        const lastOrder = user.orders[user.orders.length - 1];
        const lastOrderTime = new Date(lastOrder.createdAt).getTime();
        const currentTime = new Date().getTime();
        const timeDifference = (currentTime - lastOrderTime) / 1000 / 60; // time difference in minutes
        if (timeDifference <= 1) {
          return res.status(400).json({
            success: false,
            error:
              "Vous avez déjà passé une commande il y a moins d'une minute. Veuillez attendre avant de passer une nouvelle commande.",
          });
        }
      }
    }
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

    const newPM = await stripe.paymentMethods.retrieve(paymentMethod);
    if (newPM.type !== "card" || !newPM.card) {
      return res
        .status(400)
        .json({ success: false, error: "Méthode de paiement invalide." });
    }

    // 2) Look for an already saved card with the same fingerprint
    //    (fallback to brand+last4+exp if fingerprint isn’t present)
    const fp = newPM.card.fingerprint || null;

    let existingPMToReuse = null;
    // Paginate if you have heavy users; 100 is usually enough
    let startingAfter = undefined;
    do {
      const list = await stripe.paymentMethods.list({
        customer: customer.id,
        type: "card",
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });

      for (const pm of list.data) {
        const sameFingerprint =
          fp && pm.card && pm.card.fingerprint && pm.card.fingerprint === fp;
        const sameFallback =
          !fp &&
          pm.card &&
          pm.card.last4 === newPM.card.last4 &&
          pm.card.brand === newPM.card.brand &&
          pm.card.exp_month === newPM.card.exp_month &&
          pm.card.exp_year === newPM.card.exp_year;

        if (sameFingerprint || sameFallback) {
          existingPMToReuse = pm;
          break;
        }
      }

      if (existingPMToReuse || !list.has_more) break;
      startingAfter = list.data[list.data.length - 1].id;
    } while (true);

    // 3) Attach only if it’s truly new
    let pmToUseId = paymentMethod;
    if (existingPMToReuse) {
      pmToUseId = existingPMToReuse.id; // reuse
    } else if (!saved) {
      await stripe.paymentMethods.attach(paymentMethod, {
        customer: customer.id,
      });
    }

    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      customer: customer.id,
      amount,
      currency: "cad",
      payment_method: pmToUseId, // pm_xxx (saved or newly attached)
      capture_method: "manual",
      confirm: true, // you keep server-side confirm
      payment_method_types: ["card"],
      confirmation_method: "manual",
    });

    res.status(200).json(paymentIntent);
  } catch (error) {
    logWithTimestamp(
      `Error creating payment: userId ${userId}, error: ${error}`
    );

    res.status(500).json({
      success: false,
      error: error || "An error occurred while processing the payment.",
    });
  }
};
const confirmPayment = async (req, res) => {
  const { paymentIntentId } = req.body;
  try {
    const pi = await stripe.paymentIntents.confirm(paymentIntentId);
    res.json({ success: true, data: pi });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

const createSetupIntent = async (req, res) => {
  try {
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ["card"],
    });

    res.status(200).json({ clientSecret: setupIntent.client_secret });
  } catch (error) {
    logWithTimestamp(`Error creating setup intent: ${error}`);

    res.status(500).json({
      success: false,
      error: error || "An error occurred while creating the setup intent.",
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

const catchError = (req, res) => {
  try {
    const { error, userId, source } = req.body;

    if (!error) {
      return res.status(400).json({
        success: false,
        error: "No error message provided.",
      });
    }
    logWithTimestamp(
      `Error caught in ${source}: user ${userId}, error: ${error}`
    );
    res.status(200).json({
      success: true,
      message: "Error in process order logged successfully.",
    });
  } catch (error) {
    logWithTimestamp(`Error in catchError: ${error}`);
    res.status(500).json({
      success: false,
      error: error.message || "An unexpected error occurred.",
    });
  }
};

module.exports = {
  createPayment,
  createSetupIntent,
  getPaymentMethods,
  verifyPayment,
  catchError,
  confirmPayment,
};
