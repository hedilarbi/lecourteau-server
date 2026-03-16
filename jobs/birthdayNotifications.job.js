const cron = require("node-cron");
const {
  DEFAULT_BIRTHDAY_TIMEZONE,
  sendBirthdayPushNotificationsForToday,
} = require("../services/birthdayServices/birthdayBenefitsService");

const DEFAULT_BIRTHDAY_NOTIFICATION_START_HOUR = Number.isFinite(
  Number(process.env.BIRTHDAY_NOTIFICATION_START_HOUR),
)
  ? Math.min(
      23,
      Math.max(0, Math.floor(Number(process.env.BIRTHDAY_NOTIFICATION_START_HOUR))),
    )
  : 11;

const getHourInTimezone = (date, timezone) => {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hour12: false,
      hour: "2-digit",
    });
    const parts = formatter.formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value || "0");
    if (!Number.isFinite(hour)) return 0;
    return hour;
  } catch (error) {
    return date.getUTCHours();
  }
};

function startBirthdayNotificationsJob() {
  // Toutes les heures à partir de 11:00 (heure Québec par défaut).
  cron.schedule(
    "0 * * * *",
    async () => {
      try {
        const currentHourInTimezone = getHourInTimezone(
          new Date(),
          DEFAULT_BIRTHDAY_TIMEZONE,
        );
        if (currentHourInTimezone < DEFAULT_BIRTHDAY_NOTIFICATION_START_HOUR) {
          return;
        }

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

  console.log(
    `[birthdayNotificationsJob] scheduled hourly from ${String(
      DEFAULT_BIRTHDAY_NOTIFICATION_START_HOUR,
    ).padStart(2, "0")}:00 (${DEFAULT_BIRTHDAY_TIMEZONE})`,
  );
}

module.exports = {
  startBirthdayNotificationsJob,
};
