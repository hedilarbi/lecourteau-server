const createLocalOrderService = require("../services/localOrderServices/createLocalOrderService");
const getLocalOrderService = require("../services/localOrderServices/getLocalOrderService");
const getLocalOrdersService = require("../services/localOrderServices/getLocalOrdersService");

const createLocalOrder = async (req, res) => {
  try {
    const { table } = req.body;
    const { response, error } = await createLocalOrderService(table);
    if (error) {
      console.log(error);
      return res.status(400).json({ error });
    }
    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getLocalOrders = async (req, res) => {
  try {
    const { response, error } = await getLocalOrdersService();
    if (error) {
      return res.status(400).json({ error });
    }
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getLocalOrder = async (req, res) => {
  const { id } = req.params;
  try {
    const { response, error } = await getLocalOrderService(id);
    if (error) {
      return res.status(400).json({ error });
    }
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { createLocalOrder, getLocalOrders, getLocalOrder };
