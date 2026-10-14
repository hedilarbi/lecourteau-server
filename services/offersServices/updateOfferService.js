const Offer = require("../../models/Offer");

const updateOfferService = async (
  id,
  name,
  newItems,

  price,
  expireAt,
  firebaseUrl,
  itemsToChoose // undefined = champ non envoyé (ancien client) : valeur actuelle conservée
) => {
  try {
    const updateData = {
      name,
      price: parseFloat(price),
      expireAt: new Date(expireAt),
      items: newItems,
    };

    if (itemsToChoose !== undefined) {
      updateData.itemsToChoose = itemsToChoose;
    } else {
      // La liste d'articles a pu rétrécir : un nombre devenu invalide repasse à "tous inclus".
      const current = await Offer.findById(id).select("itemsToChoose").lean();
      const kept = Number(current?.itemsToChoose);
      if (Number.isInteger(kept) && kept >= newItems.length) updateData.itemsToChoose = null;
    }

    if (firebaseUrl) {
      updateData.image = firebaseUrl;
    }

    const response = await Offer.findByIdAndUpdate(id, updateData, {
      new: true,
    }).populate({
      path: "items",
      populate: "item",
    });

    if (!response) {
      return { error: "Offer not found" };
    }

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updateOfferService;
