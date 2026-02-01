const mongoose = require("mongoose");
const ToppingGroup = require("../models/ToppingGroup");

let Topping;
try {
  // optional: if you have a Topping model you can validate existence of toppings
  Topping = require("../models/Topping");
} catch (e) {
  Topping = null;
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function validateToppingsArray(toppings = []) {
  if (!Array.isArray(toppings)) {
    throw { status: 400, message: "toppings must be an array of IDs" };
  }
  for (const tid of toppings) {
    if (!isValidObjectId(tid)) {
      throw { status: 400, message: `Invalid topping id: ${tid}` };
    }
  }
  if (Topping) {
    const count = await Topping.countDocuments({ _id: { $in: toppings } });
    if (count !== toppings.length) {
      throw { status: 400, message: "One or more topping ids do not exist" };
    }
  }
}

const defaultSelectionRule = {
  isRequired: false,
  min: 0,
  max: null, // null = no upper limit
};

function toPlainSelectionRule(rule) {
  if (!rule) return defaultSelectionRule;
  if (typeof rule.toObject === "function") return rule.toObject();
  return rule;
}

function normalizeSelectionRule(
  selectionRuleInput,
  currentRule = defaultSelectionRule
) {
  if (typeof selectionRuleInput === "undefined") {
    return { ...defaultSelectionRule, ...toPlainSelectionRule(currentRule) };
  }

  if (
    selectionRuleInput === null ||
    typeof selectionRuleInput !== "object" ||
    Array.isArray(selectionRuleInput)
  ) {
    throw { status: 400, message: "selectionRule must be an object" };
  }

  const rule = {
    ...defaultSelectionRule,
    ...toPlainSelectionRule(currentRule),
  };

  if ("isRequired" in selectionRuleInput) {
    if (typeof selectionRuleInput.isRequired !== "boolean") {
      throw {
        status: 400,
        message: "selectionRule.isRequired must be a boolean",
      };
    }
    rule.isRequired = selectionRuleInput.isRequired;
  }

  if ("min" in selectionRuleInput) {
    if (
      !Number.isInteger(selectionRuleInput.min) ||
      selectionRuleInput.min < 0
    ) {
      throw {
        status: 400,
        message: "selectionRule.min must be a non-negative integer",
      };
    }
    rule.min = selectionRuleInput.min;
  }

  if ("max" in selectionRuleInput) {
    if (
      selectionRuleInput.max !== null &&
      (!Number.isInteger(selectionRuleInput.max) || selectionRuleInput.max < 0)
    ) {
      throw {
        status: 400,
        message: "selectionRule.max must be null or a non-negative integer",
      };
    }
    rule.max = selectionRuleInput.max;
  }

  if (rule.isRequired && rule.min < 1) {
    throw {
      status: 400,
      message:
        "selectionRule.min must be at least 1 when selection is required",
    };
  }

  if (rule.max !== null && rule.max < rule.min) {
    throw {
      status: 400,
      message: "selectionRule.max cannot be less than selectionRule.min",
    };
  }

  return rule;
}

function formatGroupForResponse(group) {
  if (!group) return group;
  const plainGroup =
    typeof group.toObject === "function" ? group.toObject() : group;

  return {
    ...plainGroup,
    selectionRule: normalizeSelectionRule(undefined, plainGroup.selectionRule),
  };
}

// Create a new topping group
// POST /topping-groups
async function createToppingGroup(req, res) {
  try {
    const { name, toppings, selectionRule } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    if (typeof toppings !== "undefined") await validateToppingsArray(toppings);

    const normalizedSelectionRule = normalizeSelectionRule(selectionRule);

    const group = new ToppingGroup({
      name: name.trim(),
      toppings: toppings || [],
      selectionRule: normalizedSelectionRule,
    });

    await group.save();
    return res.status(201).json(formatGroupForResponse(group));
  } catch (err) {
    const status = err && err.status ? err.status : 500;
    return res.status(status).json({ error: err.message || "Server error" });
  }
}

// Get one topping group
// GET /topping-groups/:id
async function getToppingGroup(req, res) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id))
      return res.status(400).json({ error: "Invalid id" });

    const group = await ToppingGroup.findById(id).populate("toppings");
    if (!group)
      return res.status(404).json({ error: "ToppingGroup not found" });

    return res.status(200).json(formatGroupForResponse(group));
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
}

// List topping groups (supports pagination via ?limit=&skip=)
// GET /topping-groups
async function listToppingGroups(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
    const skip = parseInt(req.query.skip, 10) || 0;

    const [items, total] = await Promise.all([
      ToppingGroup.find().skip(skip).limit(limit).populate("toppings").exec(),
      ToppingGroup.countDocuments(),
    ]);

    const normalizedItems = items.map(formatGroupForResponse);

    return res.status(200).json(normalizedItems);
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
}

// Update a topping group (partial or full)
// PUT/PATCH /topping-groups/:id
async function updateToppingGroup(req, res) {
  try {
    const { id } = req.params;
    const { name, toppings, selectionRule } = req.body;
    if (!isValidObjectId(id))
      return res.status(400).json({ error: "Invalid id" });

    const group = await ToppingGroup.findById(id);
    if (!group)
      return res.status(404).json({ error: "ToppingGroup not found" });

    if (typeof name !== "undefined") {
      if (!name || typeof name !== "string" || !name.trim()) {
        return res
          .status(400)
          .json({ error: "name must be a non-empty string" });
      }
      group.name = name.trim();
    }

    if (typeof toppings !== "undefined") {
      await validateToppingsArray(toppings);
      group.toppings = toppings;
    }

    if (typeof selectionRule !== "undefined") {
      const currentRule = toPlainSelectionRule(group.selectionRule);
      group.selectionRule = normalizeSelectionRule(selectionRule, currentRule);
    }

    await group.save();
    await group.populate("toppings");

    return res.status(200).json(formatGroupForResponse(group));
  } catch (err) {
    const status = err && err.status ? err.status : 500;
    return res.status(status).json({ error: err.message || "Server error" });
  }
}

// Delete a topping group
// DELETE /topping-groups/:id
async function deleteToppingGroup(req, res) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id))
      return res.status(400).json({ error: "Invalid id" });

    const group = await ToppingGroup.findByIdAndDelete(id);
    if (!group)
      return res.status(404).json({ error: "ToppingGroup not found" });

    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
}

module.exports = {
  createToppingGroup,
  getToppingGroup,
  listToppingGroups,
  updateToppingGroup,
  deleteToppingGroup,
};
