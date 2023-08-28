const MenuItem = require("../models/MenuItem");

const createMenuItem = async (req, res) => {
  const {
    name,
    description,
    prices,

    customization,
    category,
  } = req.body;
  let newPrices = [];
  prices.map((item) => {
    if (item.price != "0")
      newPrices.push({ size: item.size, price: parseFloat(item.price) });
  });
  try {
    const newMenuItem = new MenuItem({
      name,
      image:
        "https://lecourteau.com/wp-content/uploads/2021/11/WingsAlone-scaled-aspect-ratio-264-257-scaled.jpg",
      prices: newPrices,
      description,
      customization,
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
    console.log(response);
    res.status(200).json(response);
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getMenuItems = async (req, res) => {
  try {
    const response = await MenuItem.find()
      .select("category name image prices")
      .populate({
        path: "category",
        select: "name",
      });
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

module.exports = {
  createMenuItem,
  updateMenuItem,
  getMenuItem,
  getMenuItems,
  deleteMenuItem,
  getMenuItemsByCategory,
  getItemsNames,
};
