const Table = require("../../models/Table");

const getTablesService = async () => {
  try {
    const response = await Table.find();
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getTablesService;
