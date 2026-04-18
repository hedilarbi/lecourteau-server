const Restaurant = require("../../models/Restaurant");
const MenuItem = require("../../models/MenuItem");
const RestaurantMenuItemAvailability = require("../../models/RestaurantMenuItemAvailability");

const normalizeId = (value) => String(value || "").trim();

const toUniqueIds = (values = []) =>
  [...new Set((values || []).map((value) => normalizeId(value)).filter(Boolean))];

const ensureRestaurantExists = async (restaurantId) => {
  const restaurant = await Restaurant.findById(restaurantId).select("_id");
  return restaurant || null;
};

const getUnavailableMenuItemIdsSet = async (restaurantId, menuItemIds = []) => {
  const query = {
    restaurant: restaurantId,
    isAvailable: false,
  };

  const normalizedIds = toUniqueIds(menuItemIds);
  if (normalizedIds.length > 0) {
    query.menuItem = { $in: normalizedIds };
  }

  const overrides = await RestaurantMenuItemAvailability.find(query)
    .select("menuItem")
    .lean();

  return new Set(overrides.map((entry) => normalizeId(entry?.menuItem)));
};

const withMenuItemAvailability = (menuItem, unavailableIdsSet) => ({
  menuItem,
  availability:
    Boolean(menuItem) &&
    menuItem.is_available !== false &&
    !unavailableIdsSet.has(normalizeId(menuItem?._id)),
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

const getRestaurantItemsAvailabilityList = async (
  restaurantId,
  options = {},
) => {
  const restaurant = await ensureRestaurantExists(restaurantId);
  if (!restaurant) {
    return { error: "Restaurant not found" };
  }

  const menuItems = await MenuItem.find()
    .populate("category")
    .sort({ order: 1 })
    .lean();

  const unavailableIdsSet = await getUnavailableMenuItemIdsSet(
    restaurantId,
    menuItems.map((item) => item._id),
  );
  const availabilityFilter = normalizeAvailabilityFilter(options?.availability);
  const menuItemsWithAvailability = menuItems.map((menuItem) =>
    withMenuItemAvailability(menuItem, unavailableIdsSet),
  );

  return {
    response: {
      menu_items: menuItemsWithAvailability.filter((entry) => {
        if (availabilityFilter === "available") {
          return entry.availability === true;
        }
        if (availabilityFilter === "unavailable") {
          return entry.availability === false;
        }
        return true;
      }),
    },
  };
};

const getRestaurantSingleMenuItemAvailability = async (restaurantId, menuItemId) => {
  const restaurant = await ensureRestaurantExists(restaurantId);
  if (!restaurant) {
    return { error: "Restaurant not found" };
  }

  const menuItem = await MenuItem.findById(menuItemId)
    .populate("category")
    .populate("customization", "name price image category")
    .populate({
      path: "customization",
      populate: { path: "category" },
    })
    .populate({
      path: "customization_group",
      populate: { path: "toppings" },
    });

  if (!menuItem) {
    return { error: "Menu item not found" };
  }

  const unavailableIdsSet = await getUnavailableMenuItemIdsSet(restaurantId, [
    menuItemId,
  ]);

  return {
    response: withMenuItemAvailability(menuItem, unavailableIdsSet),
  };
};

const toggleRestaurantMenuItemAvailability = async (restaurantId, menuItemId) => {
  const restaurant = await ensureRestaurantExists(restaurantId);
  if (!restaurant) {
    return { error: "Restaurant not found" };
  }

  const menuItem = await MenuItem.findById(menuItemId).select("_id is_available");
  if (!menuItem) {
    return { error: "Item not found" };
  }

  const existingOverride = await RestaurantMenuItemAvailability.findOne({
    restaurant: restaurantId,
    menuItem: menuItemId,
    isAvailable: false,
  });

  if (existingOverride) {
    await RestaurantMenuItemAvailability.deleteOne({ _id: existingOverride._id });
    return {
      status: "success",
      availability: menuItem.is_available !== false,
    };
  }

  await RestaurantMenuItemAvailability.create({
    restaurant: restaurantId,
    menuItem: menuItemId,
    isAvailable: false,
  });

  return {
    status: "success",
    availability: false,
  };
};

const getUnavailableMenuItemsForRestaurant = async (
  restaurantId,
  menuItemIds = [],
) => {
  const normalizedIds = toUniqueIds(menuItemIds);
  if (!normalizedIds.length) {
    return { unavailableItems: [] };
  }

  const menuItems = await MenuItem.find({ _id: { $in: normalizedIds } })
    .select("_id name is_available")
    .lean();

  const unavailableIdsSet = await getUnavailableMenuItemIdsSet(
    restaurantId,
    normalizedIds,
  );

  return {
    unavailableItems: menuItems
      .filter(
        (menuItem) =>
          menuItem?.is_available === false ||
          unavailableIdsSet.has(normalizeId(menuItem?._id)),
      )
      .map((menuItem) => ({
        _id: menuItem._id,
        name: menuItem.name,
      })),
  };
};

const resetAllRestaurantMenuItemsAvailability = async () => {
  const result = await RestaurantMenuItemAvailability.deleteMany({
    isAvailable: false,
  });

  return {
    status: true,
    deletedCount: Number(result?.deletedCount || 0),
  };
};

module.exports = {
  getRestaurantItemsAvailabilityList,
  getRestaurantSingleMenuItemAvailability,
  toggleRestaurantMenuItemAvailability,
  getUnavailableMenuItemsForRestaurant,
  resetAllRestaurantMenuItemsAvailability,
};
