const { Expo } = require("expo-server-sdk");
const { default: mongoose } = require("mongoose");
const sendNotificationsService = require("../services/notificationService.js/sendNotificationsService");
const client = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
require("dotenv/config");

const sendNotifications = async (req, res) => {
  const { title, body } = req.body;

  try {
    const { error } = await sendNotificationsService(title, body);
    if (error) {
      return res.json({ status: false, message: error.message });
    }
    res.json({ status: true, message: "Notifications sent" });
  } catch (err) {
    res.json({ status: false, message: err.message });
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
        console.error(error.message);
        failedRequests.push(recipient);
      }
    }
    res.json({ status: true });
  } catch (err) {
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
