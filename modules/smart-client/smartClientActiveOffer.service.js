const PersonalizedOffer = require("../../models/PersonalizedOffer");
const Order = require("../../models/Order");
const { CANCELED } = require("../../utils/constants");

class SmartClientActiveOfferService {
  async getPersonalizedOffer(userId) {
    const now = new Date();
    const offer = await PersonalizedOffer.findOne({
      user: userId,
      status: { $in: ["active", "viewed", "clicked"] },
      validUntil: { $gt: now },
      $or: [{ validFrom: null }, { validFrom: { $lte: now } }],
    })
      .sort({ createdAt: -1 })
      .populate("freeItem targetCategory targetMenuItem triggerItem")
      .populate({ path: "freeItems.item", populate: { path: "category", select: "name slug" } })
      .populate("excludedCategories", "name")
      .lean();
    if (!offer) return null;

    const existingOrderQuery = { personalizedOffer: offer._id, status: { $ne: CANCELED } };
    if (offer.offerType === "split_discount") existingOrderQuery.smartOfferUsageStep = offer.currentStep || 0;
    return await Order.exists(existingOrderQuery) ? null : offer;
  }
}

module.exports = new SmartClientActiveOfferService();
