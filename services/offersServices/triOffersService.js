const Offer = require("../../models/Offer");
const normalizeOffersOrderService = require("./normalizeOffersOrderService");

const triOffersService = async (list = []) => {
  try {
    if (!Array.isArray(list) || list.length === 0) {
      return { error: "Liste d'offres invalide." };
    }

    const offers = await Offer.find().select("_id");
    const offerIds = new Set(offers.map((item) => item._id.toString()));

    const bulkUpdates = [];

    list.forEach((item) => {
      if (!item?.id || !offerIds.has(String(item.id))) {
        return;
      }

      const nextOrder = Number(item.order);
      if (!Number.isFinite(nextOrder)) {
        return;
      }

      bulkUpdates.push({
        updateOne: {
          filter: { _id: item.id },
          update: { $set: { order: nextOrder } },
        },
      });
    });

    if (bulkUpdates.length > 0) {
      await Offer.bulkWrite(bulkUpdates);
    }

    const { error } = await normalizeOffersOrderService();
    if (error) {
      return { error };
    }

    return { response: true };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = triOffersService;
