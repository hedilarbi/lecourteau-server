const mongoose = require("mongoose");
const Staff = require("../models/staff");

const forbidden = (res) =>
  res.status(403).json({ success: false, message: "Accès refusé." });

// À placer après authStaff. Le rôle est relu en base pour qu'un changement de
// rôle s'applique sans attendre une nouvelle connexion. Un staff supprimé est
// toujours refusé.
const checkStaff = ({ roles, allowSelf }) => {
  const allowedRoles = roles.map((role) => role.toLowerCase());

  return async (req, res, next) => {
    const staffId = req.staff?.id;
    if (!mongoose.isValidObjectId(staffId)) return forbidden(res);

    try {
      const staff = await Staff.findById(staffId).select("role").lean();
      if (!staff) return forbidden(res);

      const isSelf = allowSelf && String(req.params.id) === String(staffId);
      const role = String(staff.role || "").toLowerCase();
      const hasRole = allowedRoles.length === 0 || allowedRoles.includes(role);
      if (!isSelf && !hasRole) return forbidden(res);

      req.staff.role = staff.role;
      next();
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  };
};

// Sans rôle précisé, tout staff existant est accepté.
const requireStaffRole = (...roles) => checkStaff({ roles, allowSelf: false });

// Le staff ciblé par :id, ou un staff ayant l'un des rôles donnés.
const requireStaffSelfOrRole = (...roles) => {
  if (roles.length === 0) throw new Error("requireStaffSelfOrRole: au moins un rôle requis.");
  return checkStaff({ roles, allowSelf: true });
};

module.exports = requireStaffRole;
module.exports.requireStaffSelfOrRole = requireStaffSelfOrRole;
