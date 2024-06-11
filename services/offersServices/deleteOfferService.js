const { default: mongoose } = require("mongoose");
const { deleteImagesFromFirebase } = require("../../firebase");
const Offer = require("../../models/Offer");

const deleteOfferService = async (id) => {
  try {
    const response = await Offer.findById(id);
    if (!response) {
      return { error: "Offer not found" };
    }
    await deleteImagesFromFirebase(response.image);
    await Offer.findByIdAndDelete(id);
    const restaurants = await mongoose.models.Restaurant.find().select(
      "offers"
    );
    if (restaurants.length > 0) {
      await Promise.all(
        restaurants.map(async (restaurant) => {
          restaurant.offers = restaurant.offers.filter(
            (restaurantOffer) => restaurantOffer.offer.toString() !== id
          );
          await restaurant.save();
        })
      );
    }
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = deleteOfferService;
