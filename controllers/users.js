const {
  updateUserService,
} = require("../services/usersServices/updateUserService");
const {
  setUserInfoService,
} = require("../services/usersServices/setUserInfoService");
const {
  deleteUserService,
} = require("../services/usersServices/deleteUserService");
const {
  getUsersService,
} = require("../services/usersServices/getUsersService");
const { getUserService } = require("../services/usersServices/getUserService");
const {
  removeFromFavoritesService,
} = require("../services/usersServices/removeFromFavoritesService");
const {
  getOrdersListService,
} = require("../services/usersServices/getOrdersListService");
const {
  getFavoritesService,
} = require("../services/usersServices/getFavoritesService");
const {
  addToAddressesService,
} = require("../services/usersServices/addToAddressesService");
const {
  deleteFromAddressesService,
} = require("../services/usersServices/deleteFromAddressesService");
const {
  getUserByTokenService,
} = require("../services/usersServices/getUserByTokenService");
const {
  updateUserExpoTokenService,
} = require("../services/usersServices/updateUserExpoTokenService");
const {
  createUserService,
} = require("../services/usersServices/createUserService");

const {
  addToFavoritesService,
} = require("../services/usersServices/addToFavoritesService");
const User = require("../models/User");
const generateRandomCode = require("../utils/generateOrderCode");
const {
  resolveDateRange,
  buildOrdersAnalytics,
  toObjectId,
  DEFAULT_TIMEZONE,
} = require("../services/statsServices/analyticsHelpers");

