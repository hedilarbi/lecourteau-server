const createOrderService = require("../services/ordersServices/createOrderService");
const getOrdersService = require("../services/ordersServices/getOrdersService");
const getOrderService = require("../services/ordersServices/getOrderService");
const deleteOrderService = require("../services/ordersServices/deleteOrderService");
const updateStatusService = require("../services/ordersServices/updateStatusService");
const updatePriceService = require("../services/ordersServices/updatePriceService");
const orderDeliveredService = require("../services/ordersServices/orderDeliveredService");
const reviewOrderService = require("../services/ordersServices/reviewOrderService");
const updateOrderPriceAndStatusService = require("../services/ordersServices/updateOrderPriceAndStatusService");

const createOrder = async (req, res) => {
  const { order } = req.body;

  try {
    const { error, user, response } = await createOrderService(order);
    if (error) {
      return res.status(400).json({ success: false, error });
    }
    res.status(201).json({ user, orderId: response._id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const { response, error } = await getOrdersService();
    if (error) {
      return res.status(400).json({ success: false, error });
    }
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getOrder = async (req, res) => {
  const { id } = req.params;

  try {
    const { response, error } = await getOrderService(id);
    if (error) {
      return res.status(400).json({ success: false, error });
    }

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteOrder = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await deleteOrderService(id);
    if (error) {
      return res.status(400).json({ success: false, error });
    }
    res.status(200).json({ message: "order deleted", success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const { error } = updateStatusService(id, status);
    if (error) {
      return res.status(400).json({ success: false, error });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
const updatePrice = async (req, res) => {
  const { id } = req.params;
  const { price } = req.body;
  try {
    const { response, error } = await updatePriceService(id, price);
    if (error) {
      return res.status(400).json({ success: false, error });
    }
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const updatePriceAndStatus = async (req, res) => {
  const { id } = req.params;
  const { status, price } = req.body;

  try {
    const { error } = await updateOrderPriceAndStatusService(id, status, price);
    if (error) {
      console.log("error", error);
      return res.status(400).json({ success: false, error });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const orderDelivered = async (req, res) => {
  const { orderId } = req.params;
  const { staffId } = req.body;

  try {
    const { error } = await orderDeliveredService(orderId, staffId);
    if (error) {
      return res.status(400).json({ success: false, error });
    }
    res.status(200).json({ success: true });
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
    const { error } = reviewOrderService(id, review);
    if (error) {
      return res.status(400).json({ success: false, error });
    }
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
  orderDelivered,
  updatePriceAndStatus,
};
