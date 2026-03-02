const Offer = require("../../models/Offer");

const initializeOffersOrderService = async () => {
  try {
    const offers = await Offer.find()
      .select("_id createdAt")
      .sort({ createdAt: 1, _id: 1 });

    if (!offers.length) {
      return { response: { total: 0, updated: 0 } };
    }

    const bulkUpdates = offers.map((offer, index) => ({
      updateOne: {
        filter: { _id: offer._id },
        update: { $set: { order: index + 1 } },
      },
    }));

    await Offer.bulkWrite(bulkUpdates);

    return {
      response: {
        total: offers.length,
        updated: bulkUpdates.length,
      },
    };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = initializeOffersOrderService;
