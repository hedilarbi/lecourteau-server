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
  formatSmartOfferExpiry,
  buildSmartOfferNotificationBody,
};
