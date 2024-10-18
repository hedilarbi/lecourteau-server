const Size = require("../../models/Size");

const createSizeService = async (name) => {
  try {
    const existingSize = await Size.findOne({ name });
    if (existingSize) {
      return { error: "Size already exists" };
    }

    const response = await Size.create({ name });
    return { response };
  } catch (err) {
    console.error("Error in createSizeService:", err); // Log the error
    return { error: err.message };
  }
};

module.exports = createSizeService;
