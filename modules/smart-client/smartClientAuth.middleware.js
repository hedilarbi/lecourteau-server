const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Staff = require("../../models/staff");

const SMART_CLIENT_ROLES = new Set(["admin", "manager"]);

const loadAdminScope = async (req, res, next) => {
  try {
    const staffId = req.staff?.id;
    if (!mongoose.isValidObjectId(staffId)) {
      return res.status(403).json({ success: false, error: "FORBIDDEN", message: "Accès refusé." });
    }
    const staff = await Staff.findById(staffId).select("role").lean();
    if (!staff || !SMART_CLIENT_ROLES.has(String(staff.role || "").toLowerCase())) {
      return res.status(403).json({ success: false, error: "FORBIDDEN", message: "Accès Smart Client refusé." });
    }
    req.smartClientScope = {
      staffId: staff._id,
      role: String(staff.role).toLowerCase(),
    };
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { loadAdminScope };

const authClient = (req, res, next) => {
  const [scheme, token] = String(req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ success: false, error: "UNAUTHORIZED", message: "Session client requise." });
  }
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const id = decoded?.id ? String(decoded.id) : "";
    if (!mongoose.isValidObjectId(id)) throw new Error("invalid user");
    req.user = { id, token };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: "UNAUTHORIZED", message: "Session client invalide." });
  }
};

module.exports.authClient = authClient;
