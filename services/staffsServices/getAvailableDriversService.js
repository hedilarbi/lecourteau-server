const Staff = require("../../models/staff");
const getAvailableDriversService = async () => {
  try {
    const response = await Staff.find({ role: "Livreur", is_available: true });

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getAvailableDriversService,
};
