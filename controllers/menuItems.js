const MenuItem = require("../models/MenuItem");
const createMenuItemService = require("../services/menuItemsServices/createMenuItemService");
const getItemsNamesService = require("../services/menuItemsServices/getItemsNamesService");
const updateMenuItemService = require("../services/menuItemsServices/updateMenuItemService");
const getMenuItemsService = require("../services/menuItemsServices/getMenuItemsService");
const {
  getMenuItemService,
} = require("../services/menuItemsServices/getMenuItemService");
const deleteMenuItemService = require("../services/menuItemsServices/deleteMenuItemService");
const updateMenuItemAvailabilityService = require("../services/menuItemsServices/updateMenuItemAvailabilityService");
const getNewItemsService = require("../services/menuItemsServices/getNewItemsService");
const triMenutItemsService = require("../services/menuItemsServices/triMenuItemsService");

const createMenuItem = async (req, res) => {
  let firebaseUrl = null;
  if (req.file) {
    firebaseUrl = req.file.firebaseUrl;
  }

  const { name, description, prices, customization, category } = req.body;

  try {
    let newPrices = [];
    const pricesArray = JSON.parse(prices);
    const customizationArray = JSON.parse(customization);

    pricesArray.map((item) => {
      if (item.price != "0")
        newPrices.push({ size: item.size, price: parseFloat(item.price) });
    });
    const { error, response } = await createMenuItemService(
      name,
      firebaseUrl,
      newPrices,
      description,
      customizationArray,
      category
    );
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getItemsNames = async (req, res) => {
  try {
    const { error, response } = await getItemsNamesService();
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateMenuItem = async (req, res) => {
  const { name, prices, description, category, customization } = req.body;
  let firebaseUrl = null;
  if (req.file) {
    firebaseUrl = req.file.firebaseUrl;
  }

  const { id } = req.params;

  try {
    let newPrices = [];
    const pricesArray = JSON.parse(prices);
    const customizationArray = JSON.parse(customization);

    pricesArray.map((item) => {
      if (item.price != "0")
        newPrices.push({ size: item.size, price: parseFloat(item.price) });
    });

    const newCustomization = customizationArray.map((custo) => {
      return { _id: custo._id };
    });
    const { error, response } = await updateMenuItemService(
      id,
      name,
      firebaseUrl,
      newPrices,
      description,
      category,
      newCustomization
    );
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getMenuItems = async (req, res) => {
  try {
    const { error, response } = await getMenuItemsService();
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getMenuItem = async (req, res) => {
  const { id } = req.params;

  try {
    const { error, response } = await getMenuItemService(id);
    if (error) {
      return res.status(400).json(error);
    }
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteMenuItem = async (req, res) => {
  const { id } = req.params;

  try {
    const { error, response } = await deleteMenuItemService(id);
    if (error) {
      return res.status(400).json(error);
    }
    res.status(200).json({ success: true, message: "item deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getMenuItemsByCategory = async (req, res) => {
  const { category } = req.params;
  try {
    const response = await MenuItem.find({ category }).populate();
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateMenuItemAvailability = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const { error, response } = await updateMenuItemAvailabilityService(
      id,
      status
    );
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    res.json(response);
  } catch (err) {
    res.json({ message: err.message, status: false });
  }
};
const getNewItems = async (req, res) => {
  try {
    const { error, response } = await getNewItemsService();
    if (error) {
      return res.status(400).json({ status: false, message: error });
    }
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};
const triMenutItems = async (req, res) => {
  const { list } = req.body;

  try {
    const { error } = await triMenutItemsService(list);
    if (error) {
      return res.status(400).json({ status: false, message: error });
    }
    res.status(200).json({ message: "success" });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

module.exports = {
  createMenuItem,
  updateMenuItem,
  getMenuItem,
  getMenuItems,
  deleteMenuItem,
  getMenuItemsByCategory,
  getItemsNames,
  updateMenuItemAvailability,
  getNewItems,
  triMenutItems,
};
