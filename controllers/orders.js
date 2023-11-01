const { default: mongoose, Schema } = require("mongoose");
const Order = require("../models/Order");
const generateRandomCode = require("../utils/generateOrderCode");
const { Expo } = require("expo-server-sdk");
const {
  IN_DELIVERY,
  READY,
  PICKEDUP,
  DELIVERED,
  CANCELED,
  ON_GOING,
} = require("../utils/constants");

const createOrder = async (req, res) => {
  const { order } = req.body;

  try {
    const code = generateRandomCode(8);
    const newOrder = new Order({
      user: order.order.user_id,
      orderItems: order.order.orderItems,
      total_price: parseFloat(order.order.total),
      sub_total: parseFloat(order.order.subTotal),
      delivery_fee: parseFloat(order.order.deliveryFee),
      type: order.type,
      coords: {
        latitude: order.coords.latitude,
        longitude: order.coords.longitude,
      },
      code: code.toUpperCase(),
      address: order.address,
      istructions: order.order.istructions,
      status: ON_GOING,
      offers: order.order.offers,
      rewards: order.order.rewards,
      createdAt: new Date().toISOString(),
      restaurant: order.restaurant,
    });
    const response = await newOrder.save();

    const user = await mongoose.models.User.findById(order.order.user_id);
    user.orders.push(response._id);

    let total = 0;
    if (order.order.rewards.length > 0) {
      order.order.rewards.map((item) => (total += item.points));

      user.fidelity_points = user.fidelity_points - total;
    }
    let points = 0;
    if (order.order.offers.length > 0) {
      order.order.offers.map((item) => (points += item.price));
    }
    if (order.order.orderItems.length > 0) {
      order.order.orderItems.map((item) => (points += item.price));
    }
    user.fidelity_points = user.fidelity_points + parseInt(points) * 10;

    const newUser = await user.save();
    const restaurant = await mongoose.models.Restaurant.findById(
      order.restaurant
    );
    restaurant.orders.push(response._id);
    await restaurant.save();

    const expo_token = user.expo_token;
    const expo = new Expo();

    const userMessage = {
      to: expo_token,
      sound: "default",
      body: `Bienvenu chez Le Courteau, votre commande est en préparation.`,

      data: {
        order_id: response._id,
      },
      title: "Nouvelle Commande",
      priority: "high",
    };
    const dashboardMessage = {
      to: restaurant.expo_token,
      sound: "default",
      body: `Nouvelle commande en attente`,

      data: {
        order_id: response._id,
      },
      title: "Nouvelle Commande",
      priority: "high",
    };

    await expo.sendPushNotificationsAsync([userMessage]);
    await expo.sendPushNotificationsAsync([dashboardMessage]);
    res.status(201).json({ user: newUser, orderId: response._id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const data = await Order.find().select(
      "status createdAt total_price type code"
    );
    const response = data.reverse();
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getOrder = async (req, res) => {
  const { id } = req.params;

  try {
    const response = await Order.findById(id)
      .populate({
        path: "orderItems",
        populate: "customizations item",
      })
      .populate({ path: "offers", populate: "offer" })
      .populate("rewards")
      .populate({ path: "user", select: "name phone_number email" });
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteOrder = async (req, res) => {
  const { id } = req.params;

  try {
    await Order.findByIdAndDelete(id);
    res.status(200).json({ message: "order deleted", success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const response = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    const user = await mongoose.models.User.findById(response.user);
    const expo_token = user.expo_token;
    const expo = new Expo();
    let message = {};

    message = {
      to: expo_token,
      sound: "default",
      body: `Your order is ${status} `,
      data: {
        order_id: id,
      },
      title: "New Order",

      priority: "high",
    };

    const ticket = await expo.sendPushNotificationsAsync([message]);

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
const updatePrice = async (req, res) => {
  const { id } = req.params;
  const { price } = req.body;
  try {
    const response = await Order.findByIdAndUpdate(
      id,
      { total_price: parseFloat(price) },
      { new: true }
    );
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const reviewOrder = async (req, res) => {
  const { id } = req.params;
  const { comment, rating } = req.body;
  const review = {
    comment,
    rating: parseInt(rating),
    status: true,
  };
  try {
    const response = await Order.findByIdAndUpdate(
      id,
      { review },
      { new: true }
    );
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrder,
  deleteOrder,
  updateStatus,
  updatePrice,
  reviewOrder,
};
