const { Expo } = require("expo-server-sdk");
const User = require("../../models/User");
const Setting = require("../../models/Setting");

const DEFAULT_BIRTHDAY_TIMEZONE =
  String(process.env.BIRTHDAY_NOTIFICATION_TIMEZONE || "America/Toronto")
    .trim() || "America/Toronto";

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toNonNegativeInteger = (value, fallback = 0) => {
  const parsed = Math.floor(toSafeNumber(value, fallback));
  return parsed >= 0 ? parsed : fallback;
};

const resolveDate = (value = new Date()) => {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
};

const resolveTimezone = (timezone) => {
  const candidate = String(timezone || DEFAULT_BIRTHDAY_TIMEZONE).trim();
  if (!candidate) return "UTC";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch (error) {
    return "UTC";
  }
};

const getDatePartsInTimezone = (value = new Date(), timezone) => {
  const targetDate = resolveDate(value);
  const safeTimezone = resolveTimezone(timezone);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(targetDate);
  const year = Number(parts.find((part) => part.type === "year")?.value || 0);
  const month = String(parts.find((part) => part.type === "month")?.value || "");
  const day = String(parts.find((part) => part.type === "day")?.value || "");

  return { year, month, day, timezone: safeTimezone };
};

const hasDateOfBirth = (user) => {
  if (!user?.date_of_birth) return false;
  const birthDate = new Date(user.date_of_birth);
  return !Number.isNaN(birthDate.getTime());
};

const getBirthMonthDay = (value) => {
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) {
    return { month: "", day: "" };
  }

  return {
    month: String(birthDate.getUTCMonth() + 1).padStart(2, "0"),
    day: String(birthDate.getUTCDate()).padStart(2, "0"),
  };
};

const getBirthdayBenefitSummary = (user, referenceDate = new Date(), options = {}) => {
  const timezone = resolveTimezone(options.timezone);
  const nowParts = getDatePartsInTimezone(referenceDate, timezone);
  const cycleYear = toNonNegativeInteger(nowParts.year, new Date().getUTCFullYear());
  const userCycleYear = toNonNegativeInteger(user?.birthdayFreeItemCycleYear, 0);
  const freeItemUsedCountRaw = toNonNegativeInteger(
    user?.birthdayFreeItemUsedCount,
    0,
  );
  const freeItemUsedCount =
    userCycleYear === cycleYear ? freeItemUsedCountRaw : 0;
  const freeItemRemaining = Math.max(0, 1 - freeItemUsedCount);
  const hasBirthDate = hasDateOfBirth(user);

  let isBirthdayToday = false;
  if (hasBirthDate) {
    const birthParts = getBirthMonthDay(user.date_of_birth);
    isBirthdayToday =
      birthParts.month === nowParts.month && birthParts.day === nowParts.day;
  }

  return {
    hasDateOfBirth: hasBirthDate,
    isBirthdayToday,
    cycleYear,
    freeItemUsedCount,
    freeItemRemaining,
    canClaimFreeItem: hasBirthDate && isBirthdayToday && freeItemRemaining > 0,
    timezone,
  };
};

const ensureUserBirthdayCycle = (user, referenceDate = new Date(), options = {}) => {
  if (!user) {
    return getBirthdayBenefitSummary(null, referenceDate, options);
  }

  const summary = getBirthdayBenefitSummary(user, referenceDate, options);
  const currentCycleYear = toNonNegativeInteger(user.birthdayFreeItemCycleYear, 0);
  if (currentCycleYear !== summary.cycleYear) {
    user.birthdayFreeItemCycleYear = summary.cycleYear;
    user.birthdayFreeItemUsedCount = 0;
  } else if (!Number.isFinite(Number(user.birthdayFreeItemUsedCount))) {
    user.birthdayFreeItemUsedCount = 0;
  }

  if (!Number.isFinite(Number(user.birthdayLastNotificationYear))) {
    user.birthdayLastNotificationYear = 0;
  }

  return summary;
};

const applyConfirmedOrderBirthdayBenefits = async (order) => {
  if (!order?.birthdayBenefits?.isApplied) return null;
  if (!order?.confirmed && !order?.payment_status) return null;

  const userId = order?.user?._id || order?.user;
  if (!userId) return null;

  const user = await User.findById(userId);
  if (!user) return null;

  const fallbackSummary = getBirthdayBenefitSummary(user, new Date());
  const cycleYear = toNonNegativeInteger(
    order?.birthdayBenefits?.cycleYear,
    fallbackSummary.cycleYear,
  );

  if (toNonNegativeInteger(user.birthdayFreeItemCycleYear, 0) !== cycleYear) {
    user.birthdayFreeItemCycleYear = cycleYear;
    user.birthdayFreeItemUsedCount = 0;
  }

  user.birthdayFreeItemUsedCount = Math.max(
    1,
    toNonNegativeInteger(user.birthdayFreeItemUsedCount, 0),
  );

  await user.save();
  return user;
};

