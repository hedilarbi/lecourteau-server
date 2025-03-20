const { default: mongoose } = require("mongoose");
const sendNotificationsService = require("../services/notificationService.js/sendNotificationsService");
const { default: Expo } = require("expo-server-sdk");
const client = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
require("dotenv/config");

const sendNotifications = async (req, res) => {
  const { title, body, item } = req.body;

  try {
    // Respond immediately to the client
    res.json({
      status: true,
      message: "Notifications are being sent in the background",
    });

    let messages = [];
    let expo = new Expo();
    const users = await mongoose.models.User.find();

    const usersTokens = users.map((user) => user.expo_token);

    for (let pushToken of usersTokens) {
      if (!Expo.isExpoPushToken(pushToken)) {
        continue;
      }
      if (item) {
        messages.push({
          to: pushToken,
          sound: "default",
          body,
          title,
          data: { item },
          priority: "high",
        });
      } else {
        messages.push({
          to: pushToken,
          sound: "default",
          body,
          title,
          priority: "high",
        });
      }
    }

    let chunks = expo.chunkPushNotifications(messages);
    let tickets = [];

    for (let chunk of chunks) {
      try {
        let ticketChunk = await expo.sendPushNotificationsAsync(chunk);

        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("Error sending chunk:", error);
      }
    }

    console.log("Finished sending notifications");
  } catch (err) {
    console.error("Error sending notifications:", err);
    res.status(500).json({ status: false, message: err.message });
  }
};

const sendSMSs = async (req, res) => {
  const { body } = req.body;

  const failedRequests = [];
  let recipients = [];
  try {
    const users = await mongoose.models.User.find();
    recipients = users.map((user) => user.phone_number);
    for (const recipient of recipients) {
      try {
        await client.messages.create({
          to: recipient,
          messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
          body,
        });
      } catch (error) {
        failedRequests.push(recipient);
      }
    }
    res.json({ status: true });
  } catch (err) {
    console.error("Error sending SMSs:", err);
    res.json({ status: false, message: err.message });
  }
  // if (failedRequests.length > 0) {
  //     const errorMessage = `${failedRequests.length} message(s) could not be sent, please check your Twilio logs for more information`;
  //     return { message: '', error: new Error(errorMessage) };
  // }

  // const successMessage = `${request.recipients.length} message(s) sent successfully`;
  // return { message: successMessage, error: null };
};

const testNotification = async (req, res) => {
  try {
    const user = await mongoose.models.User.findOne({
      phone_number: "+18196929494",
    });
    const expo = new Expo({ useFcmV1: true });
    const userMessage = {
      to: user.expo_token,
      sound: "default",
      body: `Bienvenue chez Le Courteau ! Votre commande a été confirmée et est en cours de préparation, vous avez remporté ${10} points de fidélité.`,
      data: { order_id: "1234" },
      title: "Commande confirmée",
      priority: "high",
    };

    if (user.expo_token) {
      const response = await expo.sendPushNotificationsAsync([userMessage]);
    }
    res.json({ status: true });
  } catch (err) {
    console.error("Error sending notifications:", err);
    res.status(500).json({ status: false, message: err.message });
  }
};

module.exports = { sendNotifications, sendSMSs, testNotification };
