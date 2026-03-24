const Restaurant = require("../../models/Restaurant");
const RestaurantMenuItemAvailability = require("../../models/RestaurantMenuItemAvailability");
const RestaurantOfferAvailability = require("../../models/RestaurantOfferAvailability");

const migrateLegacyRestaurantAvailabilityService = async () => {
  try {
    const restaurants = await Restaurant.find()
      .select("_id menu_items offers")
      .lean();

    const menuItemOps = [];
    const offerOps = [];
    let legacyUnavailableMenuItems = 0;
    let legacyUnavailableOffers = 0;

    for (const restaurant of restaurants) {
      for (const itemEntry of restaurant?.menu_items || []) {
        if (itemEntry?.availability === false && itemEntry?.menuItem) {
          legacyUnavailableMenuItems += 1;
          menuItemOps.push({
            updateOne: {
              filter: {
                restaurant: restaurant._id,
                menuItem: itemEntry.menuItem,
              },
              update: {
                $setOnInsert: {
                  restaurant: restaurant._id,
                  menuItem: itemEntry.menuItem,
                  isAvailable: false,
                },
              },
              upsert: true,
            },
          });
        }
      }

      for (const offerEntry of restaurant?.offers || []) {
        if (offerEntry?.availability === false && offerEntry?.offer) {
          legacyUnavailableOffers += 1;
          offerOps.push({
            updateOne: {
              filter: {
                restaurant: restaurant._id,
                offer: offerEntry.offer,
              },
              update: {
                $setOnInsert: {
                  restaurant: restaurant._id,
                  offer: offerEntry.offer,
                  isAvailable: false,
                },
              },
              upsert: true,
            },
          });
        }
      }
    }

    const [menuItemsResult, offersResult] = await Promise.all([
      menuItemOps.length
        ? RestaurantMenuItemAvailability.bulkWrite(menuItemOps, { ordered: false })
        : null,
      offerOps.length
        ? RestaurantOfferAvailability.bulkWrite(offerOps, { ordered: false })
        : null,
    ]);

    return {
      response: {
        restaurantsScanned: restaurants.length,
        legacyUnavailableMenuItems,
        legacyUnavailableOffers,
        menuItemOverridesCreated: Number(menuItemsResult?.upsertedCount || 0),
        offerOverridesCreated: Number(offersResult?.upsertedCount || 0),
      },
    };
  } catch (error) {
    return { error: error?.message || error };
  }
};

module.exports = {
  migrateLegacyRestaurantAvailabilityService,
};
