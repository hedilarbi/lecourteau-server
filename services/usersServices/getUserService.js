const User = require("../../models/User");
const {
  refreshUserSubscriptionFromStripe,
} = require("../subscriptionServices/subscriptionHelpers");

const getUserService = async (id) => {
  try {
    await refreshUserSubscriptionFromStripe(id);
    const response = await User.findById(id).populate("orders");
    if (!response) {
      return { response: null };
    }

    const normalizedUser = response.toObject();
    const now = new Date();
    const currentCycleKey = `${now.getUTCFullYear()}-${String(
      now.getUTCMonth() + 1,
    ).padStart(2, "0")}`;

    const savingsTotal = Number(normalizedUser.subscriptionSavingsTotal);
    const freeItemUsedCount =
      normalizedUser.subscriptionFreeItemCycleKey === currentCycleKey
        ? Number(normalizedUser.subscriptionFreeItemUsedCount)
        : 0;
    const monthlyPrice = Number(normalizedUser.subscriptionMonthlyPrice);

    normalizedUser.subscriptionSavingsTotal = Number.isFinite(savingsTotal)
      ? savingsTotal
      : 0;
    normalizedUser.subscriptionStatus =
      normalizedUser.subscriptionStatus || "inactive";
    normalizedUser.subscriptionAutoRenew = Boolean(
      normalizedUser.subscriptionAutoRenew,
    );
    normalizedUser.subscriptionIsActive = Boolean(
      normalizedUser.subscriptionIsActive,
    );
    normalizedUser.subscriptionMonthlyPrice = Number.isFinite(monthlyPrice)
      ? monthlyPrice
      : 11.99;
    normalizedUser.subscriptionFreeItemCycleKey = currentCycleKey;
    normalizedUser.subscriptionFreeItemUsedCount = Number.isFinite(
      freeItemUsedCount,
    )
      ? freeItemUsedCount
      : 0;

    return { response: normalizedUser };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getUserService,
};