const resolveBirthdayConfiguredFreeItemName = async () => {
  try {
    const setting = await Setting.findOne()
      .select("birthday.freeItemMenuItemName birthday.freeItemMenuItemId")
      .populate("birthday.freeItemMenuItemId", "name")
      .lean();
    const fromSetting = String(setting?.birthday?.freeItemMenuItemName || "")
      .trim();
    if (fromSetting) return fromSetting;
    const fromMenuItem = String(
      setting?.birthday?.freeItemMenuItemId?.name || "",
    ).trim();
    if (fromMenuItem) return fromMenuItem;
    return "";
  } catch (error) {
    return "";
  }
};

const buildBirthdayPushBody = (name, freeItemName = "") => {
  const cleanName = String(name || "").trim();
  const firstName = cleanName ? cleanName.split(/\s+/).filter(Boolean)[0] : "";
  const giftLabel = String(freeItemName || "").trim();
  const giftPart = giftLabel
    ? `ton cadeau gratuit du jour: ${giftLabel}.`
    : "profitez d'un article gratuit aujourd'hui.";
  if (firstName) {
    return `Joyeux anniversaire ${firstName}, ${giftPart}`;
  }
  return `Joyeux anniversaire, ${giftPart}`;
};

const sendBirthdayPushNotificationsForToday = async (options = {}) => {
  const now = resolveDate(options.referenceDate);
  const timezone = resolveTimezone(options.timezone);
  const currentCycleYear = toNonNegativeInteger(
    getDatePartsInTimezone(now, timezone).year,
    new Date().getUTCFullYear(),
  );

  const users = await User.find({
    date_of_birth: { $ne: null },
    expo_token: { $exists: true, $nin: ["", null] },
    birthdayLastNotificationYear: { $ne: currentCycleYear },
  }).select(
    "_id name expo_token date_of_birth birthdayLastNotificationYear birthdayFreeItemCycleYear birthdayFreeItemUsedCount",
  );

  const eligibleUsers = users.filter((user) => {
    const summary = getBirthdayBenefitSummary(user, now, { timezone });
    return summary.canClaimFreeItem;
  });
  const configuredFreeItemName = await resolveBirthdayConfiguredFreeItemName();

  if (!eligibleUsers.length) {
    return {
      checkedUsers: users.length,
      eligibleUsers: 0,
      sentCount: 0,
      timezone,
      cycleYear: currentCycleYear,
    };
  }

  const expo = new Expo({ useFcmV1: true });
  const messages = [];
  const userIds = [];

  for (const user of eligibleUsers) {
    if (!Expo.isExpoPushToken(user.expo_token)) continue;
    messages.push({
      to: user.expo_token,
      sound: "default",
      title: "Joyeux anniversaire",
      body: buildBirthdayPushBody(user.name, configuredFreeItemName),
      priority: "high",
      data: {
        type: "birthday_free_item",
        freeItemName: configuredFreeItemName || "",
      },
    });
    userIds.push(String(user._id));
  }

  if (!messages.length) {
    return {
      checkedUsers: users.length,
      eligibleUsers: eligibleUsers.length,
      sentCount: 0,
      timezone,
      cycleYear: currentCycleYear,
    };
  }

  const chunks = expo.chunkPushNotifications(messages);
  const sentUserIds = [];
  let cursor = 0;

  for (const chunk of chunks) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    for (let i = 0; i < tickets.length; i += 1) {
      if (tickets[i]?.status === "ok") {
        const userId = userIds[cursor + i];
        if (userId) {
          sentUserIds.push(userId);
        }
      }
    }
    cursor += chunk.length;
  }

  if (sentUserIds.length) {
    await User.updateMany(
      { _id: { $in: sentUserIds } },
      {
        $set: {
          birthdayLastNotificationYear: currentCycleYear,
          birthdayFreeItemCycleYear: currentCycleYear,
        },
      },
    );
  }

  return {
    checkedUsers: users.length,
    eligibleUsers: eligibleUsers.length,
    sentCount: sentUserIds.length,
    timezone,
    cycleYear: currentCycleYear,
  };
};

module.exports = {
  DEFAULT_BIRTHDAY_TIMEZONE,
  getBirthdayBenefitSummary,
  ensureUserBirthdayCycle,
  applyConfirmedOrderBirthdayBenefits,
  sendBirthdayPushNotificationsForToday,
};
