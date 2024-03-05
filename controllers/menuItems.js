const { default: mongoose } = require("mongoose");
const { deleteImagesFromFirebase } = require("../firebase");
const MenuItem = require("../models/MenuItem");

const createMenuItem = async (req, res) => {
  let firebaseUrl = null;
  if (req.file) {
    firebaseUrl = req.file.firebaseUrl;
  }

  const { name, description, prices, customization, category } = req.body;

  let newPrices = [];
  const pricesArray = JSON.parse(prices);
  const customizationArray = JSON.parse(customization);

  pricesArray.map((item) => {
    if (item.price != "0")
      newPrices.push({ size: item.size, price: parseFloat(item.price) });
  });

  try {
    const newMenuItem = new MenuItem({
      name,
      image: firebaseUrl,
      prices: newPrices,
      description,
      customization: customizationArray,
      category,
    });
    const response = await newMenuItem.save();
    const restaurants = await mongoose.models.Restaurant.find().select(
      "menu_items"
    );
    if (restaurants.length > 0) {
      await Promise.all(
        restaurants.map(async (restaurant) => {
          restaurant.menu_items.push({
            menuItem: response._id,
            availability: true,
          });
          await restaurant.save();
        })
      );
    }
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getItemsNames = async (req, res) => {
  try {
    const response = await MenuItem.find().select("name");
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateMenuItem = async (req, res) => {
  const {
    name,

    prices,
    description,

    category,
    customization,
  } = req.body;
  let firebaseUrl = null;
  if (req.file) {
    firebaseUrl = req.file.firebaseUrl;
  }
  const { id } = req.params;

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
  try {
    let response;
    if (firebaseUrl) {
      response = await MenuItem.findByIdAndUpdate(
        id,
        {
          name,
          image: firebaseUrl,
          prices: newPrices,
          description,
          category,
          customization: newCustomization,
        },
        { new: true }
      ).populate("customization category");
    } else {
      response = await MenuItem.findByIdAndUpdate(
        id,
        {
          name,
          prices: newPrices,
          description,
          category,
          customization: newCustomization,
        },
        { new: true }
      ).populate("customization category");
    }

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getMenuItems = async (req, res) => {
  try {
    let response = await MenuItem.find()
      .select("category name image prices is_available order")
      .populate({
        path: "category",
        select: "name",
      });
    response.sort((a, b) => a.order - b.order);
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getMenuItem = async (req, res) => {
  const { id } = req.params;

  try {
    const response = await MenuItem.findById(id)

      .populate({
        path: "customization",
        populate: {
          path: "category",
        },
      })
      .populate("category");

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteMenuItem = async (req, res) => {
  const { id } = req.params;

  try {
    const response = await MenuItem.findById(id);
    if (!response) {
      return res
        .status(404)
        .json({ success: false, message: "Article n'existe pas" });
    }
    await deleteImagesFromFirebase(response.image);
    await MenuItem.findByIdAndDelete(id);
    const restaurants = await mongoose.models.Restaurant.find().select(
      "menu_items"
    );
    if (restaurants.length > 0) {
      await Promise.all(
        restaurants.map(async (restaurant) => {
          restaurant.menu_items = restaurant.menu_items.filter(
            (restaurantOffer) => !restaurantOffer.menuItem.equals(id)
          );
          await restaurant.save();
        })
      );
    }
    res.status(200).json({ success: true, message: "item deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
    const response = await MenuItem.findByIdAndUpdate(
      id,
      { is_available: status },
      { new: true }
    );
    res.json(response);
  } catch (err) {
    res.json({ message: err.message, status: false });
  }
};
const getNewItems = async (req, res) => {
  try {
    const response = await MenuItem.find()
      .sort({ _id: -1 })
      .limit(3)
      .select("name image");
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};
const triMenutItems = async (req, res) => {
  const { from, to } = req.body;

  try {
    let menuitems = await MenuItem.find();

    const indexFrom = menuitems.findIndex((item) => item.order === from);
    const indexTo = menuitems.findIndex((item) => item.order === to);

    if (indexFrom !== -1 && indexTo !== -1) {
      menuitems[indexFrom].order = to;
      menuitems[indexTo].order = from;

      console.log("from:", menuitems[indexFrom]);
      await Promise.all([
        menuitems[indexFrom].save(),
        menuitems[indexTo].save(),
      ]);
    } else {
      return res
        .status(400)
        .json({ status: false, message: "Invalid 'from' or 'to' values" });
    }

    res.status(200).json({ message: "success" });
  } catch (err) {
    console.log(err.message);
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
