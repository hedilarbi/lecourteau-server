const Table = require("../../models/Table");

const getTableService = async (number) => {
  try {
    const response = await Table.findOne({ number });
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getTableService;
