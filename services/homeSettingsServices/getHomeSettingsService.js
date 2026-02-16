const HomeSetting = require("../../models/HomeSetting");

const getHomeSettingsService = async () => {
  try {
    const response = await HomeSetting.findOne()
      .sort({ createdAt: -1 })
      .populate("menuItemId")
      .populate("offerId")
      .populate({
        path: "codePromoId",
        populate: {
          path: "freeItem",
          select: "name",
        },
      });

    if (!response) {
      return { error: "Home setting not found" };
    }

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getHomeSettingsService;
