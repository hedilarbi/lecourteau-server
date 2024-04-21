const { default: mongoose } = require("mongoose");
const { deleteImagesFromFirebase } = require("../firebase");
const Offer = require("../models/Offer");
const createOfferService = require("../services/offersServices/createOfferService");
const getOffersService = require("../services/offersServices/getOffersService");
const getOfferService = require("../services/offersServices/getOfferService");
const deleteOfferService = require("../services/offersServices/deleteOfferService");
const updateOfferService = require("../services/offersServices/updateOfferService");

const createOffer = async (req, res) => {
  let firebaseUrl = null;
  if (req.file) {
    firebaseUrl = req.file.firebaseUrl;
  }

  const { name, expireAt, items, price, customizations } = req.body;
  const parsedItems = JSON.parse(items);
  const parsedCustomization = JSON.parse(customizations);
  const itemList = parsedItems.map((item) => {
    return { item: item.item._id, quantity: item.quantity, size: item.size };
  });
  const customizationList = parsedCustomization.map((item) => {
    return item._id;
  });
  try {
    const { response, error } = await createOfferService(
      name,
      expireAt,
      itemList,
      price,
      customizationList,
      firebaseUrl
    );
    if (error) {
      return res.status(500).json({ success: false, error });
    }
    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getOffers = async (req, res) => {
  try {
    const { response, error } = await getOffersService();
    if (error) {
      return res.status(500).json({ success: false, error });
    }
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getOffer = async (req, res) => {
  const { id } = req.params;

  try {
    const { response, error } = await getOfferService(id);

    if (error) {
      return res.status(500).json({ success: false, error });
    }
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteOffer = async (req, res) => {
  const { id } = req.params;
  try {
    const { error, response } = await deleteOfferService(id);
    if (error) {
      return res.status(500).json({ success: false, error });
    }

    res.status(200).json({ message: "offer deleted", success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
const updateOffer = async (req, res) => {
  let firebaseUrl = null;
  if (req.file) {
    firebaseUrl = req.file.firebaseUrl;
  }
  const {
    name,

    price,

    exprireAt,
    items,
    customizations,
  } = req.body;

  const { id } = req.params;

  const itemsArray = JSON.parse(items);
  const customizationArray = JSON.parse(customizations);

  const newCustomizations = customizationArray.map((custo) => {
    return { _id: custo._id };
  });
  const newItems = itemsArray.map((custo) => {
    return { item: custo.item._id, size: custo.size, quantity: custo.quantity };
  });
  try {
    const { response, error } = await updateOfferService(
      id,
      name,
      newItems,
      newCustomizations,
      price,
      exprireAt,
      firebaseUrl
    );
    if (error) {
      return res.status(500).json({ success: false, error });
    }

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  createOffer,
  getOffers,
  getOffer,
  deleteOffer,
  updateOffer,
};
