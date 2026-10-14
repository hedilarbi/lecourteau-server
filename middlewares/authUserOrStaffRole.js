const jwt = require("jsonwebtoken");
const authUser = require("./authUser");
const authStaff = require("./authStaff");
const requireStaffRole = require("./requireStaffRole");

const isUserToken = (req) => {
  const [scheme, token] = String(req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) return false;
  try {
    jwt.verify(token, process.env.SECRET_KEY);
    return true;
  } catch (err) {
    return false;
  }
};

// Accepte le client propriétaire du compte ciblé (:id), ou un staff ayant
// l'un des rôles donnés (n'importe quel staff si aucun rôle n'est donné).
const authUserOrStaffRole = (...roles) => {
  const checkStaffRole = requireStaffRole(...roles);

  return (req, res, next) => {
    if (isUserToken(req)) return authUser(req, res, next);
    return authStaff(req, res, () => checkStaffRole(req, res, next));
  };
};

module.exports = authUserOrStaffRole;
