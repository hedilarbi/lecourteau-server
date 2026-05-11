const Restaurant = require("../../models/Restaurant");
const Topping = require("../../models/Topping");
const RestaurantToppingAvailability = require("../../models/RestaurantToppingAvailability");

const normalizeId = (value) => String(value || "").trim();

const toUniqueIds = (values = []) =>
  [...new Set((values || []).map((value) => normalizeId(value)).filter(Boolean))];

const ensureRestaurantExists = async (restaurantId) => {
  const restaurant = await Restaurant.findById(restaurantId).select("_id");
  return restaurant || null;
};

const getUnavailableToppingIdsSet = async (restaurantId, toppingIds = []) => {
  const query = {
    restaurant: restaurantId,
    isAvailable: false,
  };

  const normalizedIds = toUniqueIds(toppingIds);
  if (normalizedIds.length > 0) {
    query.topping = { $in: normalizedIds };
  }

  const overrides = await RestaurantToppingAvailability.find(query)
    .select("topping")
    .lean();

  return new Set(overrides.map((entry) => normalizeId(entry?.topping)));
};

const withToppingAvailability = (topping, unavailableIdsSet) => ({
  topping,
  availability:
    Boolean(topping) &&
    topping.is_available !== false &&
    !unavailableIdsSet.has(normalizeId(topping?._id)),
});

const normalizeAvailabilityFilter = (value) => {
  const normalized = String(value || "")
    .toLowerCase()
    .trim();

  if (["available", "disponible", "true"].includes(normalized)) {
    return "available";
  }

  if (["unavailable", "indisponible", "false"].includes(normalized)) {
    return "unavailable";
  }

  return "all";
};

const getRestaurantToppingsAvailabilityList = async (
  restaurantId,
  options = {},
) => {
  const restaurant = await ensureRestaurantExists(restaurantId);
  if (!restaurant) {
    return { error: "Restaurant not found" };
  }

  const toppings = await Topping.find()
    .populate("category")
    .lean();

  const unavailableIdsSet = await getUnavailableToppingIdsSet(
    restaurantId,
    toppings.map((item) => item._id),
  );
  
  const availabilityFilter = normalizeAvailabilityFilter(options?.availability);
  const toppingsWithAvailability = toppings.map((topping) =>
    withToppingAvailability(topping, unavailableIdsSet),
  );

  return {
    response: toppingsWithAvailability.filter((entry) => {
        if (availabilityFilter === "available") {
          return entry.availability === true;
        }
        if (availabilityFilter === "unavailable") {
          return entry.availability === false;
        }
        return true;
      }),
  };
};

const getRestaurantSingleToppingAvailability = async (restaurantId, toppingId) => {
  const restaurant = await ensureRestaurantExists(restaurantId);
  if (!restaurant) {
    return { error: "Restaurant not found" };
  }

  const topping = await Topping.findById(toppingId)
    .populate("category");

  if (!topping) {
    return { error: "Topping not found" };
  }

  const unavailableIdsSet = await getUnavailableToppingIdsSet(restaurantId, [
    toppingId,
  ]);

  return {
    response: withToppingAvailability(topping, unavailableIdsSet),
  };
};

const toggleRestaurantToppingAvailability = async (restaurantId, toppingId) => {
  const restaurant = await ensureRestaurantExists(restaurantId);
  if (!restaurant) {
    return { error: "Restaurant not found" };
  }

  const topping = await Topping.findById(toppingId).select("_id is_available");
  if (!topping) {
    return { error: "Topping not found" };
  }

  const existingOverride = await RestaurantToppingAvailability.findOne({
    restaurant: restaurantId,
    topping: toppingId,
    isAvailable: false,
  });

  if (existingOverride) {
    await RestaurantToppingAvailability.deleteOne({ _id: existingOverride._id });
    return {
      status: "success",
      availability: topping.is_available !== false,
    };
  }

  await RestaurantToppingAvailability.create({
    restaurant: restaurantId,
    topping: toppingId,
    isAvailable: false,
  });

  return {
    status: "success",
    availability: false,
  };
};

const getUnavailableToppingsForRestaurant = async (
  restaurantId,
  toppingIds = [],
) => {
  const normalizedIds = toUniqueIds(toppingIds);
  if (!normalizedIds.length) {
    return { unavailableItems: [] };
  }

  const toppings = await Topping.find({ _id: { $in: normalizedIds } })
    .select("_id name is_available")
    .lean();

  const unavailableIdsSet = await getUnavailableToppingIdsSet(
    restaurantId,
    normalizedIds,
  );

  return {
    unavailableItems: toppings
      .filter(
        (topping) =>
          topping?.is_available === false ||
          unavailableIdsSet.has(normalizeId(topping?._id)),
      )
      .map((topping) => ({
        _id: topping._id,
        name: topping.name,
      })),
  };
};

const resetAllRestaurantToppingsAvailability = async () => {
  const result = await RestaurantToppingAvailability.deleteMany({
    isAvailable: false,
  });

  return {
    status: true,
    deletedCount: Number(result?.deletedCount || 0),
  };
};

module.exports = {
  getRestaurantToppingsAvailabilityList,
  getRestaurantSingleToppingAvailability,
  toggleRestaurantToppingAvailability,
  getUnavailableToppingsForRestaurant,
  resetAllRestaurantToppingsAvailability,
};
