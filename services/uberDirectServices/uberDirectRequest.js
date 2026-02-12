const https = require("https");
const querystring = require("querystring");
const {
  getUberDirectAccessTokenService,
} = require("./getAccessTokenService");

const DEFAULT_API_HOST = "api.uber.com";
const DEFAULT_API_BASE_PATH = "/v1";
const UBER_DIRECT_TOKEN_LOGS =
  String(process.env.UBER_DIRECT_TOKEN_LOGS || "true")
    .toLowerCase()
    .trim() !== "false";

const logTokenFlow = (message, meta = {}) => {
  if (!UBER_DIRECT_TOKEN_LOGS) return;
  const timestamp = new Date().toISOString();
  if (meta && Object.keys(meta).length) {
    console.log(
      `[UberDirectTokenFlow] ${timestamp} - ${message} ${JSON.stringify(meta)}`,
    );
    return;
  }
  console.log(`[UberDirectTokenFlow] ${timestamp} - ${message}`);
};

const joinPath = (basePath, path) => {
  const base = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const clean = path.startsWith("/") ? path.slice(1) : path;
  return `${base}${clean}`;
};

const compactQuery = (query = {}) =>
  Object.fromEntries(
    Object.entries(query).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  );

const parseJsonSafely = (payload) => {
  try {
    return JSON.parse(payload);
  } catch (err) {
    return null;
  }
};

const makeRequest = async ({ method, path, body, query, token }) => {
  const host = process.env.UBER_DIRECT_API_HOST || DEFAULT_API_HOST;
  const basePath =
    process.env.UBER_DIRECT_API_BASE_PATH || DEFAULT_API_BASE_PATH;
  const queryString = querystring.stringify(compactQuery(query));
  const fullPath = joinPath(basePath, path) + (queryString ? `?${queryString}` : "");

  const hasBody = body !== undefined && body !== null;
  const payload = hasBody ? JSON.stringify(body) : null;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  if (hasBody) {
    headers["Content-Length"] = Buffer.byteLength(payload);
  }

  const options = {
    method,
    hostname: host,
    path: fullPath,
    headers,
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        const parsed = parseJsonSafely(data);
        const status = res.statusCode || 500;

        if (status >= 200 && status < 300) {
          return resolve({ response: parsed ?? data, status });
        }

        return resolve({
          error:
            parsed?.error ||
            parsed?.message ||
            "Uber Direct API error.",
          status,
          details: parsed ?? data,
        });
      });
    });

    req.on("error", (err) => resolve({ error: err.message }));
    if (hasBody) {
      req.write(payload);
    }
    req.end();
  });
};

const uberDirectRequest = async ({ method, path, body, query, scope }) => {
  const initialToken = await getUberDirectAccessTokenService({ scope });
  if (initialToken.error) {
    logTokenFlow("Echec recuperation token initial", {
      scope: scope || null,
      method,
      path,
      error: initialToken.error,
    });
    return {
      error: initialToken.error,
      details: initialToken.details,
    };
  }
  logTokenFlow("Token initial applique", {
    scope: scope || initialToken.scope || null,
    source: initialToken.source || null,
    method,
    path,
    expires_at: initialToken.expiresAt || null,
    expires_in: initialToken.expiresIn || null,
  });

  let result = await makeRequest({
    method,
    path,
    body,
    query,
    token: initialToken.token,
  });

  if (result.status === 401) {
    logTokenFlow("Requete Uber en 401, refresh force", {
      scope: scope || initialToken.scope || null,
      method,
      path,
    });
    const refreshed = await getUberDirectAccessTokenService({
      forceRefresh: true,
      scope,
    });
    if (refreshed.error) {
      logTokenFlow("Echec refresh token apres 401", {
        scope: scope || null,
        method,
        path,
        error: refreshed.error,
      });
      return {
        error: refreshed.error,
        details: refreshed.details,
      };
    }
    logTokenFlow("Refresh token reussi, retry requete Uber", {
      scope: scope || refreshed.scope || null,
      source: refreshed.source || null,
      method,
      path,
      expires_at: refreshed.expiresAt || null,
      expires_in: refreshed.expiresIn || null,
    });

    result = await makeRequest({
      method,
      path,
      body,
      query,
      token: refreshed.token,
    });
  }

  if (!result.error) {
    logTokenFlow("Requete Uber terminee avec succes", {
      scope: scope || initialToken.scope || null,
      method,
      path,
      status: result.status || 200,
    });
  } else {
    logTokenFlow("Requete Uber terminee en erreur", {
      scope: scope || initialToken.scope || null,
      method,
      path,
      status: result.status || null,
      error: result.error || null,
    });
  }

  return result;
};

module.exports = {
  uberDirectRequest,
};
