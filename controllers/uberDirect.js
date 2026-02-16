const crypto = require("crypto");
const {
  getUberDirectAccessTokenService,
} = require("../services/uberDirectServices/getAccessTokenService");
const {
  uberDirectRequest,
} = require("../services/uberDirectServices/uberDirectRequest");
const updateStatusService = require("../services/ordersServices/updateStatusService");
const Restaurant = require("../models/Restaurant");
const Order = require("../models/Order");
const {
  getAddressFromCoords,
} = require("../services/uberDirectServices/geocodeService");
const {
  DELIVERED,
  PICKEDUP,
  IN_DELIVERY,
  ON_GOING,
} = require("../utils/constants");
const ORG_SCOPE = process.env.UBER_DIRECT_ORG_SCOPE || "direct.organizations";
const WEBHOOK_TOLERANCE_SECONDS = Number(
  process.env.UBER_DIRECT_WEBHOOK_TOLERANCE_SECONDS || 300,
);
const UBER_DIRECT_WEBHOOK_LOGS =
  String(process.env.UBER_DIRECT_WEBHOOK_LOGS || "true")
    .toLowerCase()
    .trim() !== "false";

const logWebhook = (message, meta = {}) => {
  if (!UBER_DIRECT_WEBHOOK_LOGS) return;
  const timestamp = new Date().toISOString();
  if (meta && Object.keys(meta).length > 0) {
    console.log(
      `[UberDirectWebhook] ${timestamp} - ${message} ${JSON.stringify(meta)}`,
    );
    return;
  }
  console.log(`[UberDirectWebhook] ${timestamp} - ${message}`);
};

const logWebhookError = (message, error, meta = {}) => {
  if (!UBER_DIRECT_WEBHOOK_LOGS) return;
  const timestamp = new Date().toISOString();
  const payload = {
    ...meta,
    error: error?.message || String(error),
    stack: error?.stack,
  };
  console.error(
    `[UberDirectWebhook] ${timestamp} - ${message} ${JSON.stringify(payload)}`,
  );
};

