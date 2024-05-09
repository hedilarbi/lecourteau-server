const Table = require("../models/Table");
const addItemToTableBasketService = require("../services/tablesServices.js/addItemToTableBasketService");
const clearTableBasketService = require("../services/tablesServices.js/clearTableBasketService");
const {
  createTableService,
} = require("../services/tablesServices.js/createTableService");
const getItemFromBasketService = require("../services/tablesServices.js/getItemFromBasketService");
const getTableBasketService = require("../services/tablesServices.js/getTableBasketService");
const getTableService = require("../services/tablesServices.js/getTableService");
const getTablesService = require("../services/tablesServices.js/getTablesService");
const removeItemWithIDFromTableBasketService = require("../services/tablesServices.js/removeItemWithIDFromTableBasketService");
const removeItemFromTableBasketService = require("../services/tablesServices.js/removeItemWithIDFromTableBasketService");
const removeItemWithUIDFromTableBasketService = require("../services/tablesServices.js/removeItemWithUIDFromTableBasketService");
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

const removeItemWithIDFromTableBasket = async (req, res) => {
  const { number } = req.params;
  const { id } = req.body;

  try {
    const { response, error } = await removeItemWithIDFromTableBasketService(
      number,
      id
    );
    if (error) {
      return res.status(400).json({ message: error });
    }

    res.status(200).json(response);
  } catch (err) {
    res.json({ message: err.message });
  }
};
const removeItemWithUIDFromTableBasket = async (req, res) => {
  const { number } = req.params;
  const { uid } = req.body;
  try {
    const { response, error } = await removeItemWithUIDFromTableBasketService(
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

const getItemFromBasket = async (req, res) => {
  const { number, uid } = req.params;

  try {
    const { response, error } = await getItemFromBasketService(number, uid);
    if (error) {
      return res.status(400).json({ message: error });
    }
    res.status(200).json(response);
  } catch (err) {
    res.json({ message: err.message });
  }
};

module.exports = {
  createTable,
  getTables,
  getTable,
  addItemToTableBasket,
  removeItemWithIDFromTableBasket,
  updateItemInTableBasket,
  clearTableBasket,
  getTableBasket,
  removeItemWithUIDFromTableBasket,
  deleteTable,
  getItemFromBasket,
};
