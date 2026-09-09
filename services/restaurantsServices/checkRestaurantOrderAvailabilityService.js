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

const RESTAURANT_TIMEZONE =
  String(process.env.RESTAURANT_TIMEZONE || "America/Toronto").trim() ||
  "America/Toronto";
const DAY_KEYS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];

const parseScheduleTime = (value) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const getRestaurantLocalTime = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: RESTAURANT_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    weekday,
  );
  const hours = Number(parts.find((part) => part.type === "hour")?.value);
  const minutes = Number(parts.find((part) => part.type === "minute")?.value);

  return { weekdayIndex, minutesSinceMidnight: hours * 60 + minutes };
};

const isWithinRestaurantSchedule = (schedule, now = new Date()) => {
  if (!schedule || typeof schedule !== "object") return false;

  const { weekdayIndex, minutesSinceMidnight } = getRestaurantLocalTime(now);
  if (weekdayIndex < 0 || !Number.isFinite(minutesSinceMidnight)) return false;

  const today = schedule[DAY_KEYS[weekdayIndex]] || {};
  const todayOpen = parseScheduleTime(today.open);
  const todayClose = parseScheduleTime(today.close);

  if (todayOpen !== null && todayClose !== null) {
    if (todayClose >= todayOpen) {
      if (minutesSinceMidnight >= todayOpen && minutesSinceMidnight <= todayClose) {
        return true;
      }
    } else if (minutesSinceMidnight >= todayOpen) {
      return true;
    }
  }

  // Une plage qui finit après minuit appartient au jour précédent.
  const previousDayIndex = (weekdayIndex + 6) % 7;
  const previousDay = schedule[DAY_KEYS[previousDayIndex]] || {};
  const previousOpen = parseScheduleTime(previousDay.open);
  const previousClose = parseScheduleTime(previousDay.close);

  return (
    previousOpen !== null &&
    previousClose !== null &&
    previousClose < previousOpen &&
    minutesSinceMidnight <= previousClose
  );
};

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
    const restaurant = await Restaurant.findById(restaurantId).select(
      "_id settings.open settings.delivery settings.emploie_du_temps",
    );
    if (!restaurant) {
      return { error: "Restaurant not found" };
    }

    const orderType = String(payload?.orderType || payload?.type || "")
      .trim()
      .toLowerCase();
    const isDeliveryOrder = ["delivery", "devliery", "livraison"].includes(
      orderType,
    );

    if (restaurant.settings?.open !== true) {
      return {
        response: {
          isValid: false,
          restaurantUnavailableReason: "restaurant_closed",
          message: "Le restaurant est actuellement fermé.",
          unavailableItems: [],
          unavailableOffers: [],
          unavailableToppings: [],
        },
      };
    }

    if (isDeliveryOrder && restaurant.settings?.delivery !== true) {
      return {
        response: {
          isValid: false,
          restaurantUnavailableReason: "delivery_unavailable",
          message: "La livraison est actuellement indisponible pour ce restaurant.",
          unavailableItems: [],
          unavailableOffers: [],
          unavailableToppings: [],
        },
      };
    }

    if (!isWithinRestaurantSchedule(restaurant.settings?.emploie_du_temps)) {
      return {
        response: {
          isValid: false,
          restaurantUnavailableReason: "outside_opening_hours",
          message: "Le restaurant est fermé à cette heure-ci.",
          unavailableItems: [],
          unavailableOffers: [],
          unavailableToppings: [],
        },
      };
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
  isWithinRestaurantSchedule,
};
