const Offer = require("../../models/Offer");
const normalizeOffersOrderService = require("./normalizeOffersOrderService");

const getOffersService = async () => {
  try {
    const { error: normalizeError } = await normalizeOffersOrderService();
    if (normalizeError) {
      return { error: normalizeError };
    }

    const response = await Offer.find()
      .sort({ order: 1, createdAt: 1 })
      .populate("items.item");

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getOffersService;
