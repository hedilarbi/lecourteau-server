const Offer = require("../../models/Offer");

const updateOfferService = async (
  id,
  name,
  newItems,
  newCustomizations,
  price,
  exprireAt,
  firebaseUrl
) => {
  try {
    let response;
    if (firebaseUrl === null) {
      response = await Offer.findByIdAndUpdate(
        id,
        {
          name,
          price: parseFloat(price),
          exprireAt: new Date(exprireAt),
          items: newItems,
          customizations: newCustomizations,
        },
        { new: true }
      )
        .populate({
          path: "items",
          populate: "item",
        })
        .populate("customizations");
    } else {
      response = await Offer.findByIdAndUpdate(
        id,
        {
          image: firebaseUrl,
          name,
          price: parseFloat(price),
          exprireAt: new Date(exprireAt),
          items: newItems,
          customizations: newCustomizations,
        },
        { new: true }
      )
        .populate({
          path: "items",
          populate: "item",
        })
        .populate("customizations");
    }
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updateOfferService;
