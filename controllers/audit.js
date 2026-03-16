const Audit = require("../models/Audit");

const getAllAudits = async (req, res) => {
  const { page = 1, limit = 50, from, to } = req.query;
  const pageNumber = Math.max(1, Number(page) || 1);
  const limitNumber = Math.max(1, Number(limit) || 50);
  const query = {};

  if (from || to) {
    query.timestamp = {};
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) {
        fromDate.setHours(0, 0, 0, 0);
        query.timestamp.$gte = fromDate;
      }
    }

    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999);
        query.timestamp.$lte = toDate;
      }
    }

    if (Object.keys(query.timestamp).length === 0) {
      delete query.timestamp;
    }
  }
  try {
    const audits = await Audit.find(query)
      .populate("userId", "name email username")
      .populate({
        path: "details",
        select: "code orderCode user name",
        populate: {
          path: "user",
          select: "name email username",
        },
      })
      .sort({ timestamp: -1, _id: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    const total = await Audit.countDocuments(query);

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
