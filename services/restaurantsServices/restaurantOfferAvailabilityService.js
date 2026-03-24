const Restaurant = require("../../models/Restaurant");
const Offer = require("../../models/Offer");
const RestaurantOfferAvailability = require("../../models/RestaurantOfferAvailability");

const normalizeId = (value) => String(value || "").trim();

const toUniqueIds = (values = []) =>
  [...new Set((values || []).map((value) => normalizeId(value)).filter(Boolean))];

const ensureRestaurantExists = async (restaurantId) => {
  const restaurant = await Restaurant.findById(restaurantId).select("_id");
  return restaurant || null;
};

const getUnavailableOfferIdsSet = async (restaurantId, offerIds = []) => {
  const query = {
    restaurant: restaurantId,
    isAvailable: false,
  };

  const normalizedIds = toUniqueIds(offerIds);
  if (normalizedIds.length > 0) {
    query.offer = { $in: normalizedIds };
  }

  const overrides = await RestaurantOfferAvailability.find(query)
    .select("offer")
    .lean();

  return new Set(overrides.map((entry) => normalizeId(entry?.offer)));
};

const withOfferAvailability = (offer, unavailableIdsSet) => ({
  _id: offer?._id,
  offer,
  availability:
    Boolean(offer) && !unavailableIdsSet.has(normalizeId(offer?._id)),
});

const getRestaurantOffersAvailabilityList = async (restaurantId) => {
  const restaurant = await ensureRestaurantExists(restaurantId);
  if (!restaurant) {
    return { error: "Restaurant not found" };
  }

  const offers = await Offer.find().sort({ order: 1 }).lean();

  const unavailableIdsSet = await getUnavailableOfferIdsSet(
    restaurantId,
    offers.map((offer) => offer._id),
  );

  return {
    response: {
      offers: offers.map((offer) => withOfferAvailability(offer, unavailableIdsSet)),
    },
  };
};

const getRestaurantSingleOfferAvailability = async (restaurantId, offerId) => {
  const restaurant = await ensureRestaurantExists(restaurantId);
  if (!restaurant) {
    return { error: "Restaurant not found" };
  }

  const offer = await Offer.findById(offerId).populate({
    path: "items",
    populate: {
      path: "item",
      populate: [
        {
          path: "customization",
          populate: { path: "category" },
        },
        { path: "customization_group", populate: { path: "toppings" } },
      ],
    },
  });

  if (!offer) {
    return { error: "Offer not found" };
  }

  const unavailableIdsSet = await getUnavailableOfferIdsSet(restaurantId, [offerId]);

  return {
    response: withOfferAvailability(offer, unavailableIdsSet),
  };
};

const toggleRestaurantOfferAvailability = async (restaurantId, offerId) => {
  const restaurant = await ensureRestaurantExists(restaurantId);
  if (!restaurant) {
    return { error: "Restaurant not found" };
  }

  const offer = await Offer.findById(offerId).select("_id");
  if (!offer) {
    return { error: "Offer not found" };
  }

  const existingOverride = await RestaurantOfferAvailability.findOne({
    restaurant: restaurantId,
    offer: offerId,
    isAvailable: false,
  });

  if (existingOverride) {
    await RestaurantOfferAvailability.deleteOne({ _id: existingOverride._id });
    return {
      status: "success",
      availability: true,
    };
  }

  await RestaurantOfferAvailability.create({
    restaurant: restaurantId,
    offer: offerId,
    isAvailable: false,
  });

  return {
    status: "success",
    availability: false,
  };
};

const getUnavailableOffersForRestaurant = async (restaurantId, offerIds = []) => {
  const normalizedIds = toUniqueIds(offerIds);
  if (!normalizedIds.length) {
    return { unavailableOffers: [] };
  }

  const offers = await Offer.find({ _id: { $in: normalizedIds } })
    .select("_id name")
    .lean();

  const unavailableIdsSet = await getUnavailableOfferIdsSet(
    restaurantId,
    normalizedIds,
  );

  return {
    unavailableOffers: offers
      .filter((offer) => unavailableIdsSet.has(normalizeId(offer?._id)))
      .map((offer) => ({
        _id: offer._id,
        name: offer.name,
      })),
  };
};

module.exports = {
  getRestaurantOffersAvailabilityList,
  getRestaurantSingleOfferAvailability,
  toggleRestaurantOfferAvailability,
  getUnavailableOffersForRestaurant,
};