const getUberDirectAccessToken = async (req, res) => {
  try {
    const scope = req.body?.scope || req.query?.scope;
    const {
      token,
      tokenType,
      scope: tokenScope,
      expiresAt,
      expiresIn,
      source,
      error,
      details,
    } = await getUberDirectAccessTokenService({ scope });

    if (error) {
      return res.status(500).json({
        success: false,
        message: error,
        details,
      });
    }

    return res.status(200).json({
      success: true,
      access_token: token,
      token_type: tokenType,
      scope: tokenScope,
      expires_at: expiresAt,
      expires_in: expiresIn,
      source,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const getRestaurantCustomerId = async (restaurantId) => {
  const restaurant = await Restaurant.findById(restaurantId).select(
    "uberCustomerId name phone_number address location",
  );

  if (!restaurant) {
    return { error: "Restaurant introuvable." };
  }
  if (!restaurant.uberCustomerId) {
    return {
      error: "Identifiant client Uber Direct manquant pour ce restaurant.",
    };
  }
  return { restaurant, customerId: restaurant.uberCustomerId };
};

const getOrderForUber = async (orderId) => {
  const order = await Order.findById(orderId)
    .populate("user", "name phone_number")
    .populate("orderItems.item", "name")
    .populate("offers.offer", "name");

  if (!order) {
    return { error: "Commande introuvable." };
  }
  if (!order.restaurant) {
    return { error: "Restaurant introuvable pour cette commande." };
  }
  if (!order.user) {
    return { error: "Client introuvable pour cette commande." };
  }
  return { order };
};

const normalizePhone = (value) => {
  if (!value) return value;
  const trimmed = String(value).trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("+")) return trimmed;
  if (/^\d+$/.test(trimmed)) return `+${trimmed}`;
  return trimmed;
};

const normalizeText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const normalizeCountryCode = (value) => {
  const raw = normalizeText(value);
  if (!raw) return "";

  const upper = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;

  const aliases = {
    USA: "US",
    US: "US",
    "UNITED STATES": "US",
    "UNITED STATES OF AMERICA": "US",
    CANADA: "CA",
    CA: "CA",
    "CANADA (CA)": "CA",
  };

  return aliases[upper] || upper;
};

const toCents = (value) => {
  if (value === null || value === undefined) return undefined;
  const number = Number(value);
  if (Number.isNaN(number)) return undefined;
  return Math.max(0, Math.round(number * 100));
};

const buildAddress = ({ street, city, state, postal_code, country }) => {
  const streetAddress = [];
  if (Array.isArray(street)) {
    street.forEach((line) => {
      const normalized = normalizeText(line);
      if (normalized) streetAddress.push(normalized);
    });
  } else {
    const normalizedStreet = normalizeText(street);
    if (normalizedStreet) streetAddress.push(normalizedStreet);
  }
  if (!streetAddress.length) return null;

  const address = {
    street_address: streetAddress,
  };
  const normalizedCity = normalizeText(city);
  const normalizedState = normalizeText(state);
  const normalizedPostalCode = normalizeText(postal_code);
  const normalizedCountry = normalizeCountryCode(country);
  if (normalizedCity) address.city = normalizedCity;
  if (normalizedState) address.state = normalizedState;
  if (normalizedPostalCode) address.zip_code = normalizedPostalCode;
  if (normalizedCountry) address.country = normalizedCountry;
  return address;
};

const buildPickupAddressFromRestaurant = (restaurant) =>
  buildAddress({
    street: restaurant.address,
    city: restaurant.city,
    state: restaurant.state,
    postal_code: restaurant.postal_code,
    country: restaurant.country,
  });

const buildDropoffAddressFromOrder = (order) => {
  const detailed = order.detailed_address || {};
  return buildAddress({
    street: detailed.street_address || order.address,
    city: detailed.city,
    state: detailed.state,
    postal_code: detailed.postal_code,
    country: detailed.country,
  });
};

const buildManifestItems = (order) => {
  const items = [];

  (order.orderItems || []).forEach((orderItem) => {
    const name = orderItem.item?.name || "Item";
    items.push(
      compactObject({
        name,
        quantity: 1,
      }),
    );
  });

  (order.offers || []).forEach((offerItem) => {
    const name = offerItem.offer?.name || "Offer";
    items.push(
      compactObject({
        name,
        quantity: 1,
      }),
    );
  });

  if (!items.length) {
    items.push(
      compactObject({
        name: "Order",
        quantity: 1,
        price: toCents(order.sub_total || order.total_price || 0),
      }),
    );
  }

  return items;
};

const compactObject = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  );

const isIncompleteAddress = (address) => {
  if (!address) return true;
  return (
    !address.street_address ||
    !address.city ||
    !address.state ||
    !address.zip_code ||
    !address.country
  );
};

const stringifyAddressFields = (payload = {}) => {
  const next = { ...payload };
  ["pickup_address", "dropoff_address"].forEach((field) => {
    if (next[field] && typeof next[field] === "object") {
      next[field] = JSON.stringify(next[field]);
    }
  });
  return next;
};

const toLowerText = (value) => String(value || "").toLowerCase();

const getUberErrorCode = (details) => {
  if (!details || typeof details !== "object") return null;
  return (
    details.code ||
    details.error_code ||
    details?.error?.code ||
    details?.details?.code ||
    null
  );
};

const translateUberErrorMessage = ({ status, error, details }) => {
  const code = toLowerText(getUberErrorCode(details));
  const text = toLowerText(
    [error, details?.message, details?.error, details?.description]
      .filter(Boolean)
      .join(" | "),
  );

  if (code === "address_undeliverable_limited_couriers") {
    return "Aucun livreur Uber n'est disponible pour cette adresse pour le moment.";
  }
  if (code === "customer_limited") {
    return "Le compte Uber Direct du restaurant est temporairement limité.";
  }

  if (
    text.includes("location was not understood") ||
    text.includes("invalid address") ||
    text.includes("address")
  ) {
    return "Adresse de ramassage ou de livraison invalide.";
  }
  if (text.includes("phone")) {
    return "Numéro de téléphone invalide pour la livraison.";
  }
  if (text.includes("quote")) {
    return "Le devis Uber Direct est invalide ou expiré.";
  }
  if (text.includes("manifest")) {
    return "Le détail de la commande est invalide pour Uber Direct.";
  }
  if (text.includes("customer")) {
    return "Identifiant client Uber Direct invalide pour ce restaurant.";
  }

  if (status === 400) {
    return "Les informations envoyées à Uber Direct sont invalides.";
  }
  if (status === 401) {
    return "Authentification Uber Direct invalide. Veuillez réessayer.";
  }
  if (status === 403) {
    return "Accès refusé par Uber Direct.";
  }
  if (status === 404) {
    return "Ressource Uber Direct introuvable.";
  }
  if (status === 409) {
    return "Conflit Uber Direct: cette livraison ne peut pas être créée ou mise à jour.";
  }
  if (status === 422) {
    return "Impossible de créer la livraison Uber: données de livraison invalides.";
  }
  if (status === 429) {
    return "Trop de requêtes vers Uber Direct. Veuillez réessayer dans quelques secondes.";
  }
  if (status >= 500) {
    return "Service Uber Direct temporairement indisponible.";
  }

  return "Erreur Uber Direct. Veuillez réessayer.";
};

const sendUberResponse = (res, result) => {
  if (result.error) {
    const translatedMessage = translateUberErrorMessage({
      status: result.status,
      error: result.error,
      details: result.details,
    });
    const details =
      result.details && typeof result.details === "object"
        ? { ...result.details, uber_message: result.error }
        : result.details;

    return res.status(result.status || 500).json({
      success: false,
      message: translatedMessage,
      details,
    });
  }
  return res.status(result.status || 200).json({
    success: true,
    data: result.response,
  });
};

const getHeaderValue = (req, ...names) => {
  for (const name of names) {
    const value = req.headers?.[name];
    if (Array.isArray(value)) return value[0];
    if (typeof value === "string" && value.length) return value;
  }
  return null;
};

const normalizeSignature = (value = "") =>
  String(value)
    .trim()
    .replace(/^sha256=/i, "")
    .trim();

const parseSignatureCandidates = (headerValue) => {
  if (!headerValue) return [];

  const parts = String(headerValue)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!parts.length) return [];

  const parsed = [];
  for (const part of parts) {
    if (!part.includes("=")) {
      parsed.push(part);
      continue;
    }
    const separatorIndex = part.indexOf("=");
    const key = part.slice(0, separatorIndex);
    const value = part.slice(separatorIndex + 1);
    const normalizedKey = (key || "").trim().toLowerCase();
    if (["v1", "signature", "sig", "hmac"].includes(normalizedKey)) {
      parsed.push(value);
    }
  }

  if (!parsed.length && parts.length === 1) {
    parsed.push(parts[0]);
  }

  return parsed.map(normalizeSignature).filter(Boolean);
};

const timingSafeEqual = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const buildWebhookPayloadCandidates = (rawBody, timestamp) => {
  const candidates = [rawBody];
  if (timestamp) {
    candidates.unshift(`${timestamp}.${rawBody}`);
  }
  return candidates;
};

const buildExpectedSignatures = (signingKey, payloadCandidates) => {
  const signatures = [];

  payloadCandidates.forEach((payload) => {
    const hex = crypto
      .createHmac("sha256", signingKey)
      .update(payload)
      .digest("hex");
    const base64 = crypto
      .createHmac("sha256", signingKey)
      .update(payload)
      .digest("base64");
    signatures.push(hex, `sha256=${hex}`, base64, `sha256=${base64}`);
  });

  return signatures;
};

const isTimestampValid = (timestampHeader) => {
  if (!timestampHeader) return true;
  const parsed = Number(timestampHeader);
  if (!Number.isFinite(parsed)) return false;

  const timestampMs = parsed > 1e12 ? parsed : parsed * 1000;
  const skew = Math.abs(Date.now() - timestampMs);
  return skew <= WEBHOOK_TOLERANCE_SECONDS * 1000;
};

const verifyWebhookSignature = (req, rawPayload) => {
  const shouldVerify =
    String(process.env.UBER_DIRECT_WEBHOOK_VERIFY_SIGNATURE || "true")
      .toLowerCase()
      .trim() !== "false";
  if (!shouldVerify) return { ok: true };

  const signingKey = process.env.UBER_DIRECT_WEBHOOK_SIGNING_KEY;
  if (!signingKey) {
    return {
      ok: false,
      status: 500,
      message: "Missing UBER_DIRECT_WEBHOOK_SIGNING_KEY.",
    };
  }

  const signatureHeader = getHeaderValue(
    req,
    "x-postmates-signature",
    "x-uber-signature",
  );
  if (!signatureHeader) {
    return {
      ok: false,
      status: 401,
      message: "Missing webhook signature header.",
    };
  }

  const timestampHeader = getHeaderValue(
    req,
    "x-postmates-timestamp",
    "x-uber-timestamp",
  );
  if (timestampHeader && !isTimestampValid(timestampHeader)) {
    return {
      ok: false,
      status: 401,
      message: "Webhook timestamp is invalid or expired.",
    };
  }

  const providedSignatures = parseSignatureCandidates(signatureHeader);
  if (!providedSignatures.length) {
    return {
      ok: false,
      status: 401,
      message: "Invalid webhook signature header format.",
    };
  }

  const payloadCandidates = buildWebhookPayloadCandidates(
    rawPayload,
    timestampHeader,
  );
  const expectedSignatures = buildExpectedSignatures(
    signingKey,
    payloadCandidates,
  );

  const valid = providedSignatures.some((provided) =>
    expectedSignatures.some((expected) => timingSafeEqual(provided, expected)),
  );

  if (!valid) {
    return {
      ok: false,
      status: 401,
      message: "Webhook signature verification failed.",
    };
  }

  return { ok: true };
};

const extractDeliveryIdFromPayload = (payload = {}) =>
  payload?.meta?.resource_id ||
  payload?.meta?.delivery_id ||
  payload?.delivery_id ||
  payload?.id ||
  payload?.data?.delivery_id ||
  payload?.data?.id ||
  payload?.event_data?.delivery_id ||
  null;

const extractQuoteIdFromPayload = (payload = {}) =>
  payload?.quote_id ||
  payload?.id ||
  payload?.data?.quote_id ||
  payload?.data?.id ||
  payload?.meta?.quote_id ||
  null;

const extractUberStatusFromPayload = (payload = {}) =>
  payload?.meta?.status ||
  payload?.status ||
  payload?.data?.status ||
  payload?.event_data?.status ||
  null;

const extractTrackingUrlFromPayload = (payload = {}) =>
  payload?.meta?.tracking_url ||
  payload?.tracking_url ||
  payload?.data?.tracking_url ||
  payload?.event_data?.tracking_url ||
  null;

const extractManifestReferenceFromPayload = (payload = {}) =>
  payload?.meta?.manifest_reference ||
  payload?.manifest_reference ||
  payload?.data?.manifest_reference ||
  payload?.data?.manifest?.reference ||
  payload?.event_data?.manifest_reference;

const extractCourierImminentFromPayload = (payload = {}) => {
  const rawValue =
    payload?.courier_imminent ??
    payload?.data?.courier_imminent ??
    payload?.meta?.courier_imminent;
  if (rawValue === undefined || rawValue === null) return undefined;
  if (typeof rawValue === "boolean") return rawValue;
  if (typeof rawValue === "string") {
    const normalized = rawValue.toLowerCase().trim();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
};

const buildWebhookLogMeta = (payload = {}) => ({
  event_id: payload?.id || null,
  event_type: payload?.kind || payload?.event_type || payload?.type || null,
  status: extractUberStatusFromPayload(payload),
  delivery_id: extractDeliveryIdFromPayload(payload),
  manifest_reference: extractManifestReferenceFromPayload(payload),
  created: payload?.created || payload?.meta?.created || null,
  courier_imminent:
    payload?.data?.courier_imminent ?? payload?.courier_imminent ?? null,
  live_mode: payload?.live_mode ?? payload?.data?.live_mode ?? null,
});

const parseIsoDateOrNull = (value) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
};

const normalizeUberStatus = (value) =>
  String(value || "")
    .toLowerCase()
    .trim();

const TRACKING_ALLOWED_DOMAINS = ["uber.com", "ubereats.com"];
const TRACKING_BLOCKED_HOST_KEYWORDS = [
  "merchant",
  "manager",
  "restaurant",
  "admin",
  "dispatch",
  "dashboard",
];

const sanitizeCustomerTrackingUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  try {
    const parsed = new URL(rawUrl);
    const protocol = String(parsed.protocol || "").toLowerCase();
    const hostname = String(parsed.hostname || "").toLowerCase();

    if (protocol !== "https:") return null;

    const isAllowedDomain = TRACKING_ALLOWED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
    if (!isAllowedDomain) return null;

    const isBlockedHost = TRACKING_BLOCKED_HOST_KEYWORDS.some((keyword) =>
      hostname.includes(keyword),
    );
    if (isBlockedHost) return null;

    return parsed.toString();
  } catch (error) {
    return null;
  }
};

