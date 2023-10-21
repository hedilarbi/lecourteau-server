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
    image,
    prices,
    description,

    category,
    customization,
  } = req.body;
  const { id } = req.params;
  const newPrices = prices.map((price) => {
    return { size: price.size, price: parseFloat(price.price) };
  });
  const newCategory = category.value;
  const newCustomization = customization.map((custo) => {
    return { _id: custo._id };
  });
  try {
    const response = await MenuItem.findByIdAndUpdate(
      id,
      {
        name,
        image,
        prices: newPrices,
        description,
        category: newCategory,
        customization: newCustomization,
      },
      { new: true }
    ).populate("customization");

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getMenuItems = async (req, res) => {
  try {
    let response = await MenuItem.find()
      .select("category name image prices is_available")
      .populate({
        path: "category",
        select: "name",
      });
    response = response.reverse();
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
    await MenuItem.findByIdAndDelete(id);
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

module.exports = {
  createMenuItem,
  updateMenuItem,
  getMenuItem,
  getMenuItems,
  deleteMenuItem,
  getMenuItemsByCategory,
  getItemsNames,
  updateMenuItemAvailability,
};