const createUser = async (req, res) => {
  const { phone_number } = req.body;

  try {
    if (!phone_number) {
      return res
        .status(400)
        .json({ success: false, error: "Phone number is required" });
    }
    const { user, token, error } = await createUserService(phone_number);
    if (error) {
      return res.status(400).json(error);
    }

    res.status(200).json({ user, token });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateUser = async (req, res) => {
  const { email, name, date_of_birth } = req.body;
  const { id } = req.params;
  const hasDateOfBirthField = Object.prototype.hasOwnProperty.call(
    req.body || {},
    "date_of_birth",
  );

  try {
    const { response, error } = await updateUserService(
      id,
      email,
      name,
      date_of_birth,
      hasDateOfBirthField,
    );
    if (error) {
      return res.status(400).json(error);
    }
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
const setUserInfo = async (req, res) => {
  const { address, email, name, coords, date_of_birth, referralCode } = req.body;
  const { id } = req.params;

  try {
    const { response, error } = await setUserInfoService(
      id,
      address,
      email,
      name,
      coords,
      date_of_birth,
      referralCode,
    );

    if (error) {
      return res.status(400).json(error);
    }
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await deleteUserService(id);
    if (error) {
      return res.status(404).json(error);
    }
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const { response, error } = await getUsersService();
    if (error) {
      return res.status(404).json(error);
    }

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getUser = async (req, res) => {
  const { id } = req.params;
  try {
    const { response } = await getUserService(id);

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getUserStats = async (req, res) => {
  const { id } = req.params;
  try {
    if (!toObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Identifiant utilisateur invalide.",
      });
    }

    const user = await User.findById(id).select("_id name email phone_number");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur introuvable.",
      });
    }

    let defaultPreset = "all";
    if (req.query?.from || req.query?.to) defaultPreset = "custom";
    if (req.query?.date) defaultPreset = "day";
    if (req.query?.preset) defaultPreset = String(req.query.preset);
    const { preset, startDate, endDate } = resolveDateRange(
      req.query,
      defaultPreset,
    );

    const analytics = await buildOrdersAnalytics({
      startDate,
      endDate,
      userId: id,
      timezone: DEFAULT_TIMEZONE,
      topProductsLimit: 8,
    });

    return res.status(200).json({
      success: true,
      user,
      filter: {
        preset,
        startDate: startDate || null,
        endDate: endDate || null,
      },
      summary: analytics.summary,
      charts: analytics.charts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error.message || "Erreur lors du chargement des statistiques utilisateur.",
    });
  }
};

const addToFavorites = async (req, res) => {
  const { itemId } = req.body;
  const { id } = req.params;

  try {
    const { error, user } = await addToFavoritesService(id, itemId);

    if (error) {
      return res.status(400).json({ success: false, error });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const removeFromFavorites = async (req, res) => {
  const { menuItem_id } = req.body;
  const { id } = req.params;

  try {
    const { error, user } = await removeFromFavoritesService(id, menuItem_id);
    if (error) {
      return res.status(400).json({ success: false, error });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getOrdersList = async (req, res) => {
  const { id } = req.params;
  try {
    const { user } = await getOrdersListService(id);
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getFavorites = async (req, res) => {
  const { id } = req.params;
  try {
    const { error, user } = await getFavoritesService(id);
    if (error) {
      return res.status(404).json({ error });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const addToAddresses = async (req, res) => {
  const { address, coords, street_address, city, state, postal_code, country } =
    req.body;
  const { id } = req.params;
  try {
    const { error, user } = await addToAddressesService(
      id,
      address,
      coords,
      street_address,
      city,
      state,
      postal_code,
      country,
    );
    if (error) {
      return res.status(404).json({ error });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteFromAddresses = async (req, res) => {
  const { id, addressId } = req.params;
  try {
    const { error, user } = await deleteFromAddressesService(id, addressId);
    if (error) {
      return res.status(404).json({ error });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getUserByToken = async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];

  try {
    const { error, user } = await getUserByTokenService(token);

    if (error) {
      return res.status(401).json({ error });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateUserExpoToken = async (req, res) => {
  const { id } = req.params;
  const { token } = req.body;

  try {
    const { error, user } = await updateUserExpoTokenService(id, token);
    if (error) {
      return res.status(404).json({ error });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const dismissBirthdayDobPrompt = async (req, res) => {
  const { id } = req.params;

  try {
    await User.findByIdAndUpdate(
      id,
      {
        $set: {
          birthdayDobPromptDismissed: true,
        },
      },
      { new: true },
    );

    const { response, error } = await getUserService(id);
    if (error) {
      return res.status(400).json({ success: false, error });
    }

    return res.status(200).json(response);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const dismissFirstOrderDiscountPrompt = async (req, res) => {
  const { id } = req.params;

  try {
    await User.findByIdAndUpdate(
      id,
      {
        $set: {
          firstOrderDiscountPromptDismissed: true,
        },
      },
      { new: true },
    );

    const { response, error } = await getUserService(id);
    if (error) {
      return res.status(400).json({ success: false, error });
    }

    return res.status(200).json(response);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const updateUserDiscount = async (req, res) => {
  try {
    const response = await User.updateMany(
      {},
      { firstOrderDiscountApplied: false },
    );
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const savePayementDetails = async (req, res) => {
  try {
    const { customerId, paymentMethodId } = req.body;

    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ error: "user does't exist" });
      return;
    }
    exist = user.payement_cards.some((obj) => obj.customerId === customerId);
    if (exist) {
      res.status(403).json({ error: "card already saved" });
    }
    user.payement_cards.push({ customerId, paymentMethodId });
    await user.save();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUsersPagination = async (req, res) => {
  const { page, limit, name } = req.query;

  try {
    let query = {};
    if (name.length > 0) {
      query.name = { $regex: name, $options: "i" }; // Case-insensitive search
    }
    const users = await User.find(query)
      .select("name email phone_number isBanned ")
      .limit(limit * 1)
      .skip((page - 1) * limit);
    const total = await User.countDocuments(query);

    res.status(200).json({
      users,
      pages: Math.ceil(total / limit),
      page: page,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

const banUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    user.isBanned = !user.isBanned;
    await user.save();
    res.status(200).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const nullifyDefaultBirthdates = async (req, res) => {
  try {
    const start = new Date(Date.UTC(2007, 0, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(2007, 0, 1, 23, 59, 59, 999));
    const filter = {
      date_of_birth: {
        $gte: start,
        $lte: end,
      },
    };

    const matched = await User.countDocuments(filter);
    const updateResult = await User.updateMany(filter, {
      $set: {
        date_of_birth: null,
      },
    });
    const remaining = await User.countDocuments(filter);

    return res.status(200).json({
      success: true,
      message:
        "Les dates de naissance par défaut au 2007-01-01 ont été remises à null.",
      data: {
        targetDate: "2007-01-01",
        matched,
        modified:
          updateResult?.modifiedCount ?? updateResult?.nModified ?? 0,
        remaining,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

const seedReferralCodes = async (req, res) => {
  try {
    const batchSize = 500;
    let count = 0;

    while (true) {
      const usersBatch = await User.find({
        $or: [
          { referralCode: { $exists: false } },
          { referralCode: null },
          { referralCode: "" },
        ],
      }).limit(batchSize);

      if (usersBatch.length === 0) {
        break;
      }

      const operations = [];
      const codesInBatch = new Set();

      for (const user of usersBatch) {
        let code;
        let attempts = 0;
        let isUniqueInBatch = false;

        while (!isUniqueInBatch && attempts < 10) {
          code = generateRandomCode(6).toUpperCase();
          if (!codesInBatch.has(code)) {
            isUniqueInBatch = true;
            codesInBatch.add(code);
          }
          attempts++;
        }

        if (isUniqueInBatch) {
          operations.push({
            updateOne: {
              filter: { _id: user._id },
              update: { $set: { referralCode: code } },
            },
          });
        }
      }

      // Vérifier les codes par rapport à la base de données
      const existingUsers = await User.find({
        referralCode: { $in: Array.from(codesInBatch) },
      }).select("referralCode");

      const existingCodes = new Set(existingUsers.map((u) => u.referralCode));

      // Filtrer les opérations qui ont des codes en collision
      const finalOperations = operations.filter(
        (op) => !existingCodes.has(op.updateOne.update.$set.referralCode)
      );

      if (finalOperations.length > 0) {
        await User.bulkWrite(finalOperations);
        count += finalOperations.length;
      }
    }

    res.status(200).json({
      success: true,
      message: `${count} utilisateurs mis à jour avec des codes de parrainage.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  createUser,
  updateUser,
  deleteUser,
  getUser,
  getUserStats,
  getUsers,
  addToFavorites,
  getOrdersList,
  addToAddresses,
  deleteFromAddresses,
  getFavorites,
  removeFromFavorites,
  getUserByToken,
  setUserInfo,
  updateUserExpoToken,
  dismissBirthdayDobPrompt,
  dismissFirstOrderDiscountPrompt,
  updateUserDiscount,
  savePayementDetails,
  getUsersPagination,
  banUser,
  nullifyDefaultBirthdates,
  seedReferralCodes,
};
