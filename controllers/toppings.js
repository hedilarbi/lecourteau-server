const { default: mongoose } = require("mongoose");
const { deleteImagesFromFirebase } = require("../firebase");
const Topping = require("../models/Topping");
const {
  getToppingService,
} = require("../services/toppingsServices/getToppingService");
const {
  updateToppingService,
} = require("../services/toppingsServices/updateToppingService");
const {
  getToppingsService,
} = require("../services/toppingsServices/getToppingsService");
const {
  deleteToppingService,
} = require("../services/toppingsServices/deleteToppingService");
const {
  createToppingService,
} = require("../services/toppingsServices/createToppingService");

const createTopping = async (req, res) => {
  let firebaseUrl = null;
  if (req.file) {
    firebaseUrl = req.file.firebaseUrl;
  }
  const { name, category, price } = req.body;
  try {
    const { error, response } = await createToppingService(
      name,
      price,
      category,
      firebaseUrl
    );

    if (error) {
      return res.status(400).json({ message: error });
    }
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getToppings = async (req, res) => {
  try {
    const { response } = await getToppingsService();
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getTopping = async (req, res) => {
  const { id } = req.params;
  try {
    const { response } = await getToppingService(id);
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateTopping = async (req, res) => {
  let firebaseUrl = null;
  if (req.file) {
    firebaseUrl = req.file.firebaseUrl;
  }
  const { name, category, price } = req.body;
  const { id } = req.params;
  try {
    const { response } = await updateToppingService(
      id,
      name,
      price,
      category,
      firebaseUrl
    );
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteTopping = async (req, res) => {
  const { id } = req.params;

  try {
    const { error, status } = await deleteToppingService(id);
    if (error) {
      return res.status(400).json({ message: error });
    }

    res.status(200).json({ message: "success" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createTopping,
  getToppings,
  deleteTopping,
  updateTopping,
  getTopping,
};
