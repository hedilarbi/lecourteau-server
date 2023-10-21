const { default: mongoose } = require("mongoose");
const { ON_GOING, IN_DELIVERY, READY, DONE } = require("../utils/constants");

const getInititalStats = async (req, res) => {
  const statuses = [
    { label: "in_delivery", value: IN_DELIVERY },
    { label: "ready", value: READY },
    { label: "done", value: DONE },
    { label: "on_going", value: ON_GOING },
  ]; // Customize this list of statuses
  const onGoingOrdersCount = {};
  try {
    const usersCount = await mongoose.models.User.countDocuments();
    const ordersCount = await mongoose.models.Order.countDocuments();

    for (const status of statuses) {
      const count = await mongoose.models.Order.countDocuments({
        status: status.value,
      });
      onGoingOrdersCount[status.label] = count;
    }
    res.status(200).json({ usersCount, ordersCount, onGoingOrdersCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { getInititalStats };
