const Offer = require("../../models/Offer");

const normalizeOffersOrderService = async () => {
  try {
    const offers = await Offer.find()
      .select("_id order createdAt")
      .sort({ order: 1, createdAt: 1, _id: 1 });

    if (!offers.length) {
      return { response: [] };
    }

    const bulkUpdates = [];

    offers.forEach((offer, index) => {
      const expectedOrder = index + 1;
      if (Number(offer.order) !== expectedOrder) {
        bulkUpdates.push({
          updateOne: {
            filter: { _id: offer._id },
            update: { $set: { order: expectedOrder } },
          },
        });
      }
    });

    if (bulkUpdates.length > 0) {
      await Offer.bulkWrite(bulkUpdates);
    }

    return { response: true };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = normalizeOffersOrderService;
