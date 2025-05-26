const { default: mongoose } = require("mongoose");
const Restaurant = require("../../models/Restaurant");

const createRestaurantService = async (
  name,
  address,
  location,
  phoneNumber
) => {
  try {
    const menuItems = await mongoose.models.MenuItem.find({}, "_id");
    const toppings = await mongoose.models.Topping.find({}, "_id");
    const offers = await mongoose.models.Offer.find({}, "_id");

    const offersIDs = offers.map((offer) => ({
      offer: offer._id,
      availability: true,
    }));
    const menuItemsIDs = menuItems.map((menuItem) => ({
      menuItem: menuItem._id,
      availability: true,
    }));
    const toppingsIDs = toppings.map((topping) => ({
      topping: topping._id,
      availability: true,
    }));

    const newRestaurant = new Restaurant({
      name,
      address,
      location,
      menu_items: menuItemsIDs,
      toppings: toppingsIDs,
      offers: offersIDs,
      phone_number: phoneNumber,
      settings: {
        delivery: true,
        open: true,
        delivey_fee: 0,
        delivery_range: 0,
        emploie_du_temps: {
          lundi: {
            open: "08:00",
            close: "20:00",
          },
          mardi: {
            open: "08:00",
            close: "20:00",
          },
          mercredi: {
            open: "08:00",
            close: "20:00",
          },
          jeudi: {
            open: "08:00",
            close: "20:00",
          },
          vendredi: {
            open: "08:00",
            close: "20:00",
          },
          samedi: {
            open: "08:00",
            close: "20:00",
          },
          dimanche: {
            open: "08:00",
            close: "20:00",
          },
        },
      },
    });

    const response = await newRestaurant.save();
    return { response };
  } catch (err) {
    console.error("Error in createRestaurantService:", err);
    return { error: err.message };
  }
};

module.exports = {
  createRestaurantService,
};