const extractEventTimestamp = (payload = {}) =>
  parseIsoDateOrNull(
    payload?.created ||
      payload?.meta?.created ||
      payload?.event_data?.created ||
      payload?.data?.created,
  ) || new Date();

const isWebhookEventStale = (order, incomingTimestamp) => {
  const currentTimestamp = parseIsoDateOrNull(order?.uber_last_event_at);
  if (!currentTimestamp) return false;
  return incomingTimestamp.getTime() < currentTimestamp.getTime();
};

const isWebhookEventDuplicate = (
  order,
  incomingTimestamp,
  eventType,
  uberStatus,
  courierImminent,
) => {
  const currentTimestamp = parseIsoDateOrNull(order?.uber_last_event_at);
  if (!currentTimestamp) return false;
  if (incomingTimestamp.getTime() !== currentTimestamp.getTime()) return false;

  const currentType = String(order?.uber_last_event_type || "").trim();
  const nextType = String(eventType || "").trim();
  const currentStatus = normalizeUberStatus(order?.uber_status);
  const nextStatus = normalizeUberStatus(uberStatus);
  const currentImminent =
    order?.uber_courier_imminent === undefined
      ? null
      : Boolean(order?.uber_courier_imminent);
  const nextImminent =
    courierImminent === undefined ? null : Boolean(courierImminent);

  return (
    currentType === nextType &&
    currentStatus === nextStatus &&
    currentImminent === nextImminent
  );
};

