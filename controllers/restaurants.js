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
      res.status(500).json({ success: false, message: error.message });
    }

    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getRestaurants = async (req, res) => {
  try {
    const { error, response } = await getRestaurantsService();

    if (error) {
      res.status(500).json({ success: false, message: error.message });
    }
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const getRestaurant = async (req, res) => {
  const { id } = req.params;
  try {
    const { response } = await getRestaurantService(id);

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const deleteRestaurant = async (req, res) => {
  const { id } = req.params;
  try {
    const { error, response } = await deleteRestaurantService(id);
    if (error) {
      res.status(500).json({ success: false, message: error.message });
    }

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
    const { error, response } = await getRestaurantItemsService(id);
    if (error) {
      res.status(500).json({ message: error.message });
    }
    res.status(200).json(response);
  } catch (error) {
    res.json({ message: error.message });
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
      res.status(500).json({ message: error.message });
    }
    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getRestaurantToppings = async (req, res) => {
  const { id } = req.params;
  try {
    const { error, response } = await getRestaurantToppingsService(id);
    if (error) {
      res.status(500).json({ message: error.message });
    }
    res.status(200).json(response);
  } catch (error) {
    res.json({ message: error.message });
  }
};
const getRestaurantOffers = async (req, res) => {
  const { id } = req.params;
  try {
    const { error, response } = await getRestaurantOffersService(id);
    if (error) {
      res.status(500).json({ message: error.message });
    }
    res.status(200).json(response);
  } catch (error) {
    res.json({ message: error.message });
  }
};
const getRestaurantOrders = async (req, res) => {
  const { id } = req.params;
  try {
    const { response, error } = await getRestaurantOrdersService(id);
    if (error) {
      res.status(500).json({ message: error.message });
    }
    res.status(200).json(response);
  } catch (error) {
    res.json({ message: error.message });
  }
};

const updateRestaurantItemAvailability = async (req, res) => {
  const { id, itemId } = req.params;

  try {
    const { error, response } = await updateRestaurantItemAvailabilityService(
      id,
      itemId
    );
    if (error) {
      res.status(500).json({ message: error.message });
    }

    res
      .status(200)
      .json({ status: true, message: "Menu item availability updated" });
  } catch (error) {
    res.json({ message: error.message });
  }
};
const updateRestaurantOfferAvailability = async (req, res) => {
  const { id, offerId } = req.params;

  try {
    const { error, response } = await updateRestaurantOfferAvailabilityService(
      id,
      offerId
    );
    if (error) {
      res.status(500).json({ message: error.message });
    }
    res.status(200).json({ status: true, message: "updated" });
  } catch (error) {
    res.json({ message: error.message });
  }
};
const updateRestaurantToppingAvailability = async (req, res) => {
  const { id, toppingId } = req.params;

  try {
    const { error, response } =
      await updateRestaurantToppingAvailabilityService(id, toppingId);
    if (error) {
      res.status(500).json({ message: error.message });
    }
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
