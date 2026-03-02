const User = require("../../models/User");
const {
  refreshUserSubscriptionFromStripe,
  getSubscriptionFreeItemCycleKey,
} = require("../subscriptionServices/subscriptionHelpers");
const {
  getBirthdayBenefitSummary,
} = require("../birthdayServices/birthdayBenefitsService");

const getUserService = async (id) => {
  try {
    await refreshUserSubscriptionFromStripe(id);
    const response = await User.findById(id).populate("orders");
    if (!response) {
      return { response: null };
    }

    const normalizedUser = response.toObject();
    const currentCycleKey = getSubscriptionFreeItemCycleKey(
      normalizedUser,
      new Date(),
    );

    const savingsTotal = Number(normalizedUser.subscriptionSavingsTotal);
    const amountPaidTotal = Number(normalizedUser.subscriptionAmountPaidTotal);
    const paymentsCount = Number(normalizedUser.subscriptionPaymentsCount);
    const freeItemUsedCount =
      normalizedUser.subscriptionFreeItemCycleKey === currentCycleKey
        ? Number(normalizedUser.subscriptionFreeItemUsedCount)
        : 0;
    const monthlyPrice = Number(normalizedUser.subscriptionMonthlyPrice);

    normalizedUser.subscriptionSavingsTotal = Number.isFinite(savingsTotal)
      ? savingsTotal
      : 0;
    normalizedUser.subscriptionAmountPaidTotal = Number.isFinite(amountPaidTotal)
      ? amountPaidTotal
      : 0;
    normalizedUser.subscriptionPaymentsCount = Number.isFinite(paymentsCount)
      ? paymentsCount
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
    const birthdayBenefits = getBirthdayBenefitSummary(normalizedUser, new Date());
    normalizedUser.birthdayFreeItemCycleYear = birthdayBenefits.cycleYear;
    normalizedUser.birthdayFreeItemUsedCount = birthdayBenefits.freeItemUsedCount;
    normalizedUser.birthdayBenefits = birthdayBenefits;
    normalizedUser.isDateOfBirthMissing = !birthdayBenefits.hasDateOfBirth;

    return { response: normalizedUser };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getUserService,
};
