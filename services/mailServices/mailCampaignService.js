const fs = require("fs/promises");
const path = require("path");
const nodemailer = require("nodemailer");
const User = require("../../models/User");

// Déposer le kit à envoyer dans ce fichier : il est relu à chaque envoi.
const KIT_PATH = path.join(__dirname, "../../mail-kits/kit.html");

const unsubscribeUrl = (email) => `https://lecourteau.com/users/desabonnement?email=${encodeURIComponent(email)}`;

const decodeEntities = (value) => value
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'");

const loadKit = async () => {
  let html;
  try {
    html = await fs.readFile(KIT_PATH, "utf8");
  } catch (error) {
    throw new Error("Kit introuvable : déposez le fichier dans mail-kits/kit.html.");
  }
  if (!html.trim()) throw new Error("Le kit mail-kits/kit.html est vide.");
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return { html, title: title ? decodeEntities(title[1]).replace(/\s+/g, " ").trim() : "" };
};

const unsubscribeFooter = (email) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1a1a1a"><tr><td align="center" style="padding:20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#999999;">Vous recevez ce courriel de Le Courteau.<br><a href="${unsubscribeUrl(email)}" style="display:inline-block;margin-top:10px;padding:8px 14px;border:1px solid #777777;color:#bbbbbb;text-decoration:none;">Se désabonner</a></td></tr></table>`;

// {unsubscribe_link} dans le kit est remplacé par le lien ; sinon un pied de page est ajouté avant </body>.
const buildHtml = (kitHtml, email) => {
  if (kitHtml.includes("{unsubscribe_link}")) return kitHtml.replaceAll("{unsubscribe_link}", unsubscribeUrl(email));
  const footer = unsubscribeFooter(email);
  const index = kitHtml.toLowerCase().lastIndexOf("</body>");
  return index === -1 ? kitHtml + footer : kitHtml.slice(0, index) + footer + kitHtml.slice(index);
};

const buildText = (kitHtml, email) => {
  const text = decodeEntities(kitHtml
    .replace(/<(head|style|script|title)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .replace(/<a\s[^>]*href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (match, href, label) => (/<img/i.test(label) ? "" : `${label} (${href})`))
    .replace(/<(br|\/p|\/div|\/tr|\/h\d)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
  return `${text}\n\nSe désabonner : ${unsubscribeUrl(email)}`;
};

const sendMailCampaign = async ({ mail, subject }, onProgress = () => {}) => {
  const { SES_SMTP_HOST, SES_SMTP_PORT, SES_SMTP_USER, SES_SMTP_PASSWORD, MAIL_FROM, MAIL_REPLY_TO } = process.env;
  if (![SES_SMTP_HOST, SES_SMTP_PORT, SES_SMTP_USER, SES_SMTP_PASSWORD, MAIL_FROM, MAIL_REPLY_TO].every(Boolean)) {
    throw new Error("Configuration SMTP incomplète.");
  }
  const port = Number(SES_SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Port SMTP invalide.");
  const kit = await loadKit();
  const mailSubject = subject || kit.title;
  if (!mailSubject) throw new Error("Objet manquant : ajoutez un <title> au kit ou le paramètre subject.");
  const transporter = nodemailer.createTransport({ host: SES_SMTP_HOST, port, secure: port === 465, auth: { user: SES_SMTP_USER, pass: SES_SMTP_PASSWORD } });
  const query = { email: { $type: "string", $ne: "" }, ismailsubscribed: true };
  let sent = 0;
  let recipients = 0;
  let batches = 0;
  const failed = [];
  const acceptedMessages = [];
  const seen = new Set();
  const sendBatch = async (users) => {
    batches++;
    for (const user of users) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) continue;
      const key = user.email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      recipients++;
      onProgress({ recipients, sent, failed: failed.length, batches });
      try {
        const info = await transporter.sendMail({
          from: MAIL_FROM,
          replyTo: MAIL_REPLY_TO,
          to: user.email,
          subject: mailSubject,
          html: buildHtml(kit.html, user.email),
          text: buildText(kit.html, user.email),
          list: { unsubscribe: [unsubscribeUrl(user.email), `mailto:${MAIL_REPLY_TO}?subject=desabonnement`] },
        });
        if (mail) acceptedMessages.push({ email: user.email, messageId: info.messageId, response: info.response });
        sent++;
      } catch (error) {
        console.error("[mailCampaign] Échec pour", user.email, error);
        failed.push(user.email);
      }
      onProgress({ recipients, sent, failed: failed.length, batches });
    }
  };
  if (mail) {
    const escapedMail = mail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const user = await User.findOne({ email: { $regex: `^${escapedMail}$`, $options: "i" } })
      .select("name email ismailsubscribed").lean();
    const recipientsToSend = !user
      ? [{ name: "", email: mail }]
      : user.ismailsubscribed === true
        ? [user]
        : [];
    await sendBatch(recipientsToSend);
  } else {
    let lastId;
    while (true) {
      const users = await User.find(lastId ? { ...query, _id: { $gt: lastId } } : query)
        .sort({ _id: 1 }).limit(1000).select("name email").lean();
      if (!users.length) break;
      lastId = users[users.length - 1]._id;
      await sendBatch(users);
      if (users.length < 1000) break;
    }
  }
  return { subject: mailSubject, recipients, sent, failed: failed.length, failedEmails: failed, batches, ...(mail ? { acceptedMessages } : {}) };
};

module.exports = { sendMailCampaign, loadKit, buildHtml, buildText };
