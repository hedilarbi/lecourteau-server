const Offer = require("../models/Offer");

const createOffer = async (req, res) => {
  const { name, expireAt, items, price, customizations } = req.body;

  const itemList = items.map((item) => {
    return { item: item.item._id, quantity: item.quantity, size: item.size };
  });
  const customizationList = customizations.map((item) => {
    return item._id;
  });
  try {
    const offer = await Offer.findOne({ name });
    if (offer) {
      return res.json({ message: "categorie existe déja" });
    }
    const newOffer = new Offer({
      name,
      image:
        "https://l.facebook.com/l.php?u=https%3A%2F%2Fscontent-yyz1-1.xx.fbcdn.net%2Fv%2Ft39.30808-6%2F312562522_639199964468245_8861346365077092793_n.jpg%3F_nc_cat%3D105%26ccb%3D1-7%26_nc_sid%3D8bfeb9%26_nc_ohc%3DYt_Iq3pCjD8AX-o-uwr%26_nc_ht%3Dscontent-yyz1-1.xx%26oh%3D00_AfC4bfbcjyxwf2Yal0JHRe-oau2XpAJGum2Zu7ZozlDDZQ%26oe%3D64F0FC9D&h=AT02Q7-M25r3iGMdRZSUo5i4Vtxx_AoODgVYlM1-zSBC-rhU3uq3ZvzYYjNa-g94Z0fCAUq5CSE0-8CJHJ84Bin2KFyN1MO_0V7KiSjLQcIweMJp7_-kMUVHaguGzMwcqkvaeQ",

      expireAt: new Date(expireAt),
      items: itemList,
      customizations: customizationList,
      price,
      createdAt: new Date(),
    });
    const response = await newOffer.save();

    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getOffers = async (req, res) => {
  try {
    const response = await Offer.find();
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getOffer = async (req, res) => {
  const { id } = req.params;

  try {
    const response = await Offer.findById(id)
      .populate({
        path: "items",
        populate: "item",
      })
      .populate("customizations");

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteOffer = async (req, res) => {
  const { id } = req.params;
  try {
    await Offer.findByIdAndDelete(id);
    res.status(200).json({ message: "offer deleted", success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
const updateOffer = async (req, res) => {
  const {
    name,

    price,

    exprireAt,
    items,
    customizations,
  } = req.body;
  const { id } = req.params;

  const newCustomizations = customizations.map((custo) => {
    return { _id: custo._id };
  });
  const newItems = items.map((custo) => {
    return { item: custo.item._id, size: custo.size, quantity: custo.quantity };
  });
  try {
    const response = await Offer.findByIdAndUpdate(
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
    console.log(response);
    res.status(200).json(response);
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  createOffer,
  getOffers,
  getOffer,
  deleteOffer,
  updateOffer,
};
