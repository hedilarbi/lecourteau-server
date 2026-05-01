const User = require("../../models/User");
const { getUserService } = require("./getUserService");

const normalizeDateOfBirth = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const month = Number(dateOnlyMatch[2]);
      const day = Number(dateOnlyMatch[3]);
      if (
        Number.isFinite(year) &&
        Number.isFinite(month) &&
        Number.isFinite(day) &&
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= 31
      ) {
        return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
      }
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth();
  const day = parsed.getUTCDate();
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
};

const setUserInfoService = async (
  id,
  address,
  email,
  name,
  coords,
  date_of_birth,
  referralCode,
) => {
  try {
    const user = await User.findById(id);
    if (!user) return { error: "Utilisateur introuvable" };

    const hasAddress =
      typeof address === "string" &&
      address.trim().length > 0 &&
      Number.isFinite(Number(coords?.latitude)) &&
      Number.isFinite(Number(coords?.longitude));

    const updateQuery = {
      $set: {
        name: name,
        email: email,
        is_profile_setup: true,
        date_of_birth: normalizeDateOfBirth(date_of_birth),
      },
    };

    if (hasAddress) {
      updateQuery.$push = {
        addresses: {
          address,
          coords,
        },
      };
    }

    if (referralCode && !user.referredBy) {
      const referrer = await User.findOne({
        referralCode: referralCode.trim().toUpperCase(),
      });
      if (referrer && referrer._id.toString() !== id) {
        updateQuery.$set.referredBy = referrer._id;
      }
    }

    await User.findOneAndUpdate({ _id: id }, updateQuery, { new: true });

    const { response, error } = await getUserService(id);
    if (error) return { error };

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  setUserInfoService,
};
