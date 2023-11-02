const { default: mongoose } = require("mongoose");
const Restaurant = require("../models/Restaurant");

const createRestaurant = async (req, res) => {
  const { name, address, location, phoneNumber } = req.body;

  try {
    const menuItems = await mongoose.models.MenuItem.find({}, "_id");
    const toppings = await mongoose.models.Topping.find({}, "_id");
    const offers = await mongoose.models.Offer.find({}, "_id");
    const offersIDs = offers.map((offer) => {
      return { offer: offer._id, availability: true };
    });
    const menuItemsIDs = menuItems.map((menuItem) => {
      return { menuItem: menuItem._id, availability: true };
    });
    const toppingsIDs = toppings.map((topping) => {
      return { topping: topping._id, availability: true };
    });
    const newResturant = new Restaurant({
      name,
      address,
      location,
      menu_items: menuItemsIDs,
      toppings: toppingsIDs,
      offers: offersIDs,
      phone_number: phoneNumber,
    });
    const response = await newResturant.save();

    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getRestaurants = async (req, res) => {
  try {
    const response = await Restaurant.find();

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const getRestaurant = async (req, res) => {
  const { id } = req.params;
  try {
    const response = await Restaurant.findById(id);

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const deleteRestaurant = async (req, res) => {
  const { id } = req.params;
  try {
    const response = await Restaurant.findByIdAndDelete(id);

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const updateRestaurant = async (req, res) => {
  const { id } = req.params;

  try {
    const response = await Restaurant.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getRestaurantItems = async (req, res) => {
  const { id } = req.params;
  try {
    const response = await Restaurant.findById(id)
      .select("menu_items")
      .populate({
        path: "menu_items",
        populate: { path: "menuItem", populate: "category" },
      });

    res.status(200).json(response);
  } catch (error) {
    res.json({ message: error.message });
  }
};

const getRestaurantMenuItem = async (req, res) => {
  const { restaurantId, id } = req.params;

  try {
    const restaurant = await Restaurant.findById(restaurantId)
      .select("menu_items")
      .populate({
        path: "menu_items",
        populate: {
          path: "menuItem",
          populate: { path: "customization", populate: "category" },
        },
      });

    const response = restaurant.menu_items.filter(
      (item) => item.menuItem._id == id
    );

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getRestaurantToppings = async (req, res) => {
  const { id } = req.params;
  try {
    const response = await Restaurant.findById(id)
      .select("toppings")
      .populate({
        path: "toppings",
        populate: { path: "topping", populate: "category" },
      });

    res.status(200).json(response);
  } catch (error) {
    res.json({ message: error.message });
  }
};
const getRestaurantOffers = async (req, res) => {
  const { id } = req.params;
  try {
    const response = await Restaurant.findById(id)
      .select("offers")
      .populate({ path: "offers", populate: "offer" });

    res.status(200).json(response);
  } catch (error) {
    res.json({ message: error.message });
  }
};
const getRestaurantOrders = async (req, res) => {
  const { id } = req.params;
  try {
    const response = await Restaurant.findById(id)
      .select("orders")
      .populate("orders");

    res.status(200).json(response);
  } catch (error) {
    res.json({ message: error.message });
  }
};

const updateRestaurantItemAvailability = async (req, res) => {
  const { id, itemId } = req.params;

  try {
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const menuItemIndex = restaurant.menu_items.findIndex(
      (item) => item._id == itemId
    );

    if (menuItemIndex === -1) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    restaurant.menu_items[menuItemIndex].availability =
      !restaurant.menu_items[menuItemIndex].availability;

    const updatedRestaurant = await restaurant.save();
    res.status(200).json({ status: true, message: "updated" });
  } catch (error) {
    res.json({ message: error.message });
  }
};
const updateRestaurantOfferAvailability = async (req, res) => {
  const { id, offerId } = req.params;

  try {
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const menuItemIndex = restaurant.offers.findIndex(
      (offer) => offer._id == offerId
    );

    if (menuItemIndex === -1) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    restaurant.offers[menuItemIndex].availability =
      !restaurant.offers[menuItemIndex].availability;

    const updatedRestaurant = await restaurant.save();
    res.status(200).json({ status: true, message: "updated" });
  } catch (error) {
    res.json({ message: error.message });
  }
};
const updateRestaurantToppingAvailability = async (req, res) => {
  const { id, toppingId } = req.params;

  try {
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const menuItemIndex = restaurant.toppings.findIndex(
      (topping) => topping._id == toppingId
    );

    if (menuItemIndex === -1) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    restaurant.toppings[menuItemIndex].availability =
      !restaurant.toppings[menuItemIndex].availability;

    const updatedRestaurant = await restaurant.save();
    res.status(200).json({ status: true, message: "updated" });
  } catch (error) {
    res.json({ message: error.message });
  }
};
module.exports = {
  createRestaurant,
  getRestaurants,
  getRestaurant,
  deleteRestaurant,
  updateRestaurant,
  getRestaurantItems,
  getRestaurantToppings,
  getRestaurantOffers,
  getRestaurantOrders,
  updateRestaurantItemAvailability,
  updateRestaurantOfferAvailability,
  updateRestaurantToppingAvailability,
  getRestaurantMenuItem,
};