const extractEtaFieldsFromPayload = (payload = {}) =>
  compactObject({
    uber_pickup_eta: parseIsoDateOrNull(
      payload?.pickup_eta ||
        payload?.data?.pickup_eta ||
        payload?.meta?.pickup_eta,
    ),
    uber_dropoff_eta: parseIsoDateOrNull(
      payload?.dropoff_eta ||
        payload?.data?.dropoff_eta ||
        payload?.meta?.dropoff_eta,
    ),
    uber_pickup_ready: parseIsoDateOrNull(
      payload?.pickup_ready ||
        payload?.data?.pickup_ready ||
        payload?.meta?.pickup_ready,
    ),
    uber_pickup_deadline: parseIsoDateOrNull(
      payload?.pickup_deadline ||
        payload?.data?.pickup_deadline ||
        payload?.meta?.pickup_deadline,
    ),
    uber_dropoff_ready: parseIsoDateOrNull(
      payload?.dropoff_ready ||
        payload?.data?.dropoff_ready ||
        payload?.meta?.dropoff_ready,
    ),
    uber_dropoff_deadline: parseIsoDateOrNull(
      payload?.dropoff_deadline ||
        payload?.data?.dropoff_deadline ||
        payload?.meta?.dropoff_deadline,
    ),
  });

