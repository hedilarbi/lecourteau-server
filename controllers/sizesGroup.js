const SizesGroup = require("../models/SizesGroup");
const Size = require("../models/Size");

const createSizesGroup = async (req, res) => {
  const { name, sizes = [] } = req.body;

  if (!name) {
    return res
      .status(400)
      .json({ success: false, message: "Group name is required" });
  }

  try {
    const uniqueSizeIds = [...new Set(sizes.map(String))];

    if (uniqueSizeIds.length) {
      const validSizesCount = await Size.countDocuments({
        _id: { $in: uniqueSizeIds },
      });

      if (validSizesCount !== uniqueSizeIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more provided sizes do not exist",
        });
      }
    }

    const group = await SizesGroup.create({ name, sizes: uniqueSizeIds });
    const populatedGroup = await group.populate("sizes");

    return res.status(201).json(populatedGroup);
  } catch (err) {
    console.error("Error creating sizes group:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

const getSizesGroups = async (req, res) => {
  try {
    const groups = await SizesGroup.find().populate("sizes");
    return res.status(200).json(groups);
  } catch (err) {
    console.error("Error fetching sizes groups:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

const getSizesGroup = async (req, res) => {
  const { id } = req.params;

  try {
    const group = await SizesGroup.findById(id).populate("sizes");

    if (!group) {
      return res
        .status(404)
        .json({ success: false, message: "Sizes group not found" });
    }

    return res.status(200).json(group);
  } catch (err) {
    console.error("Error fetching sizes group:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

const updateSizesGroup = async (req, res) => {
  const { id } = req.params;
  const { name, addSizes = [], removeSizes = [] } = req.body;

  if (!name && addSizes.length === 0 && removeSizes.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Nothing to update. Provide a name or sizes to modify.",
    });
  }

  try {
    const group = await SizesGroup.findById(id);

    if (!group) {
      return res
        .status(404)
        .json({ success: false, message: "Sizes group not found" });
    }

    if (name) {
      group.name = name;
    }

    const currentSizesSet = new Set(group.sizes.map((sizeId) => sizeId.toString()));

    if (addSizes.length) {
      const uniqueAdditions = [...new Set(addSizes.map(String))];

      const validSizesCount = await Size.countDocuments({
        _id: { $in: uniqueAdditions },
      });

      if (validSizesCount !== uniqueAdditions.length) {
        return res.status(400).json({
          success: false,
          message: "One or more sizes to add do not exist",
        });
      }

      uniqueAdditions.forEach((sizeId) => {
        if (!currentSizesSet.has(sizeId)) {
          group.sizes.push(sizeId);
          currentSizesSet.add(sizeId);
        }
      });
    }

    if (removeSizes.length) {
      const removalSet = new Set(removeSizes.map(String));
      group.sizes = group.sizes.filter(
        (sizeId) => !removalSet.has(sizeId.toString())
      );
    }

    await group.save();
    const populatedGroup = await group.populate("sizes");

    return res.status(200).json(populatedGroup);
  } catch (err) {
    console.error("Error updating sizes group:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

const deleteSizesGroup = async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await SizesGroup.findByIdAndDelete(id);

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Sizes group not found" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Sizes group deleted successfully" });
  } catch (err) {
    console.error("Error deleting sizes group:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  createSizesGroup,
  getSizesGroups,
  getSizesGroup,
  updateSizesGroup,
  deleteSizesGroup,
};
