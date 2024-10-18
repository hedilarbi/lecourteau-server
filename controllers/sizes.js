const createSizeService = require("../services/sizesServices/createSizeService");
const deleteSizeService = require("../services/sizesServices/deleteSizeService");
const getSizesService = require("../services/sizesServices/getSizesService");

const createSize = async (req, res) => {
  try {
    const { name } = req.body;

    // Validate input
    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });
    }

    const { response, error } = await createSizeService(name);

    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    res.status(201).json(response);
  } catch (err) {
    console.error("Error creating size:", err); // Log the error
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getSizes = async (req, res) => {
  try {
    const { response, error } = await getSizesService();

    if (error) {
      console.error("Error fetching sizes:", error); // Log the error
      return res.status(400).json({ success: false, message: error });
    }

    // Check if response is empty
    if (response.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No sizes found" });
    }

    res.status(200).json(response);
  } catch (err) {
    console.error("Error in getSizes:", err); // Log the error
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const deleteSize = async (req, res) => {
  const { id } = req.params;

  try {
    const { response, error } = await deleteSizeService(id);

    if (error) {
      console.error("Error deleting size:", error); // Log the error
      return res.status(400).json({ success: false, message: error });
    }

    // Check if a size was deleted
    if (!response) {
      return res
        .status(404)
        .json({ success: false, message: "Size not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Size deleted successfully" });
  } catch (err) {
    console.error("Error in deleteSize:", err); // Log the error
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
module.exports = { createSize, getSizes, deleteSize };
