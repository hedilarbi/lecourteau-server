// Prévient un client d'un événement sur sa commande : notification push si possible, sinon
// courriel envoyé par Amazon SES.
// Le courriel prend le relais quand le client n'a pas l'app (commande passée sur le site web),
// quand son jeton est invalide, ou quand Expo refuse la notification (ticket en erreur).
const nodemailer = require("nodemailer");
const { Expo } = require("expo-server-sdk");

const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

let sesTransporter = null;
const getSesTransporter = () => {
  if (sesTransporter) return sesTransporter;
  const { SES_SMTP_HOST, SES_SMTP_PORT, SES_SMTP_USER, SES_SMTP_PASSWORD, MAIL_FROM } = process.env;
  if (![SES_SMTP_HOST, SES_SMTP_PORT, SES_SMTP_USER, SES_SMTP_PASSWORD, MAIL_FROM].every(Boolean)) {
    throw new Error("Configuration SMTP (SES) incomplète.");
  }
  const port = Number(SES_SMTP_PORT);
  sesTransporter = nodemailer.createTransport({
    host: SES_SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SES_SMTP_USER, pass: SES_SMTP_PASSWORD },
  });
  return sesTransporter;
};

const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";

const buildEmail = (name, paragraphs) => {
  const hello = `Bonjour${firstName(name) ? ` ${firstName(name)}` : ""},`;
  const signature = "L’équipe Casse-Croûte Courteau";
  return {
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#222;line-height:1.5">${[hello, ...paragraphs, signature]
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join("")}</div>`,
    text: [hello, ...paragraphs, signature].join("\n\n"),
  };
};

/**
 * @param {object} p
 * @param {object} p.user           { name, email, expo_token, appIsInstalled }
 * @param {object} p.push           { title, body, data }
 * @param {object} p.email          { subject, paragraphs: string[] } (sans salutation ni signature)
 * @param {object} [p.deps]         { expo, transporter } pour les tests
 * @returns {Promise<"push"|"email"|null>} canal utilisé, null si le client n'a pas pu être prévenu
 */
const notifyCustomer = async ({ user, push, email, deps = {} }) => {
  const token = user?.expo_token;
  if (token && Expo.isExpoPushToken(token) && user.appIsInstalled !== false) {
    try {
      const expo = deps.expo || new Expo({ useFcmV1: true });
      const [ticket] = await expo.sendPushNotificationsAsync([
        { to: token, sound: "default", priority: "high", title: push.title, body: push.body, data: push.data },
      ]);
      if (ticket?.status === "ok") return "push";
      console.error("[notifyCustomer] Push refusée :", ticket?.details?.error || ticket?.message || "ticket invalide");
    } catch (error) {
      console.error("[notifyCustomer] Push en échec :", error.message);
    }
  }

  if (!user?.email) return null;
  try {
    const { html, text } = buildEmail(user.name, email.paragraphs);
    await (deps.transporter || getSesTransporter()).sendMail({
      from: process.env.MAIL_FROM,
      ...(process.env.MAIL_REPLY_TO ? { replyTo: process.env.MAIL_REPLY_TO } : {}),
      to: user.email,
      subject: email.subject,
      html,
      text,
    });
    return "email";
  } catch (error) {
    console.error("[notifyCustomer] Courriel en échec :", error.message);
    return null;
  }
};

module.exports = { notifyCustomer };
