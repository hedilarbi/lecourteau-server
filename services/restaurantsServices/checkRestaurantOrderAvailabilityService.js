const Restaurant = require("../../models/Restaurant");
const {
  getUnavailableMenuItemsForRestaurant,
} = require("./restaurantMenuItemAvailabilityService");
const {
  getUnavailableOffersForRestaurant,
} = require("./restaurantOfferAvailabilityService");

const normalizeId = (value) => String(value || "").trim();

const toUniqueIds = (values = []) =>
  [...new Set((values || []).map((value) => normalizeId(value)).filter(Boolean))];

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

    const { unavailableItems } = await getUnavailableMenuItemsForRestaurant(
      restaurantId,
      menuItemIds,
    );

    const { unavailableOffers } = await getUnavailableOffersForRestaurant(
      restaurantId,
      offerIds,
    );

    return {
      response: {
        isValid: unavailableItems.length === 0 && unavailableOffers.length === 0,
        unavailableItems,
        unavailableOffers,
      },
    };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  checkRestaurantOrderAvailabilityService,
};
