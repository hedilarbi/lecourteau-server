const Order = require("../../models/Order");

const getOrderService = async (id) => {
  try {
    const response = await Order.findById(id)
      .populate({
        path: "orderItems",
        populate: [
          {
            path: "item",
            select: "name customization_group",
            populate: {
              path: "customization_group",
              select: "name selectionRule toppings",
              populate: { path: "toppings", select: "name price" },
            },
          },
          {
            path: "customizations",
            select: "name price",
          },
        ],
      })
      .populate({
        path: "offers",
        populate: [
          {
            path: "offer",
            populate: {
              path: "items.item",
              select: "name customization_group",
              populate: {
                path: "customization_group",
                select: "name selectionRule toppings",
                populate: { path: "toppings", select: "name price" },
              },
            },
          },
          {
            path: "items.item",
            select: "name customization_group",
            populate: {
              path: "customization_group",
              select: "name selectionRule toppings",
              populate: { path: "toppings", select: "name price" },
            },
          },
          {
            path: "items.customizations",
            select: "name price",
          },
        ],
      })
      .populate({
        path: "rewards",
        populate: [
          { path: "item", select: "name image" },
          { path: "customizations", select: "name price" },
          {
            path: "reward",
            select: "points size item",
            populate: { path: "item", select: "name image" },
          },
        ],
      })
      .populate({ path: "user", select: "name phone_number email" })
      .populate("restaurant", "name")
      .populate("subscriptionBenefits.freeItemMenuItemId", "name")
      .populate("birthdayBenefits.freeItemMenuItemId", "name")
      .populate({
        path: "promoCode",
        populate: { path: "freeItem", select: "name" },
      })
      .populate({
        path: "personalizedOffer",
        populate: [
          { path: "targetCategory", select: "name" },
          { path: "targetMenuItem", select: "name" },
          { path: "freeItem", select: "name" },
          { path: "freeItems.item", select: "name category" },
        ],
      });

    if (!response) {
      return { error: "Order not found" };
    }

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getOrderService;
