const e = require("cors");
const Restaurant = require("../models/Restaurant");
const {
  createRestaurantService,
} = require("../services/restaurantsServices/createRestaurantService");
const {
  deleteRestaurantService,
} = require("../services/restaurantsServices/deleteRestaurantService");
const {
  getRestaurantService,
} = require("../services/restaurantsServices/getRestaurantService");
const {
  getRestaurantsService,
} = require("../services/restaurantsServices/getRestaurantsService");
const {
  getRestaurantItemsService,
} = require("../services/restaurantsServices/getRestaurantItemsService");
const {
  getRestaurantMenuItemService,
} = require("../services/restaurantsServices/getRestaurantMenuItemService");
const {
  getRestaurantToppingsService,
} = require("../services/restaurantsServices/getRestaurantToppingsService");
const {
  getRestaurantOffersService,
} = require("../services/restaurantsServices/getRestaurantOffersService");
const {
  getRestaurantOrdersService,
} = require("../services/restaurantsServices/getRestaurantOrdersService");
const {
  updateRestaurantItemAvailabilityService,
} = require("../services/restaurantsServices/updateRestaurantItemAvailabilityService");
const {
  updateRestaurantToppingAvailabilityService,
} = require("../services/restaurantsServices/updateRestaurantToppingAvailabilityService");
const {
  updateRestaurantOfferAvailabilityService,
} = require("../services/restaurantsServices/updateRestaurantOfferAvailabilityService");
const {
  getRestaurantOfferService,
} = require("../services/restaurantsServices/getRestaurantOfferService");

const createRestaurant = async (req, res) => {
  const { name, address, location, phoneNumber } = req.body;

  try {
    const { response, error } = await createRestaurantService(
      name,
      address,
      location,
      phoneNumber
    );

    if (error) {
      return res.status(500).json({ success: false, message: error });
    }

    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating restaurant:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while creating the restaurant.",
    });
  }
};

