const jwt = require("jsonwebtoken");

const unauthorized = (res) =>
  res.status(401).json({
    success: false,
    error: "UNAUTHORIZED",
    message: "Session invalide. Veuillez vous reconnecter.",
  });

// Authentifie un client avec son token. Si la route cible un utilisateur
// (:id), vérifie aussi qu'il s'agit bien de l'utilisateur du token.
const authUser = (req, res, next) => {
  const [scheme, token] = String(req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) return unauthorized(res);

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.SECRET_KEY);
  } catch (err) {
    return unauthorized(res);
  }

  const userId = decoded?.id ? String(decoded.id) : "";
  if (!userId) return unauthorized(res);

  if (req.params.id && String(req.params.id) !== userId) {
    return res.status(403).json({
      success: false,
      error: "FORBIDDEN",
      message: "Action non autorisée.",
    });
  }

  req.user = { id: userId, token };
  next();
};

module.exports = authUser;
