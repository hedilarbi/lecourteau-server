const Offer = require("../../models/Offer");

const getOffersService = async () => {
  try {
    let response = await Offer.find();
    response = response.reverse();
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getOffersService;
