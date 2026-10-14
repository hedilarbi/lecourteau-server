// Notifications propres au rabais divisé (split_discount), en plus de la notification
// d'activation de l'offre :
//   A. juste après la confirmation d'une étape → "votre prochain rabais est prêt" ;
//   C. moins de 24 h avant l'expiration de l'étape en cours → "dernier jour".
// Chaque notification est réservée atomiquement par étape (splitStepNotifiedFor /
// splitExpiryReminderFor) : jamais deux fois la même pour une étape donnée.
const { Expo } = require("expo-server-sdk");
const PersonalizedOffer = require("../../models/PersonalizedOffer");
const User = require("../../models/User");
const SystemStat = require("../../models/SystemStat");
const { sendSmartOfferUninstalledEmail } = require("../offersServices/smartOfferMailService");
const { formatSmartOfferDeadline } = require("../../utils/smartOfferNotificationBody");

const EXPIRY_REMINDER_WINDOW_MS = 24 * 3600 * 1000;

const getSteps = (offer) =>
  (Array.isArray(offer?.discountSteps) ? offer.discountSteps : [])
    .map(Number)
    .filter((step) => Number.isFinite(step) && step > 0);

const formatDeadline = (date) => formatSmartOfferDeadline(date);

const notifyUser = async (userId, offerId, title, body, data = null) => {
  const user = await User.findById(userId)
    .select("name email expo_token appIsInstalled emailUnsubscribed")
    .lean();
  if (!user) return false;

  if (user.expo_token && Expo.isExpoPushToken(user.expo_token) && user.appIsInstalled !== false) {
    const expo = new Expo({ useFcmV1: true });
    const [ticket] = await expo.sendPushNotificationsAsync([
      {
        to: user.expo_token,
        sound: "default",
        title,
        body,
        priority: "high",
        data: data || { type: "smart_offer", offerId: String(offerId), userId: String(user._id) },
      },
    ]);
    return ticket?.status === "ok";
  }

  if (user.email && !user.emailUnsubscribed) {
    return sendSmartOfferUninstalledEmail({
      userEmail: user.email,
      userName: user.name,
      offerTitle: title,
      offerBody: body,
      userId: String(user._id),
    });
  }
  return false;
};

/** A. À appeler quand une commande ayant utilisé une étape du rabais divisé est confirmée. */
const sendSplitStepConfirmedNotification = async (offerId) => {
  const offer = await PersonalizedOffer.findById(offerId).lean();
  if (!offer || offer.offerType !== "split_discount" || offer.status !== "active") return;

  const steps = getSteps(offer);
  const currentStep = Number(offer.currentStep) || 0;
  if (currentStep <= 0 || currentStep >= steps.length || !offer.validUntil) return;

  const claimed = await PersonalizedOffer.findOneAndUpdate(
    { _id: offer._id, splitStepNotifiedFor: { $ne: currentStep } },
    { $set: { splitStepNotifiedFor: currentStep } },
  );
  if (!claimed) return;

  const percent = steps[currentStep];
  const deadline = formatDeadline(offer.validUntil);
  const isLastStep = currentStep === steps.length - 1;

  const title = isLastStep ? "Plus qu'une commande !" : "Merci ! Votre prochain rabais est prêt";
  const body = isLastStep
    ? `Profitez de -${percent} % sur votre dernière commande avant le ${deadline}.`
    : `-${percent} % sur votre prochaine commande, valable jusqu'au ${deadline}.`;

  try {
    await notifyUser(offer.user, offer._id, title, body);
  } catch (error) {
    console.error(`[splitDiscountNotifications] Étape ${currentStep} – offre ${offer._id}:`, error.message);
  }
};

/** C. Job périodique : rappel quand l'étape en cours expire dans moins de 24 h. */
const sendSplitExpiryRemindersJob = async () => {
  try {
    // L'arrêt du système smart offers (smartOfferCronEnabled = false) ne coupe que le profilage
    // et la création d'offres : les rappels des offres déjà en cours continuent.
    const now = new Date();
    const candidates = await PersonalizedOffer.find({
      offerType: "split_discount",
      status: { $in: ["active", "viewed", "clicked"] },
      currentStep: { $gt: 0 },
      validUntil: { $gt: now, $lte: new Date(now.getTime() + EXPIRY_REMINDER_WINDOW_MS) },
    }).lean();

    for (const offer of candidates) {
      const steps = getSteps(offer);
      const currentStep = Number(offer.currentStep) || 0;
      if (currentStep >= steps.length) continue;
      if (offer.splitExpiryReminderFor === currentStep) continue;

      const claimed = await PersonalizedOffer.findOneAndUpdate(
        { _id: offer._id, splitExpiryReminderFor: { $ne: currentStep } },
        { $set: { splitExpiryReminderFor: currentStep } },
      );
      if (!claimed) continue;

      const percent = steps[currentStep];
      const lostSteps = steps.slice(currentStep + 1);
      const deadline = formatDeadline(offer.validUntil);
      const body = lostSteps.length
        ? `Votre rabais de -${percent} % expire le ${deadline}. Après, les rabais suivants (${lostSteps.map((p) => `-${p} %`).join(", ")}) seront perdus.`
        : `Votre rabais de -${percent} % expire le ${deadline} : c'est votre dernière commande à prix réduit.`;

      try {
        await notifyUser(offer.user, offer._id, `Dernier jour pour vos -${percent} %`, body);
      } catch (error) {
        console.error(`[splitDiscountNotifications] Rappel expiration – offre ${offer._id}:`, error.message);
      }
    }
  } catch (error) {
    console.error("[splitDiscountNotifications] sendSplitExpiryRemindersJob:", error.message);
  }
};

module.exports = { notifyUser, sendSplitStepConfirmedNotification, sendSplitExpiryRemindersJob };
