const Size = require("../../models/Size");

const deleteSizeService = async (id) => {
  try {
    const response = await Size.findByIdAndDelete(id);
    return { response }; // This will be null if the size was not found
  } catch (err) {
    console.error("Error in deleteSizeService:", err); // Log the error
    return { error: err.message };
  }
};
module.exports = deleteSizeService;
