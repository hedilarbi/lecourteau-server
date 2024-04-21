const MenuItem = require("../../models/MenuItem");

const updateMenuItemAvailabilityService = async (id, status) => {
  try {
    const response = await MenuItem.findByIdAndUpdate(
      id,
      { is_available: status },
      { new: true }
    );
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updateMenuItemAvailabilityService;
