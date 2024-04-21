const Staff = require("../../models/staff");
const { DELIVERED } = require("../../utils/constants");
const getStaffOrderService = async (id) => {
  try {
    const response = await Staff.findById(id).populate({
      path: "orders",
      populate: [
        {
          path: "user",
        },
        {
          path: "offers",
          populate: {
            path: "offer",
          },
        },
        {
          path: "orderItems",
          populate: {
            path: "item",
          },
        },
      ],
    });

    const ongoingDeliveryList = response.orders.filter(
      (order) => order.status !== DELIVERED
    );
    if (ongoingDeliveryList.length === 0) {
      return { lastItem: null };
    }
    const lastItem = ongoingDeliveryList[ongoingDeliveryList.length - 1];

    return { lastItem };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getStaffOrderService,
};
