const { default: mongoose } = require("mongoose");
const { deleteImagesFromFirebase } = require("../../firebase");
const Offer = require("../../models/Offer");

const deleteOfferService = async (id) => {
  try {
    const offer = await Offer.findById(id);
    if (!offer) {
      return { error: "Offer not found" };
    }

    try {
      await deleteImagesFromFirebase(offer.image);
    } catch (imageError) {
      return {
        error: `Error deleting images from Firebase: ${imageError.message}`,
      };
    }

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

    return { response: "Offer deleted" };
  } catch (err) {
    return { error: err.message };
  }
};
module.exports = deleteOfferService;
