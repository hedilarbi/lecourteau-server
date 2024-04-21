const Offer = require("../../models/Offer");

const getOfferService = async (id) => {
  try {
    const response = await Offer.findById(id)
      .populate({
        path: "items",
        populate: "item",
      })
      .populate({ path: "customizations", populate: "category" });
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getOfferService;
