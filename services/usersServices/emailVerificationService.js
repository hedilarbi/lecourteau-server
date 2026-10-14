const crypto = require("crypto");
const User = require("../../models/User");
const EmailVerificationCode = require("../../models/EmailVerificationCode");
const {
  sendEmailVerificationCodeMail,
} = require("../mailServices/emailVerificationMailService");

const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_WINDOW = 5;
const SEND_WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const EMAIL_VERIFICATION_BONUS_POINTS = 50;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hashCode = (userId, code) =>
  crypto
    .createHmac("sha256", process.env.SECRET_KEY)
    .update(`${userId}:${code}`)
    .digest("hex");

// Le courriel actuel d'un compte peut être partagé avec d'anciens comptes
// (données antérieures à la vérification d'unicité) : on ne bloque alors que
// si un autre compte l'a déjà vérifié. Un nouveau courriel suit la règle
// habituelle et ne doit appartenir à aucun autre compte.
const isEmailTakenByAnotherUser = async (email, userId, isCurrentEmail) => {
  const owner = await User.findOne({
    email: { $regex: `^${escapeRegex(email)}$`, $options: "i" },
    _id: { $ne: userId },
    ...(isCurrentEmail ? { emailVerified: true } : {}),
  })
    .select("_id")
    .lean();
  return Boolean(owner);
};

const sendEmailVerificationOtpService = async (userId, rawEmail) => {
  const user = await User.findById(userId)
    .select("name email emailVerified")
    .lean();
  if (!user) return { error: "USER_NOT_FOUND" };

  const email = normalizeEmail(rawEmail || user.email);
  if (!EMAIL_REGEX.test(email)) return { error: "INVALID_EMAIL" };

  const isCurrentEmail = email === normalizeEmail(user.email);
  if (isCurrentEmail && user.emailVerified) return { error: "ALREADY_VERIFIED" };
  if (await isEmailTakenByAnotherUser(email, userId, isCurrentEmail)) {
    return { error: "EMAIL_TAKEN" };
  }

  const now = new Date();
  const existing = await EmailVerificationCode.findOne({ user: userId }).lean();
  if (existing) {
    const retryAfterSeconds = Math.ceil(
      (existing.lastSentAt.getTime() + RESEND_COOLDOWN_SECONDS * 1000 - now.getTime()) / 1000,
    );
    if (retryAfterSeconds > 0) return { error: "RESEND_TOO_SOON", retryAfterSeconds };
  }

  const isWindowActive =
    existing && now.getTime() - existing.sendWindowStartedAt.getTime() < SEND_WINDOW_MS;
  const sendWindowStartedAt = isWindowActive ? existing.sendWindowStartedAt : now;
  const sendCount = isWindowActive ? existing.sendCount : 0;
  if (sendCount >= MAX_SENDS_PER_WINDOW) {
    return {
      error: "TOO_MANY_REQUESTS",
      retryAfterSeconds: Math.ceil(
        (sendWindowStartedAt.getTime() + SEND_WINDOW_MS - now.getTime()) / 1000,
      ),
    };
  }

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const fields = {
    email,
    codeHash: hashCode(userId, code),
    expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000),
    attempts: 0,
    lastSentAt: now,
    sendCount: sendCount + 1,
    sendWindowStartedAt,
  };

  // Réserve l'envoi avant d'appeler SES : deux requêtes simultanées ne
  // peuvent pas contourner le délai entre deux envois.
  try {
    if (existing) {
      const { modifiedCount } = await EmailVerificationCode.updateOne(
        { _id: existing._id, lastSentAt: existing.lastSentAt },
        { $set: fields },
      );
      if (!modifiedCount) {
        return { error: "RESEND_TOO_SOON", retryAfterSeconds: RESEND_COOLDOWN_SECONDS };
      }
    } else {
      await EmailVerificationCode.create({ user: userId, ...fields });
    }
  } catch (err) {
    if (err?.code === 11000) {
      return { error: "RESEND_TOO_SOON", retryAfterSeconds: RESEND_COOLDOWN_SECONDS };
    }
    throw err;
  }

  try {
    await sendEmailVerificationCodeMail({
      to: email,
      name: user.name,
      code,
      expiresInMinutes: CODE_TTL_MINUTES,
    });
  } catch (err) {
    console.error("[emailVerification] Échec d'envoi pour", email, err);
    await EmailVerificationCode.deleteOne({ user: userId, lastSentAt: now });
    return { error: "MAIL_FAILED" };
  }

  return {
    email,
    expiresInSeconds: CODE_TTL_MINUTES * 60,
    resendAvailableInSeconds: RESEND_COOLDOWN_SECONDS,
  };
};

const verifyEmailOtpService = async (userId, rawCode) => {
  const code = String(rawCode || "").replace(/\D/g, "");
  if (code.length !== 6) return { error: "OTP_INVALID" };

  const now = new Date();
  // Chaque essai consomme une tentative de façon atomique avant la comparaison.
  const record = await EmailVerificationCode.findOneAndUpdate(
    { user: userId, expiresAt: { $gt: now }, attempts: { $lt: MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { new: true },
  ).lean();

  if (!record) {
    const hasActiveCode = await EmailVerificationCode.exists({
      user: userId,
      expiresAt: { $gt: now },
    });
    return { error: hasActiveCode ? "TOO_MANY_ATTEMPTS" : "OTP_EXPIRED" };
  }

  const isMatch = crypto.timingSafeEqual(
    Buffer.from(record.codeHash, "hex"),
    Buffer.from(hashCode(userId, code), "hex"),
  );
  if (!isMatch) {
    const attemptsLeft = Math.max(0, MAX_ATTEMPTS - record.attempts);
    return { error: attemptsLeft > 0 ? "OTP_INVALID" : "TOO_MANY_ATTEMPTS", attemptsLeft };
  }

  const user = await User.findById(userId).select("email").lean();
  if (!user) return { error: "USER_NOT_FOUND" };

  const isCurrentEmail = record.email === normalizeEmail(user.email);
  if (await isEmailTakenByAnotherUser(record.email, userId, isCurrentEmail)) {
    await EmailVerificationCode.deleteOne({ _id: record._id });
    return { error: "EMAIL_TAKEN" };
  }

  await User.updateOne(
    { _id: userId },
    { $set: { email: record.email, emailVerified: true, emailVerifiedAt: now } },
  );
  await EmailVerificationCode.deleteOne({ _id: record._id });

  // +50 points, une seule fois par compte : la condition sur emailVerificationBonusAwardedAt rend
  // l'attribution atomique (deux validations simultanées ne créditent pas deux fois).
  const { modifiedCount } = await User.updateOne(
    { _id: userId, emailVerificationBonusAwardedAt: null },
    {
      $inc: { fidelity_points: EMAIL_VERIFICATION_BONUS_POINTS },
      $set: { emailVerificationBonusAwardedAt: now },
    },
  );

  return {
    email: record.email,
    pointsAwarded: modifiedCount > 0 ? EMAIL_VERIFICATION_BONUS_POINTS : 0,
  };
};

module.exports = {
  EMAIL_VERIFICATION_BONUS_POINTS,
  sendEmailVerificationOtpService,
  verifyEmailOtpService,
};
