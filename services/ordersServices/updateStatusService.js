const { default: Expo } = require("expo-server-sdk");
const { default: mongoose } = require("mongoose");
const {
  IN_DELIVERY,
  DELIVERED,
  READY,
  SCHEDULED,
  CANCELED,
} = require("../../utils/constants");
const {
  restoreSplitDiscountStepOnCancel,
} = require("./restoreSmartOfferOnCancelService");
const Order = require("../../models/Order");

const updateStatusService = async (id, status) => {
  try {
    const existingOrder = await Order.findById(id).select("scheduled user");
    if (!existingOrder) {
      return { error: "Order not found" };
    }

    const update = { status };
    if (existingOrder?.scheduled?.isScheduled) {
      update["scheduled.processed"] = status !== SCHEDULED;
    }

    const response = await Order.findByIdAndUpdate(id, update, { new: true });

    // Une annulation côté restaurant doit rendre au client l'étape de rabais
    // divisé que la création de la commande avait déjà consommée.
    if (status === CANCELED) {
      await restoreSplitDiscountStepOnCancel(response).catch(() => {});
    }

    const user = await mongoose.models.User.findById(response.user);

    // Check if the status matches the conditions and send notifications
    if ([IN_DELIVERY, DELIVERED, READY].includes(status)) {
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

      const pushMessage = {
        to: expo_token,
        sound: "default",
        body: message,
        data: {
          order_id: id,
        },
        priority: "high",
      };

      if (expo_token && expo_token.length > 0) {
        await expo.sendPushNotificationsAsync([pushMessage]);
      }
    }

    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updateStatusService;
