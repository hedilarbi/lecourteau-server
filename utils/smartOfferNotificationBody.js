const QUEBEC_TIME_ZONE = "America/Toronto";

const quebecDateTimeFormatter = new Intl.DateTimeFormat("fr-CA", {
  timeZone: QUEBEC_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const quebecDatePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: QUEBEC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const getQuebecDateParts = (date) => Object.fromEntries(
  quebecDatePartsFormatter
    .formatToParts(date)
    .filter(({ type }) => type !== "literal")
    .map(({ type, value }) => [type, Number(value)]),
);

const endOfQuebecDay = (date) => {
  const targetDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(targetDate.getTime())) return null;

  const { year, month, day } = getQuebecDateParts(targetDate);
  const targetAsUtc = Date.UTC(year, month - 1, day, 23, 59, 59);
  let utcGuess = targetAsUtc;

  // Convert the Quebec wall-clock time to its UTC instant. Re-evaluating the
  // offset makes this work on both sides of daylight-saving time changes.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = getQuebecDateParts(new Date(utcGuess));
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const correction = targetAsUtc - actualAsUtc;
    utcGuess += correction;
    if (correction === 0) break;
  }

  return new Date(utcGuess + 999);
};

const calculateSmartOfferValidUntil = (validFrom, validityHours) => {
  const start = validFrom instanceof Date ? validFrom : new Date(validFrom);
  const hours = Number(validityHours);
  if (Number.isNaN(start.getTime()) || !Number.isFinite(hours) || hours <= 0) {
    return null;
  }

  const nominalExpiry = new Date(start.getTime() + hours * 3600000);
  return endOfQuebecDay(nominalExpiry);
};

const formatSmartOfferExpiry = (validUntil) => {
  const expiry = validUntil instanceof Date ? validUntil : new Date(validUntil);
  if (Number.isNaN(expiry.getTime())) return null;

  return quebecDateTimeFormatter.format(expiry);
};

const buildSmartOfferNotificationBody = (body, validUntil) => {
  const originalBody = String(body || "").trim();
  const formattedExpiry = formatSmartOfferExpiry(validUntil);
  if (!formattedExpiry) return originalBody;

  const expiryLine = `Offre valide jusqu’au ${formattedExpiry}.`;
  if (originalBody.includes(expiryLine)) return originalBody;

  return originalBody ? `${originalBody}\n${expiryLine}` : expiryLine;
};

module.exports = {
  QUEBEC_TIME_ZONE,
  calculateSmartOfferValidUntil,
  endOfQuebecDay,
  formatSmartOfferExpiry,
  buildSmartOfferNotificationBody,
};
