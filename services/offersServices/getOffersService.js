const Offer = require("../../models/Offer");

const getOffersService = async () => {
  try {
    const response = await Offer.find()
      .sort({ createdAt: -1 })
      .populate("items.item")
      .populate("customizations");
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getOffersService;
