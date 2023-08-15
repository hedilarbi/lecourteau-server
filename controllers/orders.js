const { default: mongoose } = require("mongoose");
const Order = require("../models/Order");

const createOrder = async (req, res) => {
  const { order } = req.body;

  try {
    const newOrder = new Order({
      user_id: order.order.user_id,
      orderItems: order.order.orderItems,
      total_price: order.order.total,
      sub_total: order.order.subTotal,
      delivery_fee: order.order.deliveryFee,
      type: order.order.type,
      address: {
        latitude: order.address.latitude,
        longitude: order.address.longitude,
      },
      istructions: order.order.istructions,
      status: "onGoing",
      createdAt: new Date().toISOString(),
    });
    const response = await newOrder.save();
    const user = await mongoose.models.User.findById(order.order.user_id);
    user.orders.push(response._id);
    const newUser = await user.save();
    res.status(201).json(newUser);
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const response = await Order.find();
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getOrder = async (req, res) => {
  const { id } = req.params;
  try {
    const response = await Order.findById(id);
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { createOrder, getOrders, getOrder };
