const nodemailer = require("nodemailer");
const {
  generateSubscriptionActivationEmail,
  generateSubscriptionRenewalSuccessEmail,
  generateSubscriptionRenewalFailedEmail,
} = require("../../utils/mailTemplateGenerators");

const logWithTimestamp = (message, extra = {}) => {
  const timeStamp = new Date().toISOString();
  console.error(
    `${timeStamp} - ${message}`,
    Object.keys(extra).length ? extra : "",
  );
};

const createMailerTransport = () =>
  nodemailer.createTransport({
    service: "icloud",
    host: "smtp.mail.me.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

const canSendEmails = () => Boolean(process.env.MAIL_USER && process.env.MAIL_PASS);

const sendMail = async ({ to, subject, html }) => {
  if (!to) return false;
  if (!canSendEmails()) {
    logWithTimestamp("Subscription email skipped: MAIL_USER/MAIL_PASS missing");
    return false;
  }

  const transporter = createMailerTransport();
  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to,
    subject,
    html,
  });
  return true;
};

const sendSubscriptionActivationEmail = async ({
  userEmail,
  userName,
  monthlyPrice,
  currency,
  currentPeriodEnd,
}) => {
  try {
    return await sendMail({
      to: userEmail,
      subject: "Bienvenue au CLUB COURTEAU",
      html: generateSubscriptionActivationEmail({
        userName,
        monthlyPrice,
        currency,
        currentPeriodEnd,
      }),
    });
  } catch (error) {
    logWithTimestamp("Error sending subscription activation email", {
      error: error.message,
      userEmail,
    });
    return false;
  }
};

const sendSubscriptionRenewalSuccessEmail = async ({
  userEmail,
  userName,
  amountPaid,
  currency,
  currentPeriodEnd,
}) => {
  try {
    return await sendMail({
      to: userEmail,
      subject: "Renouvellement CLUB COURTEAU confirmé",
      html: generateSubscriptionRenewalSuccessEmail({
        userName,
        amountPaid,
        currency,
        currentPeriodEnd,
      }),
    });
  } catch (error) {
    logWithTimestamp("Error sending subscription renewal success email", {
      error: error.message,
      userEmail,
    });
    return false;
  }
};

const sendSubscriptionRenewalFailedEmail = async ({
  userEmail,
  userName,
  amountDue,
  currency,
  nextAttemptDate,
}) => {
  try {
    return await sendMail({
      to: userEmail,
      subject: "Échec du renouvellement CLUB COURTEAU",
      html: generateSubscriptionRenewalFailedEmail({
        userName,
        amountDue,
        currency,
        nextAttemptDate,
      }),
    });
  } catch (error) {
    logWithTimestamp("Error sending subscription renewal failed email", {
      error: error.message,
      userEmail,
    });
    return false;
  }
};

module.exports = {
  sendSubscriptionActivationEmail,
  sendSubscriptionRenewalSuccessEmail,
  sendSubscriptionRenewalFailedEmail,
};
