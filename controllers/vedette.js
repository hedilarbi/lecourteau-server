const Vedette = require("../models/Vedette");

const createVedette = async (req, res) => {
  try {
    const { menuItem } = req.body;

    const vedetteExists = await Vedette.findOne({ menuItem });
    if (vedetteExists) {
      res.status(400).json({
        error: "Vedette already exists for this menu item.",
      });
      return;
    }
    const vedetteCount = await Vedette.countDocuments();
    const vedette = new Vedette({
      menuItem,
      order: vedetteCount + 1,
    });
    const savedVedette = await vedette.save();
    res.status(201).json(savedVedette);
  } catch (err) {
    console.error(`Error creating vedette: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

const getVedettes = async (req, res) => {
  try {
    const vedettes = await Vedette.find().populate("menuItem");
    vedettes.sort((a, b) => a.order - b.order);

    res.status(200).json(vedettes);
  } catch (err) {
    console.error(`Error fetching vedettes: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};
const deleteVedette = async (req, res) => {
  try {
    const { id } = req.params;
    const vedette = await Vedette.findByIdAndDelete(id);
    if (!vedette) {
      return res.status(404).json({ error: "Vedette not found" });
    }
    return res.status(200).json({ response: "Vedette deleted successfully" });
  } catch (err) {
    console.error(`Error deleting vedette: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
};

const triVedettes = async (req, res) => {
  try {
    const { list } = req.body;
    const vedettes = await Vedette.find();
    const savePromises = list.map(async (item) => {
      const vedette = vedettes.find((i) => i._id.toString() === item.id);
      if (!vedette) {
        return { error: `Item with ID ${item.id} not found` }; // Return error if item not found
      }
      vedette.order = item.order;
      return vedette.save(); // Return the save promise
    });

    // Execute all save promises
    await Promise.all(savePromises);
    return res
      .status(200)
      .json({ success: true, message: "Vedettes sorted successfully" });
  } catch (err) {
    console.error(`Error sorting vedettes: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { createVedette, getVedettes, deleteVedette, triVedettes };
