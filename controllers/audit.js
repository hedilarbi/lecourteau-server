const Audit = require("../models/Audit");

const getAllAudits = async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const pageNumber = Math.max(1, Number(page) || 1);
  const limitNumber = Math.max(1, Number(limit) || 50);
  const staff = req.user;
  try {
    const audits = await Audit.find()
      .populate("userId")
      .populate("details")
      .sort({ timestamp: -1, _id: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    const total = await Audit.countDocuments();

    res.json({
      audits,
      total,
      page: pageNumber,
      pages: Math.ceil(total / limitNumber),
    });
  } catch (error) {
    console.error("Error fetching audits:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteAllAudits = async (req, res) => {
  try {
    await Audit.deleteMany({});
    res.json({ message: "All audits have been deleted." });
  } catch (error) {
    console.error("Error deleting audits:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { getAllAudits, deleteAllAudits };
