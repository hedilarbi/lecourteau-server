const cron = require("node-cron");
const {
  resetAllRestaurantMenuItemsAvailability,
} = require("../services/restaurantsServices/restaurantMenuItemAvailabilityService");

const DEFAULT_ITEMS_RESET_TIMEZONE =
  String(process.env.ITEMS_RESET_TIMEZONE || "America/Toronto").trim() ||
  "America/Toronto";

const resetAllRestaurantsItemsAvailability = async () => {
  try {
    return await resetAllRestaurantMenuItemsAvailability();
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
        `[resetRestaurantItemsAvailabilityJob] reset done (deletedOverrides=${result.deletedCount})`,
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
