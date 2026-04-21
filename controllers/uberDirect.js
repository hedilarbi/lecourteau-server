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

const logUberDirectAutoDeliveryError = (message, meta = {}) => {
  const timestamp = new Date().toISOString();
  console.log(
    `[UberDirectAuto] ${timestamp} - ${message} ${JSON.stringify(meta)}`,
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
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
};

const isValidUberPhoneNumber = (value) => {
  const phone = normalizePhone(value);
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return false;

  if (phone.startsWith("+1")) {
    return /^\+1[2-9]\d{2}[2-9]\d{6}$/.test(phone);
  }

  return true;
};

const validateUberPhoneNumber = ({ value, field, label }) => {
  const phone = normalizePhone(value);

  if (!phone) {
    return {
      error: `${label} manquant pour Uber Direct.`,
      details: {
        source: "uber_direct",
        phase: "local_validation",
        code: "missing_phone_number",
        field,
        field_label: label,
        retryable: false,
        action: "Ajoutez le numero de telephone, puis relancez.",
      },
    };
  }

  if (!isValidUberPhoneNumber(phone)) {
    return {
      error: `${label} invalide pour Uber Direct. Corrigez le numero avant de creer la livraison.`,
      details: {
        source: "uber_direct",
        phase: "local_validation",
        code: "invalid_phone_number",
        field,
        field_label: label,
        field_message: "Le numero doit etre un numero E.164 valide.",
        phone_number: phone,
        retryable: false,
        action: "Corrigez le numero de telephone, puis relancez.",
      },
    };
  }

  return { phone };
};

const getValidatedUberPhoneNumbers = ({ restaurant, order }) => {
  const pickupPhone = validateUberPhoneNumber({
    value: restaurant.phone_number,
    field: "pickup_phone_number",
    label: "Numero de telephone du restaurant",
  });

  if (pickupPhone.error) {
    return { error: pickupPhone.error, details: pickupPhone.details };
  }

  const dropoffPhone = validateUberPhoneNumber({
    value: order.user?.phone_number,
    field: "dropoff_phone_number",
    label: "Numero de telephone du client",
  });

  if (dropoffPhone.error) {
    return { error: dropoffPhone.error, details: dropoffPhone.details };
  }

  return {
    pickupPhoneNumber: pickupPhone.phone,
    dropoffPhoneNumber: dropoffPhone.phone,
  };
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

const getValidCoordinatePair = (coords) => {
  const latitude = Number(coords?.latitude);
  const longitude = Number(coords?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  // Older orders can store 0,0 as a placeholder when no coordinates exist.
  if (latitude === 0 && longitude === 0) return null;

  return { latitude, longitude };
};

const buildCoordinateFields = (prefix, coords) => {
  const pair = getValidCoordinatePair(coords);
  if (!pair) return {};

  return {
    [`${prefix}_latitude`]: pair.latitude,
    [`${prefix}_longitude`]: pair.longitude,
  };
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

const buildUberCreationFailureMessage = ({ message, details } = {}) => {
  const fallback = "Création de la livraison Uber Direct échouée.";
  const baseMessage = normalizeText(message) || fallback;
  const detailCandidates = [
    details?.field_message,
    details?.message,
    details?.error,
    details?.code,
  ];
  const detailMessage = detailCandidates.map(normalizeText).find(Boolean);
  const fullMessage =
    detailMessage && detailMessage !== baseMessage
      ? `${baseMessage} (${detailMessage})`
      : baseMessage;

  return fullMessage.slice(0, 1000);
};

const markOrderUberCreationFailed = async (order, failure = {}) => {
  if (!order) return;

  const now = new Date();
  order.uber_creation_failed = true;
  order.uber_creation_error = buildUberCreationFailureMessage(failure);
  order.uber_creation_failed_at = now;
  order.uber_creation_last_attempt_at = now;

  try {
    await order.save();
  } catch (error) {
    logUberDirectAutoDeliveryError("Error storing Uber creation failure", {
      orderId: order?._id,
      error: error?.message || String(error),
    });
  }
};

const clearOrderUberCreationFailure = (order) => {
  if (!order) return;
  order.uber_creation_failed = false;
  order.uber_creation_error = "";
  order.uber_creation_failed_at = null;
  order.uber_creation_last_attempt_at = new Date();
};

const UBER_DIRECT_ERROR_CATALOG = {
  invalid_params: {
    message: "Les informations envoyees a Uber Direct sont invalides.",
    action: "Corrigez le champ indique, puis relancez la livraison.",
    retryable: false,
  },
  duplicate_delivery: {
    message: "Une livraison Uber Direct active existe deja pour cette commande.",
    action: "Rafraichissez la commande avant de creer une nouvelle livraison.",
    retryable: false,
  },
  unknown_location: {
    message: "Uber Direct ne comprend pas l'adresse indiquee.",
    action: "Verifiez l'adresse et les coordonnees GPS, puis relancez.",
    retryable: false,
  },
  address_undeliverable: {
    message: "Uber Direct ne livre pas cette adresse.",
    action: "Utilisez une autre adresse ou un autre mode de livraison.",
    retryable: false,
  },
  address_undeliverable_limited_couriers: {
    message:
      "Aucun livreur Uber n'est disponible pour cette adresse pour le moment.",
    action: "Reessayez dans quelques minutes ou utilisez la livraison interne.",
    retryable: true,
  },
  pickup_window_too_small: {
    message:
      "La fenetre de ramassage Uber doit durer au moins 10 minutes.",
    action: "Elargissez la fenetre de ramassage.",
    retryable: false,
  },
  dropoff_deadline_too_early: {
    message:
      "L'heure limite de livraison doit etre au moins 20 minutes apres le debut de livraison.",
    action: "Corrigez la fenetre de livraison.",
    retryable: false,
  },
  dropoff_deadline_before_pickup_deadline: {
    message:
      "L'heure limite de livraison doit etre apres l'heure limite de ramassage.",
    action: "Corrigez les horaires de ramassage/livraison.",
    retryable: false,
  },
  dropoff_ready_after_pickup_deadline: {
    message:
      "Le debut de livraison doit etre avant ou egal a la limite de ramassage.",
    action: "Corrigez les horaires Uber Direct.",
    retryable: false,
  },
  pickup_ready_too_early: {
    message: "L'heure de ramassage ne peut pas etre dans le passe.",
    action: "Utilisez une heure de ramassage future.",
    retryable: false,
  },
  pickup_deadline_too_early: {
    message:
      "La limite de ramassage doit etre au moins 20 minutes dans le futur.",
    action: "Utilisez une limite de ramassage plus tardive.",
    retryable: false,
  },
  pickup_ready_too_late: {
    message:
      "L'heure de ramassage doit etre dans les 30 prochains jours.",
    action: "Utilisez une heure de ramassage plus proche.",
    retryable: false,
  },
  expired_quote: {
    message: "Le devis Uber Direct a expire.",
    action: "Generez un nouveau devis Uber Direct.",
    retryable: true,
  },
  used_quote: {
    message: "Le devis Uber Direct a deja ete utilise.",
    action: "Generez un nouveau devis Uber Direct.",
    retryable: true,
  },
  mismatched_price_quote: {
    message:
      "Le devis Uber Direct ne correspond pas aux informations de livraison.",
    action: "Generez un nouveau devis avec les memes informations.",
    retryable: true,
  },
  missing_payment: {
    message:
      "Le compte Uber Direct du restaurant n'a pas de moyen de paiement configure.",
    action: "Ajoutez ou corrigez la facturation dans Uber Direct.",
    retryable: false,
  },
  pickup_ready_time_not_specified: {
    message:
      "L'heure de debut de ramassage est requise avec les fenetres horaires.",
    action: "Ajoutez l'heure de debut de ramassage.",
    retryable: false,
  },
  customer_not_found: {
    message: "Le customer_id Uber Direct du restaurant est introuvable.",
    action: "Verifiez la configuration Uber Direct du restaurant.",
    retryable: false,
  },
  customer_suspended: {
    message:
      "Le compte Uber Direct du restaurant est suspendu pour paiement.",
    action: "Reglez le probleme de facturation Uber Direct.",
    retryable: false,
  },
  customer_blocked: {
    message:
      "Le compte Uber Direct du restaurant n'est pas autorise a creer des livraisons.",
    action: "Contactez Uber Direct ou verifiez l'activation du compte.",
    retryable: false,
  },
  customer_limited: {
    message: "La limite du compte Uber Direct du restaurant est atteinte.",
    action: "Reessayez plus tard ou contactez Uber Direct.",
    retryable: true,
  },
  request_timeout: {
    message: "Uber Direct n'a pas repondu a temps.",
    action: "Reessayez dans quelques instants.",
    retryable: true,
  },
  unknown_error: {
    message: "Uber Direct a retourne une erreur inconnue.",
    action: "Reessayez plus tard. Si le probleme persiste, contactez Uber.",
    retryable: true,
  },
  noncancelable_delivery: {
    message: "Cette livraison Uber Direct ne peut plus etre annulee.",
    action: "Verifiez son statut dans Uber Direct.",
    retryable: false,
  },
  delivery_not_found: {
    message: "La livraison Uber Direct est introuvable.",
    action: "Rafraichissez la commande et verifiez l'identifiant de livraison.",
    retryable: false,
  },
  customer_not_cound: {
    message: "Le customer_id Uber Direct du restaurant est introuvable.",
    action: "Verifiez la configuration Uber Direct du restaurant.",
    retryable: false,
  },
  service_unavailable: {
    message: "Service Uber Direct temporairement indisponible.",
    action: "Reessayez plus tard.",
    retryable: true,
  },
};

const UBER_DIRECT_FIELD_LABELS = {
  pickup_address: "adresse du restaurant",
  dropoff_address: "adresse du client",
  pickup_phone_number: "numero de telephone du restaurant",
  dropoff_phone_number: "numero de telephone du client",
  pickup_latitude: "latitude du restaurant",
  pickup_longitude: "longitude du restaurant",
  dropoff_latitude: "latitude du client",
  dropoff_longitude: "longitude du client",
  pickup_ready_dt: "heure de debut de ramassage",
  pickup_deadline_dt: "heure limite de ramassage",
  dropoff_ready_dt: "heure de debut de livraison",
  dropoff_deadline_dt: "heure limite de livraison",
  manifest_total_value: "montant de la commande",
  manifest_items: "articles de la commande",
  quote_id: "devis Uber Direct",
  customer_id: "customer_id Uber Direct",
  external_store_id: "identifiant externe du restaurant",
};

const isIncompleteAddress = (address) => {
  if (!address) return true;
  if (Array.isArray(address.street_address)) {
    return !address.street_address.some((line) => normalizeText(line));
  }
  return !normalizeText(address.street_address);
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

const getUberErrorMetadata = (details) => {
  if (!details || typeof details !== "object") return {};
  const metadata =
    details.metadata ||
    details?.error?.metadata ||
    details?.details?.metadata ||
    {};

  return metadata && typeof metadata === "object" ? metadata : {};
};

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

const getUberErrorKind = (details) => {
  if (!details || typeof details !== "object") return null;
  return details.kind || details?.error?.kind || details?.details?.kind || null;
};

const getUberRawMessage = ({ error, details }) =>
  [
    details?.message,
    details?.error,
    details?.description,
    details?.error?.message,
    details?.details?.message,
    error,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .find(Boolean) || "";

const getUberMetadataEntries = (metadata = {}) =>
  Object.entries(metadata)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([field, value]) => ({
      field,
      message:
        typeof value === "string" ? value : JSON.stringify(value),
    }));

const getPrimaryUberMetadataEntry = (metadata = {}) => {
  const entries = getUberMetadataEntries(metadata);
  return (
    entries.find((entry) => UBER_DIRECT_FIELD_LABELS[entry.field]) ||
    entries[0] ||
    null
  );
};

const getUberStatusFallback = (status) => {
  if (status === 400) {
    return {
      message: "Les informations envoyees a Uber Direct sont invalides.",
      action: "Corrigez les informations de livraison, puis relancez.",
      retryable: false,
    };
  }
  if (status === 401) {
    return {
      message: "Authentification Uber Direct invalide.",
      action: "Reessayez. Si le probleme persiste, regenerez le token Uber.",
      retryable: true,
    };
  }
  if (status === 402) {
    return UBER_DIRECT_ERROR_CATALOG.customer_suspended;
  }
  if (status === 403) {
    return UBER_DIRECT_ERROR_CATALOG.customer_blocked;
  }
  if (status === 404) {
    return {
      message: "Ressource Uber Direct introuvable.",
      action: "Verifiez les identifiants Uber Direct configures.",
      retryable: false,
    };
  }
  if (status === 408) {
    return UBER_DIRECT_ERROR_CATALOG.request_timeout;
  }
  if (status === 409) {
    return {
      message: "Conflit Uber Direct sur cette livraison.",
      action: "Rafraichissez la commande, puis relancez si necessaire.",
      retryable: true,
    };
  }
  if (status === 429) {
    return UBER_DIRECT_ERROR_CATALOG.customer_limited;
  }
  if (status >= 500) {
    return {
      message: "Service Uber Direct temporairement indisponible.",
      action: "Reessayez plus tard.",
      retryable: true,
    };
  }

  return UBER_DIRECT_ERROR_CATALOG.unknown_error;
};

const inferUberErrorFromText = (text) => {
  if (!text) return null;
  if (text.includes("phone")) {
    return {
      message: "Numero de telephone invalide pour Uber Direct.",
      action: "Corrigez le numero de telephone, puis relancez.",
      retryable: false,
    };
  }
  if (
    text.includes("location was not understood") ||
    text.includes("invalid address") ||
    text.includes("address")
  ) {
    return {
      message: "Adresse de ramassage ou de livraison invalide.",
      action: "Corrigez l'adresse, puis relancez.",
      retryable: false,
    };
  }
  if (text.includes("quote")) {
    return {
      message: "Le devis Uber Direct est invalide ou expire.",
      action: "Generez un nouveau devis Uber Direct.",
      retryable: true,
    };
  }
  if (text.includes("manifest")) {
    return {
      message: "Le detail de la commande est invalide pour Uber Direct.",
      action: "Verifiez les articles et le montant de la commande.",
      retryable: false,
    };
  }
  if (text.includes("customer")) {
    return {
      message: "Configuration Uber Direct du restaurant invalide.",
      action: "Verifiez le customer_id et le compte Uber Direct.",
      retryable: false,
    };
  }

  return null;
};

const buildUberDirectErrorPayload = ({
  status,
  error,
  details,
  phase = "uber_direct",
}) => {
  const code = toLowerText(getUberErrorCode(details) || "");
  const kind = getUberErrorKind(details);
  const metadata = getUberErrorMetadata(details);
  const metadataEntry = getPrimaryUberMetadataEntry(metadata);
  const field = metadataEntry?.field || null;
  const fieldLabel = field ? UBER_DIRECT_FIELD_LABELS[field] || field : null;
  const rawMessage = getUberRawMessage({ error, details });
  const metadataText = getUberMetadataEntries(metadata)
    .map((entry) => `${entry.field}: ${entry.message}`)
    .join(" | ");
  const text = toLowerText([rawMessage, metadataText].filter(Boolean).join(" | "));
  const catalogError =
    UBER_DIRECT_ERROR_CATALOG[code] ||
    inferUberErrorFromText(text) ||
    getUberStatusFallback(status);

  const messageParts = [catalogError.message];
  if (fieldLabel && metadataEntry?.message) {
    messageParts.push(`Champ ${fieldLabel}: ${metadataEntry.message}`);
  } else if (metadataEntry?.message) {
    messageParts.push(`Detail Uber: ${metadataEntry.message}`);
  } else if (
    rawMessage &&
    rawMessage !== catalogError.message &&
    !toLowerText(catalogError.message).includes(toLowerText(rawMessage))
  ) {
    messageParts.push(`Detail Uber: ${rawMessage}`);
  }

  if (catalogError.action) {
    messageParts.push(catalogError.action);
  }

  return {
    message: messageParts.filter(Boolean).join(" "),
    details: {
      source: "uber_direct",
      phase,
      status: status || null,
      code: code || null,
      kind: kind || null,
      retryable: Boolean(catalogError.retryable),
      action: catalogError.action || null,
      field,
      field_label: fieldLabel,
      field_message: metadataEntry?.message || null,
      uber_message: rawMessage || error || null,
      metadata,
      raw: details || null,
    },
  };
};

const translateUberErrorMessage = ({ status, error, details }) => {
  return buildUberDirectErrorPayload({ status, error, details }).message;
};

const sendUberResponse = (res, result, phase = "uber_direct") => {
  if (result.error) {
    const errorPayload = buildUberDirectErrorPayload({
      status: result.status,
      error: result.error,
      details: result.details,
      phase,
    });

    return res.status(result.status || 500).json({
      success: false,
      message: errorPayload.message,
      details: errorPayload.details,
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
      const pickupCoords = getValidCoordinatePair(restaurant.location);
      if (pickupCoords) {
        const { response, error: pickupError } = await getAddressFromCoords(
          pickupCoords.latitude,
          pickupCoords.longitude,
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
    }

    if (isIncompleteAddress(pickup_address)) {
      return res.status(400).json({
        success: false,
        message: "Adresse de ramassage incomplète pour le restaurant.",
      });
    }

    let dropoff_address = buildDropoffAddressFromOrder(order);
    if (isIncompleteAddress(dropoff_address)) {
      const dropoffCoords = getValidCoordinatePair(order.coords);
      if (dropoffCoords) {
        const { response, error: dropoffError } = await getAddressFromCoords(
          dropoffCoords.latitude,
          dropoffCoords.longitude,
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
    }

    if (isIncompleteAddress(dropoff_address)) {
      return res.status(400).json({
        success: false,
        message: "Adresse de livraison incomplète pour cette commande.",
      });
    }

    const phoneNumbers = getValidatedUberPhoneNumbers({ restaurant, order });
    if (phoneNumbers.error) {
      return res.status(400).json({
        success: false,
        message: phoneNumbers.error,
        details: phoneNumbers.details,
      });
    }

    const basePayload = compactObject({
      pickup_address,
      dropoff_address,
      ...buildCoordinateFields("pickup", restaurant.location),
      ...buildCoordinateFields("dropoff", order.coords),
      pickup_phone_number: phoneNumbers.pickupPhoneNumber,
      dropoff_phone_number: phoneNumbers.dropoffPhoneNumber,
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

    return sendUberResponse(res, result, "create_quote");
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const createUberDirectDeliveryForOrder = async ({
  orderId,
  restaurantId,
  quoteId: providedQuoteId,
}) => {
  let order = null;
  const failWithStoredError = async (payload) => {
    await markOrderUberCreationFailed(order, {
      message: payload?.message,
      details: payload?.details,
    });
    return {
      success: false,
      ...payload,
    };
  };

  try {
    const orderResult = await getOrderForUber(orderId);
    const { error } = orderResult;
    if (error) {
      return { success: false, status: 400, message: error };
    }
    order = orderResult.order;

    const {
      restaurant,
      customerId,
      error: restaurantError,
    } = await getRestaurantCustomerId(restaurantId);
    if (restaurantError) {
      return failWithStoredError({ status: 400, message: restaurantError });
    }

    if (order.restaurant && String(order.restaurant) !== String(restaurantId)) {
      return failWithStoredError({
        status: 400,
        message: "La commande n'appartient pas au restaurant sélectionné.",
      });
    }

    let pickup_address = buildPickupAddressFromRestaurant(restaurant);

    if (isIncompleteAddress(pickup_address)) {
      const pickupCoords = getValidCoordinatePair(restaurant.location);
      if (pickupCoords) {
        const { response, error: pickupError } = await getAddressFromCoords(
          pickupCoords.latitude,
          pickupCoords.longitude,
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
    }

    if (isIncompleteAddress(pickup_address)) {
      return failWithStoredError({
        status: 400,
        message: "Adresse de ramassage incomplète pour le restaurant.",
      });
    }

    let dropoff_address = buildDropoffAddressFromOrder(order);

    if (isIncompleteAddress(dropoff_address)) {
      const dropoffCoords = getValidCoordinatePair(order.coords);
      if (dropoffCoords) {
        const { response, error: dropoffError } = await getAddressFromCoords(
          dropoffCoords.latitude,
          dropoffCoords.longitude,
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
    }

    if (isIncompleteAddress(dropoff_address)) {
      return failWithStoredError({
        status: 400,
        message: "Adresse de livraison incomplète pour cette commande.",
      });
    }

    const phoneNumbers = getValidatedUberPhoneNumbers({ restaurant, order });
    if (phoneNumbers.error) {
      return failWithStoredError({
        status: 400,
        message: phoneNumbers.error,
        details: phoneNumbers.details,
      });
    }

    const manifestTotalValue = toCents(
      order.sub_total_after_discount ?? order.sub_total ?? order.total_price,
    );
    const quotePayload = compactObject({
      pickup_address,
      dropoff_address,
      ...buildCoordinateFields("pickup", restaurant.location),
      ...buildCoordinateFields("dropoff", order.coords),
      pickup_phone_number: phoneNumbers.pickupPhoneNumber,
      dropoff_phone_number: phoneNumbers.dropoffPhoneNumber,
      manifest_total_value: manifestTotalValue,
    });
    let quoteId = normalizeText(providedQuoteId);

    if (!quoteId) {
      const quoteBody = stringifyAddressFields(quotePayload);
      console.log("[UberDirect][createDelivery][quoteRequest]", {
        orderId,
        restaurantId,
        customerId,
        payload: quoteBody,
      });

      const quoteResult = await uberDirectRequest({
        method: "POST",
        path: `/customers/${customerId}/delivery_quotes`,
        body: quoteBody,
      });

      if (quoteResult?.error) {
        console.log("[UberDirect][createDelivery][quoteError]", {
          orderId,
          restaurantId,
          customerId,
          status: quoteResult.status || null,
          error: quoteResult.error || null,
          details: quoteResult.details || null,
          payload: quoteBody,
        });
        logUberDirectAutoDeliveryError("Error creating quote", {
          orderId,
          restaurantId,
          customerId,
          status: quoteResult.status || null,
          error: quoteResult.error || null,
          details: quoteResult.details || null,
        });

        const errorPayload = buildUberDirectErrorPayload({
          status: quoteResult.status,
          error: quoteResult.error,
          details: quoteResult.details,
          phase: "create_delivery_quote",
        });

        return failWithStoredError({
          status: quoteResult.status || 500,
          message: errorPayload.message,
          details: errorPayload.details,
        });
      }

      const quoteResponsePayload =
        quoteResult.response && typeof quoteResult.response === "object"
          ? quoteResult.response
          : {};
      quoteId = extractQuoteIdFromPayload(quoteResponsePayload);

      if (!quoteId) {
        return failWithStoredError({
          status: 502,
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
      pickup_phone_number: phoneNumbers.pickupPhoneNumber,
      dropoff_name: order.user?.name || "Customer",
      dropoff_address,
      dropoff_phone_number: phoneNumbers.dropoffPhoneNumber,
      quote_id: quoteId,
      manifest_total_value: manifestTotalValue,
      manifest_items: buildManifestItems(order),
      manifest_reference: order.code || String(order._id),
      ...buildCoordinateFields("pickup", restaurant.location),
      ...buildCoordinateFields("dropoff", order.coords),
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
      clearOrderUberCreationFailure(order);
      await order.save();

      return {
        success: true,
        status: result.status || 200,
        data: responsePayload,
      };
    }

    console.error("Error creating Uber Direct delivery:", {
      status: result.status,
      error: result.error,
      details: result.details,
    });
    logUberDirectAutoDeliveryError("Error creating Uber delivery", {
      orderId,
      restaurantId,
      status: result.status || null,
      error: result.error || null,
      details: result.details || null,
    });

    const errorPayload = buildUberDirectErrorPayload({
      status: result.status,
      error: result.error,
      details: result.details,
      phase: "create_delivery",
    });

    return failWithStoredError({
      status: result.status || 500,
      message: errorPayload.message,
      details: errorPayload.details,
    });
  } catch (err) {
    console.error("Error creating Uber Direct delivery:", err);
    logUberDirectAutoDeliveryError("Error creating Uber delivery", {
      orderId,
      restaurantId,
      error: err?.message || String(err),
    });
    await markOrderUberCreationFailed(order, {
      message: err?.message || String(err),
    });
    return { success: false, status: 500, message: err.message };
  }
};

const createDelivery = async (req, res) => {
  const { orderId, restaurantId } = req.params;
  const result = await createUberDirectDeliveryForOrder({
    orderId,
    restaurantId,
    quoteId: req.body?.quote_id || req.body?.quoteId,
  });

  if (!result.success) {
    return res.status(result.status || 500).json({
      success: false,
      message: result.message,
      details: result.details,
    });
  }

  return res.status(result.status || 200).json({
    success: true,
    data: result.data,
  });
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

    return sendUberResponse(res, result, "list_deliveries");
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

    return sendUberResponse(res, result, "get_delivery");
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

    return sendUberResponse(res, result, "update_delivery");
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

    return sendUberResponse(res, result, "cancel_delivery");
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

    return sendUberResponse(res, result, "proof_of_delivery");
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

    return sendUberResponse(res, result, "find_stores");
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getUberDirectAccessToken,
  createQuote,
  createDelivery,
  createUberDirectDeliveryForOrder,
  listDeliveries,
  getDelivery,
  updateDelivery,
  cancelDelivery,
  getProofOfDelivery,
  handleUberDirectWebhook,
  findStores,
};
