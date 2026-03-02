const cron = require("node-cron");
const {
  DEFAULT_BIRTHDAY_TIMEZONE,
  sendBirthdayPushNotificationsForToday,
} = require("../services/birthdayServices/birthdayBenefitsService");

function startBirthdayNotificationsJob() {
  // Toutes les heures: on envoie la notification une seule fois par année/user.
  cron.schedule(
    "0 * * * *",
    async () => {
      try {
        const result = await sendBirthdayPushNotificationsForToday();
        if (result?.sentCount > 0) {
          console.log(
            `[birthdayNotificationsJob] ${result.sentCount} notification(s) envoyée(s)`,
          );
        }
      } catch (error) {
        console.error("[birthdayNotificationsJob] error:", error);
      }
    },
    {
      timezone: DEFAULT_BIRTHDAY_TIMEZONE,
    },
  );
}

module.exports = {
  startBirthdayNotificationsJob,
};
