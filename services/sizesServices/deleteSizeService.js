const Size = require("../../models/Size");

const deleteSizeService = async (id) => {
  try {
    const response = await Size.findByIdAndDelete(id);
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = deleteSizeService;
