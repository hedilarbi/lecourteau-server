const Offer = require("../../models/Offer");

const getOfferService = async (id) => {
  try {
    const response = await Offer.findById(id)
      .populate({
        path: "items",
        populate: {
          path: "item",
          populate: { path: "customization", populate: "category" },
        },
      })
      .populate({ path: "customizations", populate: "category" });

    if (!response) {
      return { error: "Offer not found" };
    }

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};
module.exports = getOfferService;
