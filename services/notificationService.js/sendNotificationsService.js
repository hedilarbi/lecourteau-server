const { default: Expo } = require("expo-server-sdk");
const { default: mongoose } = require("mongoose");

const sendNotificationsService = async (title, body) => {
  try {
    let messages = [];
    let expo = new Expo();
    const users = await mongoose.models.User.find();
    const usersTokens = users.map((user) => user.expo_token);
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
    for (let chunk of chunks) {
      let ticketChunk = await expo.sendPushNotificationsAsync(chunk);

      tickets.push(...ticketChunk);
    }
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = sendNotificationsService;
