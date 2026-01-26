const MenuItem = require("../models/MenuItem");
const Category = require("../models/Category");
const createMenuItemService = require("../services/menuItemsServices/createMenuItemService");
const getItemsNamesService = require("../services/menuItemsServices/getItemsNamesService");
const updateMenuItemService = require("../services/menuItemsServices/updateMenuItemService");
const getMenuItemsService = require("../services/menuItemsServices/getMenuItemsService");
const {
  getMenuItemService,
} = require("../services/menuItemsServices/getMenuItemService");
const deleteMenuItemService = require("../services/menuItemsServices/deleteMenuItemService");
const updateMenuItemAvailabilityService = require("../services/menuItemsServices/updateMenuItemAvailabilityService");
const getNewItemsService = require("../services/menuItemsServices/getNewItemsService");
const triMenutItemsService = require("../services/menuItemsServices/triMenuItemsService");

const createMenuItem = async (req, res) => {
  let firebaseUrl = req.file ? req.file.firebaseUrl : null; // Set firebaseUrl if a file is uploaded

  const {
    name,
    description,
    prices,

    category,
    customizationGroup,
  } = req.body;

  try {
    const pricesArray = JSON.parse(prices); // Parse the prices from the request body
    // Parse customization options

    // Filter and format prices
    const newPrices = pricesArray
      .filter((item) => item.price !== "0") // Keep only items with price not equal to "0"
      .map((item) => ({
        size: item.size,
        price: parseFloat(item.price),
      }));

    const { error, response } = await createMenuItemService(
      name,
      firebaseUrl,
      newPrices,
      description,

      category,
      customizationGroup
    );

    if (error) {
      return res.status(400).json({
        success: false,
        message: error, // Return error message if creation fails
      });
    }

    return res.status(201).json(response); // Return the created menu item
  } catch (err) {
    console.error("Error creating menu item:", err); // Log the error
    return res.status(500).json({
      success: false,
      message: err.message, // Return error message
    });
  }
};

const getItemsNames = async (req, res) => {
  try {
    const { error, response } = await getItemsNamesService();

    if (error) {
      return res.status(400).json({ success: false, message: error }); // Return error message if the service fails
    }

    return res.status(200).json(response); // Return the list of item names and prices
  } catch (err) {
    console.error("Error fetching item names:", err); // Log the error for debugging
    return res.status(500).json({ success: false, message: err.message }); // Return internal server error
  }
};

const updateMenuItem = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    prices,
    description,
    category,
    customization,
    customizationGroup,
  } = req.body;

  // Initialize firebaseUrl if a file is uploaded
  const firebaseUrl = req.file ? req.file.firebaseUrl : null;

  try {
    // Parse prices and filter out items with a price of 0
    const pricesArray = JSON.parse(prices);
    const newPrices = pricesArray
      .filter((item) => item.price !== "0")
      .map((item) => ({ size: item.size, price: parseFloat(item.price) }));

    // Parse customization array
    const customizationArray = JSON.parse(customization).map((custo) => ({
      _id: custo._id,
    }));

    const { error, response } = await updateMenuItemService(
      id,
      name,
      firebaseUrl,
      newPrices,
      description,
      category,
      customizationArray,
      customizationGroup
    );

    if (error) {
      console.error("Error updating menu item:", error);
      return res.status(400).json({ success: false, message: error });
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error("Error updating menu item 500:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getMenuItems = async (req, res) => {
  try {
    const { error, response } = await getMenuItemsService();
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    return res.status(200).json(response);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
const getMenuItem = async (req, res) => {
  const { id } = req.params;

  try {
    const { error, response } = await getMenuItemService(id);

    if (error) {
      console.error("Error fetching menu item:", error);
      return res.status(400).json({ success: false, message: error });
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error("Error fetching menu item 500:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const deleteMenuItem = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await deleteMenuItemService(id);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    return res
      .status(200)
      .json({ success: true, message: "Item deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getMenuItemsByCategory = async (req, res) => {
  const { categoryId } = req.params;

  try {
    const response = await MenuItem.find({ category: categoryId })
      .select("name prices image is_available") // Specify the fields you want to return
      .populate("category"); // Ensure you populate any relevant fields if needed

    // Check if any menu items were found
    if (!response.length) {
      return res.status(404).json({
        success: false,
        message: "No menu items found for this category.",
      });
    }

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateMenuItemAvailability = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const { error, response } = await updateMenuItemAvailabilityService(
      id,
      status
    );
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    res.json(response);
  } catch (err) {
    res.json({ message: err.message, status: false });
  }
};
const getNewItems = async (req, res) => {
  try {
    const { error, response } = await getNewItemsService();

    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    // Successful response with the new items
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
const triMenutItems = async (req, res) => {
  const { list } = req.body;

  try {
    const { error } = await triMenutItemsService(list);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    res.status(200).json({ success: true, message: "Success" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createSlug = async (req, res) => {
  try {
    const menuItems = await MenuItem.find();
    if (!menuItems || menuItems.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No menu items found" });
    }
    const updatedMenuItems = await Promise.all(
      menuItems.map(async (item) => {
        const slug = item.name.toLowerCase().replace(/\s+/g, "-");
        return await MenuItem.findByIdAndUpdate(
          item._id,
          { slug },
          { new: true }
        );
      })
    );
    res.status(200).json(updatedMenuItems);
  } catch (error) {
    console.error("Error creating slugs for menu items:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMenuItemBySlug = async (req, res) => {
  const { slug } = req.params;

  try {
    const menuItem = await MenuItem.findOne({ slug })
      .populate({
        path: "customization",
        populate: {
          path: "category",
        },
      })
      .populate("category")
      .populate({
        path: "customization_group",
        populate: { path: "toppings" },
      });
    console.log(menuItem);
    if (!menuItem) {
      return res
        .status(404)
        .json({ success: false, message: "Menu item not found" });
    }
    res.status(200).json(menuItem);
  } catch (error) {
    console.error("Error fetching menu item by slug:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMenuItemsByCategorySlug = async (req, res) => {
  try {
    const { categorySlug } = req.params;

    // Find the category by slug
    const category = await Category.findOne({ slug: categorySlug });
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }
    // Find menu items that belong to the category
    const menuItems = await MenuItem.find({ category: category._id }).populate(
      "category"
    );

    res.status(200).json(menuItems);
  } catch (error) {
    console.error("Error fetching menu items by category slug:", error);
    res.status(500).json({ success: false, message: error.message });
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
  createSlug,
  getMenuItemBySlug,
  getMenuItemsByCategorySlug,
};