const getRestaurants = async (req, res) => {
  try {
    const { error, response } = await getRestaurantsService();

    if (error) {
      console.error("Error fetching restaurants:", error); // Log the error
      return res.status(500).json({ success: false, message: error });
    }

    // If no restaurants found, you can choose to return a different status
    if (response.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No restaurants found." });
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Error in getRestaurants:", error); // Log the error
    res
      .status(500)
      .json({ success: false, message: "An unexpected error occurred." });
  }
};
const getRestaurant = async (req, res) => {
  const { id } = req.params;
  try {
    const { response, error } = await getRestaurantService(id);

    if (error) {
      console.error("Error fetching restaurant:", error);
      return res.status(404).json({ success: false, message: error });
    }

    if (!response) {
      return res
        .status(404)
        .json({ success: false, message: "Restaurant not found." });
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Error in getRestaurant:", error);
    res
      .status(500)
      .json({ success: false, message: "An unexpected error occurred." });
  }
};

const deleteRestaurant = async (req, res) => {
  const { id } = req.params;
  try {
    const { error, response } = await deleteRestaurantService(id);

    // Handle error from service
    if (error) {
      console.error("Error deleting restaurant:", error);
      return res.status(500).json({ success: false, message: error });
    }

    // Check if the restaurant was deleted
    if (!response) {
      return res
        .status(404)
        .json({ success: false, message: "Restaurant not found." });
    }

    res
      .status(200)
      .json({ success: true, message: "Restaurant deleted successfully." });
  } catch (error) {
    console.error("Error in deleteRestaurant:", error);
    res
      .status(500)
      .json({ success: false, message: "An unexpected error occurred." });
  }
};
const updateRestaurant = async (req, res) => {
  const { id } = req.params;

  try {
    // Attempt to find and update the restaurant
    const response = await Restaurant.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true, // Ensures validation is run on update
    });

    // Check if the restaurant was found and updated
    if (!response) {
      return res
        .status(404)
        .json({ success: false, message: "Restaurant not found." });
    }

    // Respond with the updated restaurant
    res.status(200).json(response);
  } catch (error) {
    console.error("Error updating restaurant:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getRestaurantItems = async (req, res) => {
  const { id } = req.params;

  try {
    const { error, response } = await getRestaurantItemsService(id);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Check if response is empty or null
    if (!response || response.menu_items.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No menu items found for this restaurant.",
      });
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching restaurant items:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getRestaurantMenuItem = async (req, res) => {
  const { restaurantId, id } = req.params;

  try {
    const { error, response } = await getRestaurantMenuItemService(
      restaurantId,
      id
    );

    if (error) {
      console.error("Error fetching restaurant menu item:", error);
      return res.status(500).json({ success: false, message: error.message });
    }

    // Check if the response is empty or null
    if (!response) {
      return res
        .status(404)
        .json({ success: false, message: "Menu item not found." });
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching restaurant menu item:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
const getRestaurantToppings = async (req, res) => {
  const { id } = req.params;

  try {
    const { error, response } = await getRestaurantToppingsService(id);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Check if toppings were found
    if (!response || response.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No toppings found for this restaurant.",
      });
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching restaurant toppings:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
const getRestaurantOffers = async (req, res) => {
  const { id } = req.params;

  try {
    const { error, response } = await getRestaurantOffersService(id);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Check if the restaurant has offers
    if (!response || response.offers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No offers found for this restaurant.",
      });
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching restaurant offers:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
const getRestaurantOrders = async (req, res) => {
  const { id } = req.params;

  try {
    const { response, error } = await getRestaurantOrdersService(id);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Check if the restaurant exists
    if (!response) {
      return res
        .status(404)
        .json({ success: false, message: "Restaurant not found." });
    }

    // Check if there are orders
    if (response.orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No orders found for this restaurant.",
      });
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching restaurant orders:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
const updateRestaurantItemAvailability = async (req, res) => {
  const { id, itemId } = req.params;

  try {
    const { error, status, restaurant } =
      await updateRestaurantItemAvailabilityService(id, itemId);

    if (error) {
      return res.status(500).json({ success: false, message: error });
    }

    res
      .status(200)
      .json({ success: true, message: "Menu item availability updated" });
  } catch (error) {
    console.error("Error updating menu item availability:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateRestaurantOfferAvailability = async (req, res) => {
  const { id, offerId } = req.params;

  try {
    const { error, status } = await updateRestaurantOfferAvailabilityService(
      id,
      offerId
    );

    if (error) {
      return res.status(500).json({ success: false, message: error });
    }

    res
      .status(200)
      .json({ success: true, message: "Offer availability updated" });
  } catch (error) {
    console.error("Error updating offer availability:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateRestaurantToppingAvailability = async (req, res) => {
  const { id, toppingId } = req.params;

  try {
    const { error, status } = await updateRestaurantToppingAvailabilityService(
      id,
      toppingId
    );

    if (error) {
      return res.status(500).json({ success: false, message: error });
    }

    res
      .status(200)
      .json({ success: true, message: "Topping availability updated" });
  } catch (error) {
    console.error("Error updating topping availability:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getRestaurantOffer = async (req, res) => {
  const { restaurantId, id } = req.params;

  try {
    const { error, response } = await getRestaurantOfferService(
      restaurantId,
      id
    );

    if (error) {
      return res.status(500).json({ success: false, message: error });
    }

    if (!response) {
      return res
        .status(404)
        .json({ success: false, message: "Offer not found" });
    }

    res.status(200).json({ success: true, offer: response });
  } catch (error) {
    console.error("Error fetching restaurant offer:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const setSettings = async (req, res) => {
  try {
    const restaurants = await Restaurant.find();

    if (!restaurants) {
      return res
        .status(404)
        .json({ success: false, message: "No restaurants found." });
    }

    const settings = {
      working_hours: {
        open: {
          hours: "10",
          minutes: "15",
        },
        close: {
          hours: "21",
          minutes: "00",
        },
      },
      delivery: true,
      open: true,
      delivery_fee: 1.49,
    };

    const updatePromises = restaurants.map((restaurant) => {
      restaurant.settings = settings;
      return restaurant.save();
    });

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: "Settings updated for all restaurants.",
    });
  } catch (error) {
    console.error("Error setting settings:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
const getRestaurantsSettings = async (req, res) => {
  try {
    const response = await Restaurant.find().select(
      "settings name location address"
    );

    if (!response) {
      return res
        .status(404)
        .json({ success: false, message: "No restaurants found." });
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Error getting settings:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
const updateRestaurantSettings = async (req, res) => {
  const { id } = req.params;
  const { settings } = req.body;
  try {
    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
      return res
        .status(404)
        .json({ success: false, message: "Restaurant not found." });
    }

    restaurant.settings = settings;
    await restaurant.save();

    res.status(200).json({
      success: true,
      message: "Restaurant settings updated successfully.",
    });
  } catch (error) {
    console.error("Error updating restaurant settings:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getRestaurantsList = async (req, res) => {
  try {
    const restaurants = await Restaurant.find().select("name");

    if (!restaurants) {
      return res
        .status(404)
        .json({ success: false, message: "No restaurants found." });
    }

    res.status(200).json(restaurants);
  } catch (error) {
    console.error("Error fetching restaurants:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getRestaurantSettings = async (req, res) => {
  const { id } = req.params;

  try {
    const response = await Restaurant.findById(id).select(
      "settings name location address"
    );

    if (!response) {
      return res
        .status(404)
        .json({ success: false, message: "No restaurants found." });
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Error getting settings:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateEmploie = async (req, res) => {
  const { emploie } = req.body;
  console.log(emploie);
  try {
    const restaurants = await Restaurant.find();

    const updatePromises = restaurants.map((restaurant) => {
      restaurant.settings.emploie_du_temps = emploie;
      return restaurant.save();
    });
    console.log("updated promise", updatePromises);
    const response = await Promise.all(updatePromises);
    console.log(response.data);
    console.log("Settings updated for all restaurants.");
    res.status(200).json({
      success: true,
      message: "Settings updated for all restaurants.",
    });
  } catch (error) {
    console.error("Error updating restaurant:", error);
    res.status(500).json({ success: false, message: error.message });
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
  getRestaurantOffer,
  setSettings,
  getRestaurantsSettings,
  updateRestaurantSettings,
  getRestaurantsList,
  getRestaurantSettings,
  updateEmploie,
};
