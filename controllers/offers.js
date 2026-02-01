const createOfferService = require("../services/offersServices/createOfferService");
const getOffersService = require("../services/offersServices/getOffersService");
const getOfferService = require("../services/offersServices/getOfferService");
const deleteOfferService = require("../services/offersServices/deleteOfferService");
const updateOfferService = require("../services/offersServices/updateOfferService");
const Offer = require("../models/Offer");
const logWithTimestamp = (message) => {
  const timeStamp = new Date().toISOString();
  console.error(`${timeStamp} - ${message}`);
};
const createOffer = async (req, res) => {
  let firebaseUrl = null;
  if (req.file) {
    firebaseUrl = req.file.firebaseUrl;
  }

  try {
    const { name, expireAt, items, price } = req.body;

    if (!name || !expireAt || !items || !price) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid input data" });
    }

    const parsedItems = JSON.parse(items);

    const itemList = parsedItems.map((item) => ({
      item: item.item._id,
      quantity: item.quantity,
      size: item.size,
    }));

    const { response, error } = await createOfferService(
      name,
      expireAt,
      itemList,
      price,

      firebaseUrl
    );

    if (error) {
      console.error("error creating offer service", error);
      return res.status(500).json({ success: false, error });
    }
    res.status(201).json({ success: true, data: response });
  } catch (err) {
    console.error("Error creating offer controller:", err);
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

  const { name, price, expireAt, items } = req.body;
  const { id } = req.params;

  try {
    const itemsArray = JSON.parse(items);

    const newItems = itemsArray.map((item) => ({
      item: item.item._id,
      size: item.size,
      quantity: item.quantity,
    }));
    const { response, error } = await updateOfferService(
      id,
      name,
      newItems,

      price,
      expireAt,
      firebaseUrl
    );

    if (error) {
      logWithTimestamp(`Error updating offer service: ${error}`);
      return res.status(404).json({ success: false, message: error });
    }

    res.status(200).json(response);
  } catch (err) {
    logWithTimestamp(`Error updating offer service: ${err}`);

    res.status(500).json({ success: false, message: err.message });
  }
};

const createSlugs = async (req, res) => {
  try {
    const offers = await Offer.find();
    const updatedOffers = await Promise.all(
      offers.map(async (offer) => {
        const slug = offer.name.toLowerCase().replace(/\s+/g, "-");
        return await Offer.findByIdAndUpdate(
          offer._id,
          { slug },
          { new: true }
        );
      })
    );
    res.status(200).json(updatedOffers);
  } catch (err) {
    console.error("Error creating slugs:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
const getOfferBySlug = async (req, res) => {
  const { slug } = req.params;

  try {
    const offer = await Offer.findOne({ slug }).populate({
      path: "items",
      populate: {
        path: "item",
        populate: [
          { path: "customization", populate: "category" },
          { path: "customization_group", populate: { path: "toppings" } },
        ],
      },
    });
    if (!offer) {
      return res
        .status(404)
        .json({ success: false, message: "Offer not found" });
    }
    res.status(200).json(offer);
  } catch (error) {
    console.error("Error fetching offer by slug:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createOffer,
  getOffers,
  getOffer,
  deleteOffer,
  updateOffer,
  createSlugs,
  getOfferBySlug,
};
