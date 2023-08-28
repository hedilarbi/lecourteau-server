const { default: mongoose } = require("mongoose");
const Order = require("../models/Order");

const createOrder = async (req, res) => {
  const { order } = req.body;

  try {
    const newOrder = new Order({
      user: order.order.user_id,
      orderItems: order.order.orderItems,
      total_price: order.order.total,
      sub_total: order.order.subTotal,
      delivery_fee: order.order.deliveryFee,
      type: order.type,
      coords: {
        latitude: order.coords.latitude,
        longitude: order.coords.longitude,
      },
      address: order.address,
      istructions: order.order.istructions,
      status: "onGoing",
      offers: order.order.offers,
      rewards: order.order.rewards,
      createdAt: new Date().toISOString(),
    });
    const response = await newOrder.save();
    console.log(response);
    const user = await mongoose.models.User.findById(order.order.user_id);
    user.orders.push(response._id);
    let total = 0;
    if (order.order.rewards.length > 0) {
      order.order.rewards.map((item) => (total += item.points));
      console.log(total);
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
    res.status(201).json(newUser);
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const response = await Order.find().select(
      "status createdAt total_price type"
    );
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
      .populate("offers")
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

module.exports = {
  createOrder,
  getOrders,
  getOrder,
  deleteOrder,
  updateStatus,
  updatePrice,
};
