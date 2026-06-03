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
const Order = require("../models/Order");
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_PRIVATE_KEY, { apiVersion: "2023-08-16" });
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
    if (error === "EMAIL_TAKEN") {
      return res.status(409).json({ success: false, error: "EMAIL_TAKEN", message: "Cette adresse courriel est déjà utilisée." });
    }
    if (error) {
      return res.status(400).json({ success: false, error });
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

    if (error === "EMAIL_TAKEN") {
      return res.status(409).json({ success: false, error: "EMAIL_TAKEN", message: "Cette adresse courriel est déjà utilisée." });
    }
    if (error) {
      return res.status(400).json({ success: false, error });
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

const getDuplicatePhoneAccounts = async (req, res) => {
  try {
    const users = await User.find({}, {
      _id: 1,
      phone_number: 1,
      name: 1,
      email: 1,
      createdAt: 1,
      is_profile_setup: 1,
      subscriptionStatus: 1,
      subscriptionStripeSubscriptionId: 1,
      subscriptionCurrentPeriodEnd: 1,
      stripe_id: 1,
      orders: 1,
    }).lean();

    const normalizePhone = (raw) => {
      const digits = String(raw || "").replace(/\D/g, "");
      if (digits.startsWith("11") && digits.length === 12) return "+" + digits.slice(1);
      if (digits.startsWith("1") && digits.length === 11) return "+" + digits;
      if (digits.length === 10) return "+1" + digits;
      return digits ? "+" + digits : null;
    };

    const groups = new Map();

    for (const user of users) {
      const normalized = normalizePhone(user.phone_number);
      if (!normalized) continue;
      if (!groups.has(normalized)) groups.set(normalized, []);
      groups.get(normalized).push({ ...user, normalizedPhone: normalized });
    }

    const duplicates = [];
    for (const [normalizedPhone, accounts] of groups) {
      if (accounts.length < 2) continue;
      accounts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      duplicates.push({
        normalizedPhone,
        count: accounts.length,
        accounts: accounts.map((u) => ({
          _id: u._id,
          phone_number_raw: u.phone_number,
          name: u.name || null,
          email: u.email || null,
          createdAt: u.createdAt,
          is_profile_setup: Boolean(u.is_profile_setup),
          stripe_id: u.stripe_id || null,
          subscriptionStatus: u.subscriptionStatus || null,
          subscriptionStripeSubscriptionId: u.subscriptionStripeSubscriptionId || null,
          subscriptionCurrentPeriodEnd: u.subscriptionCurrentPeriodEnd || null,
          ordersCount: Array.isArray(u.orders) ? u.orders.length : 0,
        })),
      });
    }

    duplicates.sort((a, b) => b.count - a.count);

    res.status(200).json({
      success: true,
      duplicateGroupsCount: duplicates.length,
      duplicates,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const normalizePhoneNumbers = async (req, res) => {
  const dryRun = req.query.dry !== "false";

  try {
    const users = await User.find({}, {
      _id: 1,
      phone_number: 1,
      name: 1,
      email: 1,
      createdAt: 1,
      is_profile_setup: 1,
      subscriptionStatus: 1,
      stripe_id: 1,
      orders: 1,
    }).lean();

    const normalizePhone = (raw) => {
      const digits = String(raw || "").replace(/\D/g, "");
      if (digits.startsWith("11") && digits.length === 12) return "+" + digits.slice(1);
      if (digits.startsWith("1") && digits.length === 11) return "+" + digits;
      if (digits.length === 10) return "+1" + digits;
      return digits ? "+" + digits : null;
    };

    const normalizedMap = new Map();
    for (const user of users) {
      const normalized = normalizePhone(user.phone_number);
      if (!normalized) continue;
      if (!normalizedMap.has(normalized)) normalizedMap.set(normalized, []);
      normalizedMap.get(normalized).push(user);
    }

    const toUpdate = [];
    const collisions = [];
    const alreadyClean = [];

    for (const user of users) {
      const normalized = normalizePhone(user.phone_number);
      if (!normalized) continue;

      if (user.phone_number === normalized) {
        alreadyClean.push({ _id: user._id, phone_number: user.phone_number });
        continue;
      }

      const group = normalizedMap.get(normalized) || [];
      const otherUsersWithSameNormalized = group.filter(
        (u) => String(u._id) !== String(user._id),
      );

      const entry = {
        _id: user._id,
        phone_number_before: user.phone_number,
        phone_number_after: normalized,
        name: user.name || null,
        email: user.email || null,
        createdAt: user.createdAt,
        is_profile_setup: Boolean(user.is_profile_setup),
        subscriptionStatus: user.subscriptionStatus || null,
        stripe_id: user.stripe_id || null,
        ordersCount: Array.isArray(user.orders) ? user.orders.length : 0,
      };

      if (otherUsersWithSameNormalized.length > 0) {
        collisions.push({
          ...entry,
          collidesWithIds: otherUsersWithSameNormalized.map((u) => String(u._id)),
        });
      } else {
        toUpdate.push(entry);
      }
    }

    if (!dryRun && toUpdate.length > 0) {
      const bulkOps = toUpdate.map((u) => ({
        updateOne: {
          filter: { _id: u._id },
          update: { $set: { phone_number: u.phone_number_after } },
        },
      }));
      await User.bulkWrite(bulkOps);
    }

    res.status(200).json({
      success: true,
      dryRun,
      summary: {
        total: users.length,
        alreadyClean: alreadyClean.length,
        updated: dryRun ? 0 : toUpdate.length,
        wouldUpdate: toUpdate.length,
        collisions: collisions.length,
      },
      updated: toUpdate,
      collisions,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const forceMergeAccounts = async (req, res) => {
  const { masterId, duplicateId } = req.body;
  const dryRun = req.query.dry !== "false";

  if (!masterId || !duplicateId) {
    return res.status(400).json({ success: false, error: "masterId et duplicateId sont requis." });
  }
  if (String(masterId) === String(duplicateId)) {
    return res.status(400).json({ success: false, error: "masterId et duplicateId doivent être différents." });
  }

  try {
    const [master, duplicate] = await Promise.all([
      User.findById(masterId).lean(),
      User.findById(duplicateId).lean(),
    ]);

    if (!master) return res.status(404).json({ success: false, error: "Compte master introuvable." });
    if (!duplicate) return res.status(404).json({ success: false, error: "Compte doublon introuvable." });

    const duplicateOrdersCount = Array.isArray(duplicate.orders) ? duplicate.orders.length : 0;
    const duplicateFidelityPoints = Number(duplicate.fidelity_points) || 0;
    const duplicateSubId = duplicate.subscriptionStripeSubscriptionId || null;

    const isActiveSubscription = (user) => {
      const status = String(user.subscriptionStatus || "").toLowerCase().trim();
      const statusActive = status === "active" || status === "trialing";
      if (!statusActive) return false;
      const periodEnd = user.subscriptionCurrentPeriodEnd
        ? new Date(user.subscriptionCurrentPeriodEnd)
        : null;
      if (!periodEnd || isNaN(periodEnd.getTime())) return true;
      return periodEnd.getTime() > Date.now();
    };

    const duplicateHasActiveSub = isActiveSubscription(duplicate);

    let stripeCancelResult = null;
    if (duplicateHasActiveSub && duplicateSubId) {
      if (!dryRun) {
        try {
          const canceled = await stripe.subscriptions.cancel(duplicateSubId);
          stripeCancelResult = { canceled: true, subscriptionId: duplicateSubId, status: canceled.status };
        } catch (stripeErr) {
          return res.status(500).json({
            success: false,
            error: `Échec annulation Stripe (${duplicateSubId}): ${stripeErr.message}`,
          });
        }
      } else {
        stripeCancelResult = { canceled: false, dryRun: true, subscriptionId: duplicateSubId };
      }
    }

    const preview = {
      dryRun,
      master: { _id: master._id, phone_number: master.phone_number, ordersCount: Array.isArray(master.orders) ? master.orders.length : 0 },
      duplicate: { _id: duplicate._id, phone_number: duplicate.phone_number, ordersCount: duplicateOrdersCount, subscriptionCanceled: duplicateHasActiveSub },
      ordersToReassign: duplicateOrdersCount,
      fidelityPointsToTransfer: duplicateFidelityPoints,
      stripeSubscriptionCanceled: stripeCancelResult,
    };

    if (!dryRun) {
      // 1. Réassigner les commandes
      if (duplicateOrdersCount > 0) {
        await Order.updateMany({ user: duplicate._id }, { $set: { user: master._id } });
      }

      // 2. Fusionner les points de fidélité + normaliser le téléphone
      const normalizePhone = (raw) => {
        const digits = String(raw || "").replace(/\D/g, "");
        if (digits.startsWith("11") && digits.length === 12) return "+" + digits.slice(1);
        if (digits.startsWith("1") && digits.length === 11) return "+" + digits;
        if (digits.length === 10) return "+1" + digits;
        return digits ? "+" + digits : master.phone_number;
      };

      await User.findByIdAndUpdate(master._id, {
        $inc: { fidelity_points: duplicateFidelityPoints },
        $set: { phone_number: normalizePhone(master.phone_number) },
      });

      // 3. Supprimer le doublon
      await User.findByIdAndDelete(duplicate._id);
    }

    res.status(200).json({ success: true, ...preview });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const cleanupDuplicatePhones = async (req, res) => {
  const dryRun = req.query.dry !== "false";

  const normalizePhone = (raw) => {
    const digits = String(raw || "").replace(/\D/g, "");
    if (digits.startsWith("11") && digits.length === 12) return "+" + digits.slice(1);
    if (digits.startsWith("1") && digits.length === 11) return "+" + digits;
    if (digits.length === 10) return "+1" + digits;
    return digits ? "+" + digits : null;
  };

  const isActiveSubscription = (user) => {
    const status = String(user.subscriptionStatus || "").toLowerCase().trim();
    const statusActive = status === "active" || status === "trialing";
    if (!statusActive) return false;
    const periodEnd = user.subscriptionCurrentPeriodEnd
      ? new Date(user.subscriptionCurrentPeriodEnd)
      : null;
    if (!periodEnd || isNaN(periodEnd.getTime())) return true;
    return periodEnd.getTime() > Date.now();
  };

  try {
    const users = await User.find({}, {
      _id: 1, phone_number: 1, name: 1, email: 1, createdAt: 1,
      is_profile_setup: 1, stripe_id: 1, fidelity_points: 1,
      subscriptionStatus: 1, subscriptionIsActive: 1,
      subscriptionStripeSubscriptionId: 1, subscriptionCurrentPeriodEnd: 1,
      orders: 1,
    }).lean();

    // Group by normalized phone
    const groups = new Map();
    for (const user of users) {
      const normalized = normalizePhone(user.phone_number);
      if (!normalized) continue;
      if (!groups.has(normalized)) groups.set(normalized, []);
      groups.get(normalized).push(user);
    }

    const results = {
      skipped_multi_subscriptions: [],
      merged: [],
      nothing_to_do: [],
    };

    const bulkOrderUpdates = [];
    const userIdsToDelete = [];
    const userUpdates = [];

    for (const [normalizedPhone, accounts] of groups) {
      if (accounts.length < 2) continue;

      const ordersCount = (u) => Array.isArray(u.orders) ? u.orders.length : 0;

      // Separate accounts with orders vs ghost accounts (0 orders)
      const withOrders = accounts.filter((u) => ordersCount(u) > 0);
      const ghosts = accounts.filter((u) => ordersCount(u) === 0);

      // Check how many accounts with active subscription
      const withActiveSub = withOrders.filter((u) => isActiveSubscription(u));
      if (withActiveSub.length >= 2) {
        results.skipped_multi_subscriptions.push({
          normalizedPhone,
          accounts: accounts.map((u) => ({
            _id: u._id,
            phone_number_raw: u.phone_number,
            ordersCount: ordersCount(u),
            subscriptionStatus: u.subscriptionStatus,
            subscriptionStripeSubscriptionId: u.subscriptionStripeSubscriptionId,
          })),
        });
        continue;
      }

      // Choose master
      let master;
      if (withOrders.length === 0) {
        // All are ghosts — keep the oldest, delete the rest
        const sorted = [...accounts].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        master = sorted[0];
      } else if (withOrders.length === 1) {
        master = withOrders[0];
      } else {
        // Multiple accounts with orders
        // Prefer active subscription first
        if (withActiveSub.length === 1) {
          master = withActiveSub[0];
        } else {
          // No active subscription — pick highest ordersCount
          master = withOrders.reduce((best, u) =>
            ordersCount(u) > ordersCount(best) ? u : best,
          withOrders[0]);
        }
      }

      const toDelete = accounts.filter(
        (u) => String(u._id) !== String(master._id)
      );

      // Accumulate fidelity points to transfer
      const totalExtraPoints = toDelete.reduce(
        (sum, u) => sum + (Number(u.fidelity_points) || 0),
        0
      );

      const mergeEntry = {
        normalizedPhone,
        master: {
          _id: master._id,
          phone_number_raw: master.phone_number,
          phone_number_normalized: normalizedPhone,
          ordersCount: ordersCount(master),
          subscriptionStatus: master.subscriptionStatus,
          fidelity_points_before: Number(master.fidelity_points) || 0,
          fidelity_points_after: (Number(master.fidelity_points) || 0) + totalExtraPoints,
        },
        deleted: toDelete.map((u) => ({
          _id: u._id,
          phone_number_raw: u.phone_number,
          ordersCount: ordersCount(u),
          fidelity_points_transferred: Number(u.fidelity_points) || 0,
        })),
      };
      results.merged.push(mergeEntry);

      if (!dryRun) {
        // 1. Update orders: replace toDelete user IDs with master ID
        for (const deleted of toDelete) {
          if (ordersCount(deleted) > 0) {
            bulkOrderUpdates.push({
              updateMany: {
                filter: { user: deleted._id },
                update: { $set: { user: master._id } },
              },
            });
          }
          userIdsToDelete.push(deleted._id);
        }

        // 2. Update master: normalize phone + merge fidelity points
        userUpdates.push({
          updateOne: {
            filter: { _id: master._id },
            update: {
              $set: { phone_number: normalizedPhone },
              $inc: { fidelity_points: totalExtraPoints },
            },
          },
        });
      }
    }

    if (!dryRun) {
      if (bulkOrderUpdates.length > 0) {
        await Order.bulkWrite(bulkOrderUpdates);
      }
      if (userUpdates.length > 0) {
        await User.bulkWrite(userUpdates);
      }
      if (userIdsToDelete.length > 0) {
        await User.deleteMany({ _id: { $in: userIdsToDelete } });
      }
    }

    res.status(200).json({
      success: true,
      dryRun,
      summary: {
        groupsProcessed: results.merged.length,
        groupsSkipped_multiSubscriptions: results.skipped_multi_subscriptions.length,
        accountsDeleted: dryRun ? 0 : userIdsToDelete.length,
        accountsWouldDelete: results.merged.reduce((sum, g) => sum + g.deleted.length, 0),
        ordersReassigned: dryRun ? 0 : bulkOrderUpdates.length,
      },
      skipped_multi_subscriptions: results.skipped_multi_subscriptions,
      merged: results.merged,
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
  getDuplicatePhoneAccounts,
  normalizePhoneNumbers,
  cleanupDuplicatePhones,
  forceMergeAccounts,
};
