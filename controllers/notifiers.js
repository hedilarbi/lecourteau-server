const { default: mongoose } = require("mongoose");
const sendNotificationsService = require("../services/notificationService.js/sendNotificationsService");
const { default: Expo } = require("expo-server-sdk");
const client = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
require("dotenv/config");

const sendNotifications = async (req, res) => {
  const { title, body } = req.body;
  console.log("title", title);
  try {
    let messages = [];
    let expo = new Expo();
    const users = await mongoose.models.User.find();
    console.log("users");
    const usersTokens = users.map((user) => user.expo_token);
    console.log("usersTokens", usersTokens.length);
    for (let pushToken of usersTokens) {
      if (!Expo.isExpoPushToken(pushToken)) {
        return { error: `invalid notification token` };
      }

      messages.push({
        to: pushToken,
        sound: "default",
        body,
        title,
      });
    }
    let chunks = expo.chunkPushNotifications(messages);
    let tickets = [];
    console.log("chunks");
    for (let chunk of chunks) {
      let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      console.log("ticketChunk");
      tickets.push(...ticketChunk);
    }
    console.log("tickets");
    res.json({ status: true, message: "notifications sent" });
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

module.exports = { sendNotifications, sendSMSs };
