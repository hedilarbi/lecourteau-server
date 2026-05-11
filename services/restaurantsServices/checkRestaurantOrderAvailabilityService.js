const Restaurant = require("../../models/Restaurant");
const {
  getUnavailableMenuItemsForRestaurant,
} = require("./restaurantMenuItemAvailabilityService");
const {
  getUnavailableOffersForRestaurant,
} = require("./restaurantOfferAvailabilityService");
const {
  getUnavailableToppingsForRestaurant,
} = require("./restaurantToppingAvailabilityService");

const normalizeId = (value) => String(value || "").trim();

const toUniqueIds = (values = []) =>
  [...new Set((values || []).map((value) => normalizeId(value)).filter(Boolean))];

/**
 * Extracts all topping IDs from orderItems and offers payloads.
 * orderItems = [{ item, customizations: [toppingId, ...] }]
 * offers     = [{ offer, items: [{ item, customizations: [toppingId, ...] }] }]
 */
const extractToppingIds = (orderItems = [], offers = []) => {
  const ids = [];

  for (const orderItem of orderItems) {
    const customizations = Array.isArray(orderItem?.customizations)
      ? orderItem.customizations
      : [];
    for (const id of customizations) {
      const normalized = normalizeId(id);
      if (normalized) ids.push(normalized);
    }
  }

  for (const offer of offers) {
    const offerItems = Array.isArray(offer?.items) ? offer.items : [];
    for (const offerItem of offerItems) {
      const customizations = Array.isArray(offerItem?.customizations)
        ? offerItem.customizations
        : [];
      for (const id of customizations) {
        const normalized = normalizeId(id);
        if (normalized) ids.push(normalized);
      }
    }
  }

  return toUniqueIds(ids);
};

const checkRestaurantOrderAvailabilityService = async (
  restaurantId,
  payload = {},
) => {
  try {
    const restaurant = await Restaurant.findById(restaurantId).select("_id");
    if (!restaurant) {
      return { error: "Restaurant not found" };
    }

    const orderItems = Array.isArray(payload?.orderItems) ? payload.orderItems : [];
    const offers = Array.isArray(payload?.offers) ? payload.offers : [];

    const menuItemIds = toUniqueIds(
      orderItems.map((item) => item?.item || item?.id || item),
    );
    const offerIds = toUniqueIds(
      offers.map((offer) => offer?.offer || offer?.id || offer),
    );
    const toppingIds = extractToppingIds(orderItems, offers);

    const [
      { unavailableItems },
      { unavailableOffers },
      { unavailableItems: unavailableToppings },
    ] = await Promise.all([
      getUnavailableMenuItemsForRestaurant(restaurantId, menuItemIds),
      getUnavailableOffersForRestaurant(restaurantId, offerIds),
      toppingIds.length > 0
        ? getUnavailableToppingsForRestaurant(restaurantId, toppingIds)
        : Promise.resolve({ unavailableItems: [] }),
    ]);

    return {
      response: {
        isValid:
          unavailableItems.length === 0 &&
          unavailableOffers.length === 0 &&
          unavailableToppings.length === 0,
        unavailableItems,
        unavailableOffers,
        unavailableToppings,
      },
    };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  checkRestaurantOrderAvailabilityService,
};

