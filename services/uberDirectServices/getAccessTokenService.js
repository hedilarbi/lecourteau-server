const https = require("https");
const querystring = require("querystring");
const UberDirectToken = require("../../models/UberDirectToken");

const DEFAULT_SCOPE = "eats.deliveries";
const DEFAULT_AUTH_HOST = "auth.uber.com";
const DEFAULT_AUTH_PATH = "/oauth/v2/token";
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

const tokenCache = new Map();

const isTokenValid = (expiresAt) => {
  if (!expiresAt) return false;
  const expiresAtMs = new Date(expiresAt).getTime();
  return expiresAtMs - Date.now() > EXPIRY_BUFFER_MS;
};

const secondsUntilExpiry = (expiresAt) => {
  if (!expiresAt) return 0;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 1000));
};

const requestAccessToken = async (scope) => {
  const clientId = process.env.UBER_DIRECT_CLIENT_ID;
  const clientSecret = process.env.UBER_DIRECT_CLIENT_SECRET;
  const scopeValue = scope || process.env.UBER_DIRECT_SCOPE || DEFAULT_SCOPE;

  if (!clientId || !clientSecret) {
    return { error: "Missing Uber Direct client credentials." };
  }

  const body = querystring.stringify({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: scopeValue,
  });

  const options = {
    method: "POST",
    hostname: process.env.UBER_DIRECT_AUTH_HOST || DEFAULT_AUTH_HOST,
    path: process.env.UBER_DIRECT_AUTH_PATH || DEFAULT_AUTH_PATH,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body),
    },
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (err) {
          return resolve({
            error: "Invalid response from Uber Direct auth service.",
          });
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          return resolve({
            error: parsed?.error || "Uber Direct auth error.",
            details: parsed,
          });
        }

        return resolve({ response: parsed });
      });
    });

    req.on("error", (err) => resolve({ error: err.message }));
    req.write(body);
    req.end();
  });
};

const getUberDirectAccessTokenService = async (options = {}) => {
  const { forceRefresh = false, scope: requestedScope } = options;
  const scope = requestedScope || process.env.UBER_DIRECT_SCOPE || DEFAULT_SCOPE;
  const cacheEntry = tokenCache.get(scope);

  if (!forceRefresh && cacheEntry && isTokenValid(cacheEntry.expiresAt)) {
    return {
      token: cacheEntry.token,
      tokenType: "Bearer",
      scope,
      expiresAt: cacheEntry.expiresAt,
      expiresIn: secondsUntilExpiry(cacheEntry.expiresAt),
      source: "memory",
    };
  }

  if (!forceRefresh) {
    const key = `uber_direct:${scope}`;
    const existing = await UberDirectToken.findOne({ key });
    if (existing && isTokenValid(existing.expires_at)) {
      tokenCache.set(scope, {
        token: existing.access_token,
        expiresAt: existing.expires_at,
      });
      return {
        token: existing.access_token,
        tokenType: existing.token_type,
        scope: existing.scope || scope,
        expiresAt: existing.expires_at,
        expiresIn: secondsUntilExpiry(existing.expires_at),
        source: "db",
      };
    }
  }

  const { response, error, details } = await requestAccessToken(scope);
  if (error) {
    return { error, details };
  }

  const expiresAt = new Date(Date.now() + response.expires_in * 1000);
  const key = `uber_direct:${scope}`;
  const saved = await UberDirectToken.findOneAndUpdate(
    { key },
    {
      key,
      access_token: response.access_token,
      token_type: response.token_type || "Bearer",
      scope: response.scope || scope,
      expires_in: response.expires_in,
      expires_at: expiresAt,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  tokenCache.set(scope, { token: saved.access_token, expiresAt: saved.expires_at });

  return {
    token: saved.access_token,
    tokenType: saved.token_type,
    scope: saved.scope,
    expiresAt: saved.expires_at,
    expiresIn: secondsUntilExpiry(saved.expires_at),
    source: "api",
  };
};

module.exports = {
  getUberDirectAccessTokenService,
};
