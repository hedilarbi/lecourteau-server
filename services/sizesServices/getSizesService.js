const Size = require("../../models/Size");

const getSizesService = async () => {
  try {
    const response = await Size.find();
    return { response };
  } catch (err) {
    console.error("Error in getSizesService:", err); // Log the error
    return { error: err.message };
  }
};

module.exports = getSizesService;
