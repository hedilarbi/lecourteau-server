const Offer = require("../../models/Offer");
const normalizeOffersOrderService = require("./normalizeOffersOrderService");

const createOfferService = async (
  name,
  expireAt,
  itemList,
  price,

  firebaseUrl,
  itemsToChoose = null
) => {
  try {
    const { error: normalizeError } = await normalizeOffersOrderService();
    if (normalizeError) {
      return { error: normalizeError };
    }

    const offer = await Offer.findOne({ name });
    if (offer) {
      return { error: "Offer already exists" };
    }
    const offersCount = await Offer.countDocuments();
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    const newOffer = new Offer({
      name,
      image: firebaseUrl,
      expireAt: new Date(expireAt),
      items: itemList,
      slug,
      price: parseFloat(price),
      itemsToChoose,
      createdAt: new Date(),
      order: offersCount + 1,
    });
    const response = await newOffer.save();

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = createOfferService;
