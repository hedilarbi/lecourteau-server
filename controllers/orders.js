const createOrderService = require("../services/ordersServices/createOrderService");
const getOrdersService = require("../services/ordersServices/getOrdersService");
const getOrderService = require("../services/ordersServices/getOrderService");
const deleteOrderService = require("../services/ordersServices/deleteOrderService");
const updateStatusService = require("../services/ordersServices/updateStatusService");
const updatePriceService = require("../services/ordersServices/updatePriceService");
const orderDeliveredService = require("../services/ordersServices/orderDeliveredService");
const reviewOrderService = require("../services/ordersServices/reviewOrderService");
const updateOrderPriceAndStatusService = require("../services/ordersServices/updateOrderPriceAndStatusService");
const nodemailer = require("nodemailer");
const {
  generateOrderConfirmationEmail,
} = require("../utils/mailTemplateGenerators");
const confirmOrderService = require("../services/ordersServices/confirmOrderService");
require("dotenv").config();
const createOrder = async (req, res) => {
  const { order } = req.body;

  try {
    const { error, user, response } = await createOrderService(order);

    if (error) {
      console.error("Error creating order service:", error);
      return res.status(400).json({ success: false, message: error });
    }
    res.status(201).json({ success: true, user, orderId: response._id });
  } catch (err) {
    console.error("Error creating order:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const { response, error } = await getOrdersService(req.query);
    if (error) {
      console.error("Error fetching orders:", error);
      return res.status(400).json({ success: false, message: error });
    }
    res.status(200).json(response);
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getOrder = async (req, res) => {
  const { id } = req.params;

  try {
    const { response, error } = await getOrderService(id);
    if (error) {
      console.error("Error fetching order:", error);
      return res.status(404).json({ success: false, message: error });
    }

    res.status(200).json(response);
  } catch (err) {
    console.error("Error fetching order:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteOrder = async (req, res) => {
  const { id } = req.params;

  try {
    const { error, success } = await deleteOrderService(id);
    if (error) {
      console.error("Error deleting order:", error);
      return res.status(404).json({ success: false, message: error });
    }
    res
      .status(200)
      .json({ message: "Order deleted successfully", success: true });
  } catch (err) {
    console.error("Error deleting order:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const { error } = await updateStatusService(id, status);
    if (error) {
      console.error("Error updating order status:", error);
      return res.status(400).json({ success: false, message: error });
    }
    res
      .status(200)
      .json({ success: true, message: "Order status updated successfully" });
  } catch (err) {
    console.error("Error updating order status:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
const updatePrice = async (req, res) => {
  const { id } = req.params;
  const { price } = req.body;

  // Validate price
  if (isNaN(price) || price < 0) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid price value" });
  }

  try {
    const { response, error } = await updatePriceService(id, price);
    if (error) {
      console.error("Error updating order price:", error);
      return res.status(400).json({ success: false, message: error });
    }
    res.status(200).json(response);
  } catch (err) {
    console.error("Error updating order price:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updatePriceAndStatus = async (req, res) => {
  const { id } = req.params;
  const { status, price } = req.body;

  // Validate inputs
  if (!status || isNaN(price) || price < 0) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid status or price value" });
  }

  try {
    const { error } = await updateOrderPriceAndStatusService(id, status, price);
    if (error) {
      console.error("Error updating order price and status:", error);
      return res.status(400).json({ success: false, message: error });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error updating order price and status:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const orderDelivered = async (req, res) => {
  const { orderId } = req.params;
  const { staffId } = req.body;

  // Validate inputs
  if (!orderId || !staffId) {
    return res
      .status(400)
      .json({ success: false, message: "Order ID and Staff ID are required" });
  }

  try {
    const { error } = await orderDeliveredService(orderId, staffId);
    if (error) {
      console.error("Error marking order as delivered:", error);
      return res.status(400).json({ success: false, message: error });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error marking order as delivered:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const reviewOrder = async (req, res) => {
  const { id } = req.params;
  const { comment, rating } = req.body;

  // Validate inputs
  if (!id || !comment || rating == null) {
    return res.status(400).json({
      success: false,
      message: "Order ID, comment, and rating are required",
    });
  }

  const parsedRating = parseInt(rating);
  // Check if rating is a valid number between 1 and 5
  if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    return res.status(400).json({
      success: false,
      message: "Rating must be a number between 1 and 5",
    });
  }

  const review = {
    comment,
    rating: parsedRating,
    status: true,
  };

  try {
    const { error } = await reviewOrderService(id, review);
    if (error) {
      console.error("Error reviewing order:", error);
      return res.status(400).json({ success: false, message: error });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error reviewing order:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const confirmOrder = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await confirmOrderService(id);
    if (error) {
      console.error("Error confirming order service:", error);
      return res.status(400).json({ success: false, error });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error confirming order:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
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

  confirmOrder,
};
