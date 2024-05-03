const Size = require("../../models/Size");

const getSizesService = async () => {
  try {
    const response = await Size.find();
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getSizesService;
