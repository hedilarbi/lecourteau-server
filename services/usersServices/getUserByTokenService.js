const User = require("../../models/User");
const jwt = require("jsonwebtoken");
const {
  refreshUserSubscriptionFromStripe,
  getSubscriptionFreeItemCycleKey,
} = require("../subscriptionServices/subscriptionHelpers");

const getUserByTokenService = async (token) => {
  try {
    const decodedData = jwt.verify(token, process.env.SECRET_KEY);
    let user = await refreshUserSubscriptionFromStripe(decodedData.id);
    if (!user) {
      user = await User.findById(decodedData.id);
    }

    if (!user) {
      return { error: "User not found" };
    }
    const normalizedUser = user.toObject();
    const currentCycleKey = getSubscriptionFreeItemCycleKey(
      normalizedUser,
      new Date(),
    );

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
    const normalizedSubscriptionStatus = String(
      normalizedUser.subscriptionStatus || "",
    )
      .toLowerCase()
      .trim();
    const statusIsActive =
      normalizedSubscriptionStatus === "active" ||
      normalizedSubscriptionStatus === "trialing";
    const subscriptionPeriodEnd = normalizedUser.subscriptionCurrentPeriodEnd
      ? new Date(normalizedUser.subscriptionCurrentPeriodEnd)
      : null;
    const hasValidPeriodEnd =
      subscriptionPeriodEnd instanceof Date &&
      !Number.isNaN(subscriptionPeriodEnd.getTime());
    const subscriptionNotExpired =
      !hasValidPeriodEnd || subscriptionPeriodEnd.getTime() > Date.now();
    normalizedUser.subscriptionIsActive =
      statusIsActive && subscriptionNotExpired;
    normalizedUser.subscriptionMonthlyPrice = Number.isFinite(monthlyPrice)
      ? monthlyPrice
      : 11.99;
    normalizedUser.subscriptionFreeItemCycleKey = currentCycleKey;
    normalizedUser.subscriptionFreeItemUsedCount = Number.isFinite(
      freeItemUsedCount,
    )
      ? freeItemUsedCount
      : 0;

    return { user: normalizedUser, error: null };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getUserByTokenService,
};
