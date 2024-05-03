const Size = require("../../models/Size");

const createSizeService = async (name) => {
  try {
    const size = await Size.findOne({ name });
    if (size) {
      return { error: "Size already exists" };
    }
    const response = await Size.create({ name });
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = createSizeService;
