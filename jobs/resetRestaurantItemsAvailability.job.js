const cron = require("node-cron");
const Restaurant = require("../models/Restaurant");

const DEFAULT_ITEMS_RESET_TIMEZONE =
  String(process.env.ITEMS_RESET_TIMEZONE || "America/Toronto").trim() ||
  "America/Toronto";

const resetAllRestaurantsItemsAvailability = async () => {
  try {
    const result = await Restaurant.updateMany(
      { "menu_items.0": { $exists: true } },
      { $set: { "menu_items.$[].availability": true } },
    );

    return {
      status: true,
      matchedCount: Number(result?.matchedCount || 0),
      modifiedCount: Number(result?.modifiedCount || 0),
    };
  } catch (error) {
    return {
      status: false,
      message: error?.message || "Failed to reset item availability.",
    };
  }
};

function startResetRestaurantItemsAvailabilityJob() {
  cron.schedule(
    "0 0 * * *",
    async () => {
      const result = await resetAllRestaurantsItemsAvailability();

      if (!result.status) {
        console.error(
          "[resetRestaurantItemsAvailabilityJob] error:",
          result.message,
        );
        return;
      }

      console.log(
        `[resetRestaurantItemsAvailabilityJob] reset done (matched=${result.matchedCount}, modified=${result.modifiedCount})`,
      );
    },
    {
      timezone: DEFAULT_ITEMS_RESET_TIMEZONE,
    },
  );

  console.log(
    `[resetRestaurantItemsAvailabilityJob] scheduled at 00:00 (${DEFAULT_ITEMS_RESET_TIMEZONE})`,
  );
}

module.exports = {
  startResetRestaurantItemsAvailabilityJob,
  resetAllRestaurantsItemsAvailability,
  DEFAULT_ITEMS_RESET_TIMEZONE,
};
