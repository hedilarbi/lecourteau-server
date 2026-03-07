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

const updateUserService = async (id, email, name, date_of_birth) => {
  try {
    const updateData = {
      name,
      email,
    };

    if (date_of_birth) {
      const normalizedDate = normalizeDateOfBirth(date_of_birth);
      if (normalizedDate) updateData.date_of_birth = normalizedDate;
    }

    await User.findOneAndUpdate(
      { _id: id },
      {
        $set: updateData,
      },
      { new: true } // This option returns the updated user
    );

    const { response, error } = await getUserService(id);
    if (error) return { error };

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  updateUserService,
};
