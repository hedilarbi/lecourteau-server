const { deleteImagesFromFirebase } = require("../../firebase");
const Offer = require("../../models/Offer");
const RestaurantOfferAvailability = require("../../models/RestaurantOfferAvailability");
const normalizeOffersOrderService = require("./normalizeOffersOrderService");

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
    await RestaurantOfferAvailability.deleteMany({ offer: id });

    const { error: normalizeError } = await normalizeOffersOrderService();
    if (normalizeError) {
      return { error: normalizeError };
    }

    return { response: "Offer deleted" };
  } catch (err) {
    return { error: err.message };
  }
};
module.exports = deleteOfferService;
