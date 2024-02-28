const { default: mongoose } = require("mongoose");
const { deleteImagesFromFirebase } = require("../firebase");
const Offer = require("../models/Offer");

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
    const offer = await Offer.findOne({ name });
    if (offer) {
      return res.json({ message: "categorie existe déja" });
    }
    const newOffer = new Offer({
      name,
      image: firebaseUrl,

      expireAt: new Date(expireAt),
      items: itemList,
      customizations: customizationList,
      price: parseFloat(price),
      createdAt: new Date(),
    });
    const response = await newOffer.save();
    const restaurants = await mongoose.models.Restaurant.find().select(
      "offers"
    );
    if (restaurants.length > 0) {
      await Promise.all(
        restaurants.map(async (restaurant) => {
          restaurant.offers.push({ offer: response._id, availability: true });
          await restaurant.save();
        })
      );
    }
    res.status(201).json(response);
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getOffers = async (req, res) => {
  try {
    const data = await Offer.find();
    const response = data.reverse();
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getOffer = async (req, res) => {
  const { id } = req.params;

  try {
    const response = await Offer.findById(id)
      .populate({
        path: "items",
        populate: "item",
      })
      .populate({ path: "customizations", populate: "category" });

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteOffer = async (req, res) => {
  const { id } = req.params;
  try {
    const response = await Offer.findById(id);
    if (!response) {
      return res
        .status(404)
        .json({ success: false, message: "L'Offre n'existe pas" });
    }
    await deleteImagesFromFirebase(response.image);
    await Offer.findByIdAndDelete(id);
    const restaurants = await mongoose.models.Restaurant.find().select(
      "offers"
    ); // Retrieve all restaurants
    if (restaurants.length > 0) {
      await Promise.all(
        restaurants.map(async (restaurant) => {
          // Find and remove the offer from the offers array
          restaurant.offers = restaurant.offers.filter(
            (restaurantOffer) => !restaurantOffer.offer.equals(id)
          );
          await restaurant.save();
        })
      );
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
    const response = await Offer.findByIdAndUpdate(
      id,
      {
        image: firebaseUrl,
        name,
        price: parseFloat(price),
        exprireAt: new Date(exprireAt),
        items: newItems,
        customizations: newCustomizations,
      },
      { new: true }
    )
      .populate({
        path: "items",
        populate: "item",
      })
      .populate("customizations");

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
