const createSizeService = require("../services/sizesServices/createSizeService");
const deleteSizeService = require("../services/sizesServices/deleteSizeService");
const getSizesService = require("../services/sizesServices/getSizesService");

const createSize = async (req, res) => {
  try {
    const { name } = req.body;
    const { response, error } = await createSizeService(name);
    if (error) {
      return res.status(400).json(error);
    }
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json(error.message);
  }
};

const getSizes = async (req, res) => {
  try {
    const { response, error } = await getSizesService();
    if (error) {
      return res.status(400).json(error);
    }
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json(error.message);
  }
};

const deleteSize = async (req, res) => {
  try {
    const { id } = req.params;
    const { response, error } = await deleteSizeService(id);
    if (error) {
      return res.status(400).json(error);
    }
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json(error.message);
  }
};
module.exports = { createSize, getSizes, deleteSize };
