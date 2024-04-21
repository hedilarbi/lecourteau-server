const Staff = require("../../models/staff");
const getDriversOrdersService = async (id) => {
  try {
    const response = await Staff.findById(id).populate("orders");
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getDriversOrdersService,
};
