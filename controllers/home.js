const Category = require("../models/Category");
const Offer = require("../models/Offer");
const Vedette = require("../models/Vedette");
const HomeSetting = require("../models/HomeSetting");

const getHomeContent = async (req, res) => {
  try {
    const [categories, offers, vedettes, homeSettings] = await Promise.all([
      Category.find().sort({ order: 1 }),
      Offer.find().sort({ createdAt: -1 }).populate("items.item"),
      Vedette.find().sort({ order: 1 }).populate("menuItem"),
      HomeSetting.findOne()
        .sort({ createdAt: -1 })
        .populate("menuItemId")
        .populate("offerId")
        .populate({
          path: "codePromoId",
          populate: {
            path: "freeItem",
            select: "name",
          },
        }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        categories,
        offers,
        vedettes,
        homeSettings: homeSettings || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getHomeContent,
};
