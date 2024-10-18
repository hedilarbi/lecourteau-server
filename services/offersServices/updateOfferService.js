const Offer = require("../../models/Offer");

const updateOfferService = async (
  id,
  name,
  newItems,
  newCustomizations,
  price,
  expireAt,
  firebaseUrl
) => {
  try {
    const updateData = {
      name,
      price: parseFloat(price),
      expireAt: new Date(expireAt),
      items: newItems,
      customizations: newCustomizations,
    };

    if (firebaseUrl) {
      updateData.image = firebaseUrl;
    }

    const response = await Offer.findByIdAndUpdate(id, updateData, {
      new: true,
    })
      .populate({
        path: "items",
        populate: "item",
      })
      .populate("customizations");

    if (!response) {
      return { error: "Offer not found" };
    }

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updateOfferService;
