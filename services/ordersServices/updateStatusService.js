const { default: Expo } = require("expo-server-sdk");
const { default: mongoose } = require("mongoose");
const { IN_DELIVERY, DELIVERED, READY } = require("../../utils/constants");
const Order = require("../../models/Order");

const updateStatusService = async (id, status) => {
  try {
    const response = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    const user = await mongoose.models.User.findById(response.user);

    if (status === IN_DELIVERY || status === DELIVERED || status === READY) {
      let message = "";
      if (status === IN_DELIVERY) {
        message = `Votre commande est en cours de livraison`;
      } else if (status === DELIVERED) {
        message = `Votre commande a été livrée, bon appétit!`;
      } else if (status === READY) {
        message = `Votre commande est prête`;
      }
      const expo_token = user.expo_token;
      const expo = new Expo();

      message = {
        to: expo_token,
        sound: "default",
        body: message,
        data: {
          order_id: id,
        },

        priority: "high",
      };

      const ticket = await expo.sendPushNotificationsAsync([message]);
    }
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updateStatusService;
