const Table = require("../models/Table");
const addItemToTableBasketService = require("../services/tablesServices.js/addItemToTableBasketService");
const clearTableBasketService = require("../services/tablesServices.js/clearTableBasketService");
const {
  createTableService,
} = require("../services/tablesServices.js/createTableService");
const getTableBasketService = require("../services/tablesServices.js/getTableBasketService");
const getTableService = require("../services/tablesServices.js/getTableService");
const getTablesService = require("../services/tablesServices.js/getTablesService");
const removeItemFromTableBasketService = require("../services/tablesServices.js/removeItemFromTableBasketService");
const updateItemInTableBasketService = require("../services/tablesServices.js/updateItemInTableBasketService");

const createTable = async (req, res) => {
  const { number, restaurant } = req.body;
  try {
    const { response, error } = await createTableService({
      number,
      restaurant,
    });
    if (error) {
      return res.status(400).json({ message: error });
    }
    res.status(200).json(response);
  } catch (err) {
    res.json({ message: err.message });
  }
};

const getTables = async (req, res) => {
  try {
    const { response, error } = await getTablesService();
    if (error) {
      return res.status(400).json({ message: error });
    }
    res.status(200).json(response);
  } catch (err) {
    res.json({ message: err.message });
  }
};

const getTable = async (req, res) => {
  const { number } = req.params;
  try {
    const { response, error } = await getTableService(number);
    if (error) {
      return res.status(400).json({ message: error });
    }
    res.status(200).json(response);
  } catch (err) {
    res.json({ message: err.message });
  }
};

const addItemToTableBasket = async (req, res) => {
  const { number } = req.params;
  const { item } = req.body;
  try {
    const { response, error } = await addItemToTableBasketService(number, item);
    if (error) {
      return res.status(400).json({ message: error });
    }
    res.status(200).json(response);
  } catch (err) {
    res.json({ message: err.message });
  }
};

const removeItemFromTableBasket = async (req, res) => {
  const { number } = req.params;
  const { uid } = req.body;
  try {
    const { response, error } = await removeItemFromTableBasketService(
      number,
      uid
    );
    if (error) {
      return res.status(400).json({ message: error });
    }
    res.status(200).json(response);
  } catch (err) {
    res.json({ message: err.message });
  }
};

const updateItemInTableBasket = async (req, res) => {
  const { number } = req.params;
  const { item } = req.body;
  try {
    const { response, error } = await updateItemInTableBasketService(
      number,
      item
    );
    if (error) {
      return res.status(400).json({ message: error });
    }
    res.status(200).json(response);
  } catch (err) {
    res.json({ message: err.message });
  }
};

const clearTableBasket = async (req, res) => {
  const { number } = req.params;
  try {
    const { response, error } = await clearTableBasketService(number);
    if (error) {
      return res.status(400).json({ message: error });
    }
    res.status(200).json(response);
  } catch (err) {
    res.json({ message: err.message });
  }
};

const getTableBasket = async (req, res) => {
  const { number } = req.params;
  try {
    const { response, error } = await getTableBasketService(number);
    if (error) {
      return res.status(400).json({ message: error });
    }
    res.status(200).json(response);
  } catch (err) {
    res.json({ message: err.message });
  }
};

const deleteTable = async (req, res) => {
  try {
    const { number } = req.params;
    await Table.findOneAndDelete({ number });
    res.status(200).json({ message: "Table deleted successfully" });
  } catch (err) {
    res.json({ message: err.message });
  }
};

module.exports = {
  createTable,
  getTables,
  getTable,
  addItemToTableBasket,
  removeItemFromTableBasket,
  updateItemInTableBasket,
  clearTableBasket,
  getTableBasket,
  deleteTable,
};
