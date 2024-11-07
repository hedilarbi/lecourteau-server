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

  try {
    const { name, expireAt, items, price, customizations } = req.body;

    if (!name || !expireAt || !items || !price || !customizations) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid input data" });
    }

    const parsedItems = JSON.parse(items);
    const parsedCustomization = JSON.parse(customizations);

    const itemList = parsedItems.map((item) => ({
      item: item.item._id,
      quantity: item.quantity,
      size: item.size,
    }));

    const customizationList = parsedCustomization.map((item) => item._id);

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
    res.status(201).json({ success: true, data: response });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
      return res.status(404).json({ success: false, message: error });
    }

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteOffer = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await deleteOfferService(id);
    if (error) {
      return res.status(404).json({ success: false, message: error });
    }

    res
      .status(200)
      .json({ message: "Offer deleted successfully", success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
const updateOffer = async (req, res) => {
  let firebaseUrl = null;
  if (req.file) {
    firebaseUrl = req.file.firebaseUrl;
  }

  const { name, price, expireAt, items, customizations } = req.body;
  const { id } = req.params;

  try {
    const itemsArray = JSON.parse(items);
    const customizationArray = JSON.parse(customizations);

    const newCustomizations = customizationArray.map((custo) => ({
      _id: custo._id,
    }));
    const newItems = itemsArray.map((item) => ({
      item: item.item._id,
      size: item.size,
      quantity: item.quantity,
    }));
    const { response, error } = await updateOfferService(
      id,
      name,
      newItems,
      newCustomizations,
      price,
      expireAt,
      firebaseUrl
    );

    if (error) {
      console.error("error updating offer", error);
      return res.status(404).json({ success: false, message: error });
    }

    res.status(200).json(response);
  } catch (err) {
    console.error("Error updating offer:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createOffer,
  getOffers,
  getOffer,
  deleteOffer,
  updateOffer,
};
