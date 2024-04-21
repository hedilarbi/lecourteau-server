const Staff = require("../../models/staff");
const { Expo } = require("expo-server-sdk");
const mongoose = require("mongoose");
const affectOrderToStaffService = async (orderId, id) => {
  try {
    const staff = await Staff.findById(id);

    const order = await mongoose.models.Order.findByIdAndUpdate(
      orderId,
      {
        delivery_by: id,
      },
      { new: true }
    );

    staff.orders.push(orderId);
    staff.is_available = false;
    await staff.save();

    const expo = new Expo();
    const message = {
      to: staff.expo_token,
      sound: "default",
      body: `
     Vous avez une nouvelle commande à livrer`,

      data: {
        order_id: orderId,
      },
      title: "Nouvelle Commande",
      priority: "high",
    };

    if (staff.expo_token.length > 0) {
      await expo.sendPushNotificationsAsync([message]);
    }
    return { response: true };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  affectOrderToStaffService,
};
