const Offer = require("../models/Offer");
const createOffer = async (req, res) => {
  const { name, image } = req.body;
  try {
    const offer = await Offer.findOne({ name });
    if (offer) {
      return res.json({ message: "categorie existe déja" });
    }
    const newOffer = new Offer({
      name,
      image,
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

module.exports = {
  createOffer,
  getOffers,
};
