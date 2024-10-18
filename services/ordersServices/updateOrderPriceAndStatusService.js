const { default: Expo } = require("expo-server-sdk");
const { default: mongoose } = require("mongoose");
const { IN_DELIVERY, DELIVERED } = require("../../utils/constants");
const Order = require("../../models/Order");

const updateOrderPriceAndStatusService = async (id, status, price) => {
  try {
    // Update the order's price and status
    const response = await Order.findByIdAndUpdate(
      id,
      { status, total_price: parseFloat(price) },
      { new: true }
    );

    // Check if the order was found
    if (!response) {
      return { error: "Order not found" };
    }

    // Find the associated user
    const user = await mongoose.models.User.findById(response.user);
    if (!user) {
      return { error: "User not found for the order" };
    }

    // Send a notification if the status is IN_DELIVERY or DELIVERED
    if (status === IN_DELIVERY || status === DELIVERED) {
      const expo_token = user.expo_token;
      if (expo_token) {
        const expo = new Expo();

        const message = {
          to: expo_token,
          sound: "default",
          body:
            status === IN_DELIVERY
              ? "Votre commande est en cours de livraison"
              : "Bon appétit!",
          data: { order_id: id },
          priority: "high",
        };

        await expo.sendPushNotificationsAsync([message]);
      } else {
        console.warn("No expo token found for user, notification not sent.");
      }
    }

    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};
module.exports = updateOrderPriceAndStatusService;
