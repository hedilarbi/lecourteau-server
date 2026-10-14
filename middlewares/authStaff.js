const jwt = require("jsonwebtoken");
const getStaffSecretKey = require("../utils/staffSecretKey");

const authStaff = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "No token provided." });
  }

  let secretKey;
  try {
    secretKey = getStaffSecretKey();
  } catch (err) {
    console.error("[authStaff]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Configuration serveur incomplète." });
  }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res
        .status(403)
        .json({ success: false, message: "Failed to authenticate token." });
    }

    const rawStaffId =
      decoded?.id || decoded?._id || decoded?.staffId || decoded?.userId || "";
    const normalizedStaffId =
      rawStaffId && typeof rawStaffId === "object"
        ? rawStaffId?.id || rawStaffId?._id || rawStaffId?.toString?.() || ""
        : rawStaffId;

    req.staff = {
      ...decoded,
      id: normalizedStaffId || decoded?.id || "",
      _id: normalizedStaffId || decoded?._id || "",
    };
    next();
  });
};

module.exports = authStaff;