const mapUberStatusToOrderStatus = (uberStatus) => {
  const status = normalizeUberStatus(uberStatus);
  if (!status) return null;

  if (
    status === "pending" ||
    status === "pickup" ||
    status === "unassigned" ||
    status === "courier_assigned" ||
    status === "courier_imminent" ||
    status === "courier_at_pickup"
  ) {
    return ON_GOING;
  }
  if (
    status === "pickup_complete" ||
    status === "pickup_completed" ||
    status === "shopping_complete" ||
    status === "shopping_completed" ||
    status === "courier_picked_up"
  ) {
    return PICKEDUP;
  }
  if (status === "dropoff" || status === "courier_at_dropoff") {
    return IN_DELIVERY;
  }
  if (status === "delivered") {
    return DELIVERED;
  }

  return null;
};

const createQuote = async (req, res) => {
  try {
    const { orderId, restaurantId } = req.params;
    const { order, error } = await getOrderForUber(orderId);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const {
      restaurant,
      customerId,
      error: restaurantError,
    } = await getRestaurantCustomerId(restaurantId);

    if (restaurantError) {
      return res.status(400).json({ success: false, message: restaurantError });
    }

    if (order.restaurant && String(order.restaurant) !== String(restaurantId)) {
      return res.status(400).json({
        success: false,
        message: "La commande n'appartient pas au restaurant sélectionné.",
      });
    }

    let pickup_address = buildPickupAddressFromRestaurant(restaurant);
    if (isIncompleteAddress(pickup_address)) {
      const { response, error: pickupError } = await getAddressFromCoords(
        restaurant.location?.latitude,
        restaurant.location?.longitude,
      );
      console.log("Geocoding response for pickup address:", {
        response,
        pickupError,
      });
      if (!pickupError && response?.streetAddress) {
        pickup_address = buildAddress({
          street: response.streetAddress,
          city: response.city,
          state: response.state,
          postal_code: response.zipCode,
          country: response.country,
        });
      }
    }

    if (isIncompleteAddress(pickup_address)) {
      return res.status(400).json({
        success: false,
        message: "Adresse de ramassage incomplète pour le restaurant.",
      });
    }

    let dropoff_address = buildDropoffAddressFromOrder(order);
    if (isIncompleteAddress(dropoff_address)) {
      const { response, error: dropoffError } = await getAddressFromCoords(
        order.coords?.latitude,
        order.coords?.longitude,
      );
      if (!dropoffError && response?.streetAddress) {
        dropoff_address = buildAddress({
          street: response.streetAddress,
          city: response.city,
          state: response.state,
          postal_code: response.zipCode,
          country: response.country,
        });
      }
    }

    if (isIncompleteAddress(dropoff_address)) {
      return res.status(400).json({
        success: false,
        message: "Adresse de livraison incomplète pour cette commande.",
      });
    }

    const basePayload = compactObject({
      pickup_address,
      dropoff_address,
      pickup_latitude: restaurant.location?.latitude,
      pickup_longitude: restaurant.location?.longitude,
      dropoff_latitude: order.coords?.latitude,
      dropoff_longitude: order.coords?.longitude,
      pickup_phone_number: normalizePhone(restaurant.phone_number),
      dropoff_phone_number: normalizePhone(order.user?.phone_number),
      manifest_total_value: toCents(
        order.sub_total_after_discount ?? order.sub_total ?? order.total_price,
      ),
    });
    console.log("Base payload for Uber Direct quote:", basePayload);
    const body = stringifyAddressFields(basePayload);

    const result = await uberDirectRequest({
      method: "POST",
      path: `/customers/${customerId}/delivery_quotes`,
      body,
    });

    return sendUberResponse(res, result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const createDelivery = async (req, res) => {
  try {
    const { orderId, restaurantId } = req.params;

    const { order, error } = await getOrderForUber(orderId);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const {
      restaurant,
      customerId,
      error: restaurantError,
    } = await getRestaurantCustomerId(restaurantId);
    if (restaurantError) {
      return res.status(400).json({ success: false, message: restaurantError });
    }

    if (order.restaurant && String(order.restaurant) !== String(restaurantId)) {
      return res.status(400).json({
        success: false,
        message: "La commande n'appartient pas au restaurant sélectionné.",
      });
    }

    let pickup_address = buildPickupAddressFromRestaurant(restaurant);

    if (isIncompleteAddress(pickup_address)) {
      const { response, error: pickupError } = await getAddressFromCoords(
        restaurant.location?.latitude,
        restaurant.location?.longitude,
      );

      if (!pickupError && response?.streetAddress) {
        pickup_address = buildAddress({
          street: response.streetAddress,
          city: response.city,
          state: response.state,
          postal_code: response.zipCode,
          country: response.country,
        });
      }
    }

    if (isIncompleteAddress(pickup_address)) {
      return res.status(400).json({
        success: false,
        message: "Adresse de ramassage incomplète pour le restaurant.",
      });
    }

    let dropoff_address = buildDropoffAddressFromOrder(order);

    if (isIncompleteAddress(dropoff_address)) {
      const { response, error: dropoffError } = await getAddressFromCoords(
        order.coords?.latitude,
        order.coords?.longitude,
      );

      if (!dropoffError && response?.streetAddress) {
        dropoff_address = buildAddress({
          street: response.streetAddress,
          city: response.city,
          state: response.state,
          postal_code: response.zipCode,
          country: response.country,
        });
      }
    }

    if (isIncompleteAddress(dropoff_address)) {
      return res.status(400).json({
        success: false,
        message: "Adresse de livraison incomplète pour cette commande.",
      });
    }

    const manifestTotalValue = toCents(
      order.sub_total_after_discount ?? order.sub_total ?? order.total_price,
    );
    const quotePayload = compactObject({
      pickup_address,
      dropoff_address,
      pickup_latitude: restaurant.location?.latitude,
      pickup_longitude: restaurant.location?.longitude,
      dropoff_latitude: order.coords?.latitude,
      dropoff_longitude: order.coords?.longitude,
      pickup_phone_number: normalizePhone(restaurant.phone_number),
      dropoff_phone_number: normalizePhone(order.user?.phone_number),
      manifest_total_value: manifestTotalValue,
    });
    const requestQuoteId = normalizeText(
      req.body?.quote_id || req.body?.quoteId,
    );
    let quoteId = requestQuoteId || null;

    if (!quoteId) {
      const quoteBody = stringifyAddressFields(quotePayload);

      const quoteResult = await uberDirectRequest({
        method: "POST",
        path: `/customers/${customerId}/delivery_quotes`,
        body: quoteBody,
      });

      const quoteResponsePayload =
        quoteResult.response && typeof quoteResult.response === "object"
          ? quoteResult.response
          : {};
      quoteId = extractQuoteIdFromPayload(quoteResponsePayload);

      if (!quoteId) {
        return res.status(502).json({
          success: false,
          message:
            "Impossible de récupérer un quote_id Uber Direct pour la livraison.",
          details: quoteResponsePayload,
        });
      }
    } else {
      console.log("[UberDirect][createDelivery] using provided quoteId", {
        quoteId,
      });
    }

    const basePayload = compactObject({
      pickup_name: restaurant.name || "Pickup",
      pickup_address,
      pickup_phone_number: normalizePhone(restaurant.phone_number),
      dropoff_name: order.user?.name || "Customer",
      dropoff_address,
      dropoff_phone_number: normalizePhone(order.user?.phone_number),
      quote_id: quoteId,
      manifest_total_value: manifestTotalValue,
      manifest_items: buildManifestItems(order),
      manifest_reference: order.code || String(order._id),

      pickup_latitude: restaurant.location?.latitude,
      pickup_longitude: restaurant.location?.longitude,
      dropoff_latitude: order.coords?.latitude,
      dropoff_longitude: order.coords?.longitude,
      dropoff_notes: order.instructions,
    });

    const body = stringifyAddressFields(basePayload);

    const result = await uberDirectRequest({
      method: "POST",
      path: `/customers/${customerId}/deliveries`,
      body,
    });

    if (!result.error) {
      const responsePayload =
        result.response && typeof result.response === "object"
          ? result.response
          : {};
      const deliveryId = extractDeliveryIdFromPayload(responsePayload);

      order.delivery_provider = "uber_direct";
      if (deliveryId) {
        order.uber_delivery_id = deliveryId;
      }
      order.uber_status = extractUberStatusFromPayload(responsePayload) || null;
      order.uber_courier_imminent =
        extractCourierImminentFromPayload(responsePayload) ?? null;
      order.uber_tracking_url = sanitizeCustomerTrackingUrl(
        extractTrackingUrlFromPayload(responsePayload),
      );
      const etaFields = extractEtaFieldsFromPayload(responsePayload);
      Object.assign(order, etaFields);
      order.uber_last_event_type = "delivery_created";
      order.uber_last_event_at = new Date();
      await order.save();
    } else {
      console.error("Error creating Uber Direct delivery:", {
        status: result.status,
        error: result.error,
        details: result.details,
      });
    }

    return sendUberResponse(res, result);
  } catch (err) {
    console.error("Error creating Uber Direct delivery:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const listDeliveries = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { customerId, error } = await getRestaurantCustomerId(restaurantId);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const result = await uberDirectRequest({
      method: "GET",
      path: `/customers/${customerId}/deliveries`,
      query: req.query,
    });

    return sendUberResponse(res, result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getDelivery = async (req, res) => {
  try {
    const { restaurantId, deliveryId } = req.params;
    const { customerId, error } = await getRestaurantCustomerId(restaurantId);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const result = await uberDirectRequest({
      method: "GET",
      path: `/customers/${customerId}/deliveries/${deliveryId}`,
    });

    return sendUberResponse(res, result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const updateDelivery = async (req, res) => {
  try {
    const { restaurantId, deliveryId } = req.params;
    const { customerId, error } = await getRestaurantCustomerId(restaurantId);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const result = await uberDirectRequest({
      method: "POST",
      path: `/customers/${customerId}/deliveries/${deliveryId}`,
      body: req.body,
    });

    return sendUberResponse(res, result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const cancelDelivery = async (req, res) => {
  try {
    const { restaurantId, deliveryId } = req.params;
    logWebhook("Annulation livraison demandee", {
      restaurant_id: restaurantId,
      delivery_id: deliveryId,
    });
    const { customerId, error } = await getRestaurantCustomerId(restaurantId);
    if (error) {
      logWebhook("Annulation impossible: restaurant introuvable", {
        restaurant_id: restaurantId,
        delivery_id: deliveryId,
      });
      return res.status(400).json({ success: false, message: error });
    }

    const result = await uberDirectRequest({
      method: "POST",
      path: `/customers/${customerId}/deliveries/${deliveryId}/cancel`,
      body: req.body,
    });

    if (!result.error) {
      const responsePayload =
        result.response && typeof result.response === "object"
          ? result.response
          : {};
      const canceledAt =
        parseIsoDateOrNull(
          responsePayload?.updated || responsePayload?.created,
        ) || new Date();
      const resolvedStatus =
        extractUberStatusFromPayload(responsePayload) || "canceled";

      const orderUpdates = {
        delivery_provider: null,
        uber_delivery_id: null,
        uber_status: resolvedStatus,
        uber_courier_imminent: null,
        uber_tracking_url: null,
        uber_pickup_eta: null,
        uber_dropoff_eta: null,
        uber_pickup_ready: null,
        uber_pickup_deadline: null,
        uber_dropoff_ready: null,
        uber_dropoff_deadline: null,
        uber_last_event_type: "delivery_canceled",
        uber_last_event_at: canceledAt,
      };

      let updatedOrder = await Order.findOneAndUpdate(
        {
          uber_delivery_id: deliveryId,
          restaurant: restaurantId,
        },
        orderUpdates,
      );

      if (!updatedOrder) {
        await Order.findOneAndUpdate(
          { uber_delivery_id: deliveryId },
          orderUpdates,
        );
      }

      logWebhook("Annulation Uber enregistree sur la commande", {
        restaurant_id: restaurantId,
        delivery_id: deliveryId,
        uber_status: resolvedStatus,
      });
    } else {
      logWebhook("Annulation Uber echouee", {
        restaurant_id: restaurantId,
        delivery_id: deliveryId,
        status_code: result.status || null,
        error: result.error || null,
      });
    }

    return sendUberResponse(res, result);
  } catch (err) {
    logWebhookError("Erreur annulation livraison", err, {
      restaurant_id: req.params?.restaurantId,
      delivery_id: req.params?.deliveryId,
    });
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getProofOfDelivery = async (req, res) => {
  try {
    const { restaurantId, deliveryId } = req.params;
    const { customerId, error } = await getRestaurantCustomerId(restaurantId);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const result = await uberDirectRequest({
      method: "POST",
      path: `/customers/${customerId}/deliveries/${deliveryId}/proof-of-delivery`,
      body: req.body,
    });

    return sendUberResponse(res, result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const handleUberDirectWebhook = async (req, res) => {
  try {
    const payload = req.body || {};
    const webhookMeta = buildWebhookLogMeta(payload);
    logWebhook("Webhook recu", webhookMeta);

    const rawPayload =
      typeof req.rawBody === "string" && req.rawBody.length
        ? req.rawBody
        : JSON.stringify(payload || {});

    const signatureValidation = verifyWebhookSignature(req, rawPayload);
    if (!signatureValidation.ok) {
      logWebhook("Signature webhook invalide", {
        ...webhookMeta,
        reason: signatureValidation.message,
      });
      return res.status(signatureValidation.status || 401).json({
        success: false,
        message: signatureValidation.message,
      });
    }
    logWebhook("Signature webhook valide", webhookMeta);

    const deliveryId = extractDeliveryIdFromPayload(payload);
    const uberStatus = extractUberStatusFromPayload(payload);
    const courierImminent = extractCourierImminentFromPayload(payload);
    const trackingUrl = extractTrackingUrlFromPayload(payload);
    const etaFields = extractEtaFieldsFromPayload(payload);
    const eventType = payload?.event_type || payload?.type || null;
    const manifestReference = extractManifestReferenceFromPayload(payload);

    let order = null;
    if (deliveryId) {
      order = await Order.findOne({ uber_delivery_id: deliveryId }).select(
        "_id status uber_last_event_at uber_last_event_type uber_status uber_courier_imminent delivery_provider uber_delivery_id",
      );
    }

    if (!order && manifestReference) {
      const lookup = [{ code: manifestReference }];
      if (/^[a-fA-F0-9]{24}$/.test(manifestReference)) {
        lookup.push({ _id: manifestReference });
      }
      order = await Order.findOne({ $or: lookup }).select(
        "_id status uber_last_event_at uber_last_event_type uber_status uber_courier_imminent delivery_provider uber_delivery_id",
      );
    }

    if (!order) {
      logWebhook("Webhook sans commande correspondante", webhookMeta);
      return res.status(200).json({
        success: true,
        message: "Webhook received. No matching order found.",
      });
    }
    logWebhook("Commande trouvee pour webhook", {
      ...webhookMeta,
      order_id: order._id,
      current_order_status: order.status,
      current_uber_status: order.uber_status || null,
      current_courier_imminent:
        order.uber_courier_imminent === undefined
          ? null
          : Boolean(order.uber_courier_imminent),
    });

    const resolvedEventTimestamp = extractEventTimestamp(payload);

    if (isWebhookEventStale(order, resolvedEventTimestamp)) {
      logWebhook("Webhook ignore (event ancien)", {
        ...webhookMeta,
        order_id: order._id,
        incoming_event_at: resolvedEventTimestamp,
        current_event_at: order.uber_last_event_at || null,
      });
      return res.status(200).json({
        success: true,
        message: "Webhook ignored: older event.",
      });
    }

    if (
      isWebhookEventDuplicate(
        order,
        resolvedEventTimestamp,
        eventType,
        uberStatus,
        courierImminent,
      )
    ) {
      logWebhook("Webhook ignore (event duplique)", {
        ...webhookMeta,
        order_id: order._id,
      });
      return res.status(200).json({
        success: true,
        message: "Webhook ignored: duplicate event.",
      });
    }

    const isDetachedFromUber =
      !order?.uber_delivery_id && order?.delivery_provider !== "uber_direct";
    if (isDetachedFromUber) {
      logWebhook("Webhook ignore (commande non liee a Uber)", {
        ...webhookMeta,
        order_id: order._id,
        delivery_provider: order?.delivery_provider || null,
      });
      return res.status(200).json({
        success: true,
        message: "Webhook ignored: order is not linked to Uber Direct.",
      });
    }

    const mappedStatus = mapUberStatusToOrderStatus(uberStatus);
    const webhookUpdates = compactObject({
      uber_status: uberStatus,
      uber_tracking_url: sanitizeCustomerTrackingUrl(trackingUrl),
      uber_last_event_type: eventType,
      uber_last_event_at: resolvedEventTimestamp,
      ...etaFields,
    });
    if (
      deliveryId &&
      (order?.delivery_provider === "uber_direct" ||
        Boolean(order?.uber_delivery_id))
    ) {
      webhookUpdates.uber_delivery_id = deliveryId;
    }
    if (courierImminent !== undefined) {
      webhookUpdates.uber_courier_imminent = courierImminent;
    }
    await Order.findByIdAndUpdate(order._id, webhookUpdates);
    logWebhook("Commande mise a jour depuis webhook", {
      ...webhookMeta,
      order_id: order._id,
      mapped_order_status: mappedStatus,
      delivery_provider: order?.delivery_provider ?? null,
      courier_imminent:
        webhookUpdates.uber_courier_imminent === undefined
          ? null
          : Boolean(webhookUpdates.uber_courier_imminent),
      updated_fields: Object.keys(webhookUpdates),
    });

    if (mappedStatus && mappedStatus !== order.status) {
      const { error } = await updateStatusService(order._id, mappedStatus);
      if (error) {
        logWebhook("Echec mise a jour du statut commande", {
          ...webhookMeta,
          order_id: order._id,
          mapped_order_status: mappedStatus,
          error,
        });
        return res.status(500).json({
          success: false,
          message: error,
        });
      }
      logWebhook("Statut commande synchronise avec Uber", {
        ...webhookMeta,
        order_id: order._id,
        old_order_status: order.status,
        new_order_status: mappedStatus,
      });
    }

    logWebhook("Webhook traite avec succes", {
      ...webhookMeta,
      order_id: order._id,
    });
    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully.",
    });
  } catch (err) {
    logWebhookError(
      "Erreur traitement webhook",
      err,
      buildWebhookLogMeta(req.body || {}),
    );
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const findStores = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { customerId, error } = await getRestaurantCustomerId(restaurantId);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const result = await uberDirectRequest({
      method: "GET",
      path: `/customers/${customerId}/stores`,
      query: req.query,
      scope: ORG_SCOPE,
    });

    return sendUberResponse(res, result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getUberDirectAccessToken,
  createQuote,
  createDelivery,
  listDeliveries,
  getDelivery,
  updateDelivery,
  cancelDelivery,
  getProofOfDelivery,
  handleUberDirectWebhook,
  findStores,
};
