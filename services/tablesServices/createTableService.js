const Table = require("../../models/Table");

const createTableService = async (tableData) => {
  try {
    const table = await Table.findOne({ number: tableData.number });
    if (table) {
      return { error: "table existe déja" };
    }
    const newTable = new Table({
      ...tableData,
    });

    const response = await newTable.save();

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  createTableService,
};
