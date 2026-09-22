const nodemailer = require("nodemailer");
const User = require("../../models/User");

const ticketUrl = "https://bsr3r.com/calendrier/ov2dS6VfPr7gWRd812sA";
const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

const buildHtml = (name, email = "") => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000;color:#fff;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#000;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#000000" style="max-width:480px;background:#000000;border:1px solid #343434;">
<tr><td align="center" style="padding:28px 20px 12px;"><img src="https://www.lecourteau.com/logo.png" alt="Le Courteau" width="150" style="display:block;max-width:150px;height:auto;"></td></tr>
<tr><td align="center" style="padding:10px 20px;color:#F7A600;font-size:14px;font-weight:bold;letter-spacing:2px;">SAISON 2026-27</td></tr>
<tr><td align="center" style="padding:4px 20px 18px;color:#fff;font-size:30px;font-weight:bold;line-height:36px;">MATCH D’OUVERTURE</td></tr>
<tr><td align="center" style="padding:0 20px 20px;color:#F7A600;font-size:18px;font-weight:bold;">Vendredi 25 septembre 2026 à 20 h<br><span style="color:#fff;font-size:14px;">Ouverture des portes à 17 h</span></td></tr>
<tr><td style="padding:8px 20px 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" width="40%"><img src="https://www.lecourteau.com/St-Lambert-de-Lauzon.png" alt="St-Lambert-de-Lauzon" width="100" style="max-width:100%;height:auto;"></td><td align="center" width="20%" style="color:#F7A600;font-size:24px;font-weight:bold;">VS</td><td align="center" width="40%"><img src="https://www.lecourteau.com/logo-big.png" alt="BSR Trois-Rivières" width="100" style="max-width:100%;height:auto;"></td></tr></table></td></tr>
<tr><td align="center" style="padding:0 20px 24px;color:#fff;font-size:17px;font-weight:bold;">St-Lambert-de-Lauzon vs BSR Trois-Rivières</td></tr>
<tr><td style="padding:0 26px;color:#fff;font-size:15px;line-height:24px;">Bonjour <strong>${escapeHtml(name) || "cher partisan"}</strong>,<br><br>Le match d’ouverture vous réserve toute une soirée :<br><br>• Ouverture des portes à 17 h<br>• DJ et animation sur place<br>• Restaurant et bar ouverts<br>• Un chandail remis à chacun des 100 premiers partisans !<br><br>Arrivez tôt pour profiter de l’ambiance et encourager votre BSR !</td></tr>
<tr><td style="padding:26px 20px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" valign="middle" width="44%"><img src="https://www.lecourteau.com/hotdog.jpeg" alt="Hot dog Courteau" width="175" style="display:block;width:175px;max-width:100%;height:auto;border:0;"></td><td align="center" valign="middle" width="56%" style="padding-left:16px;"><div style="color:#F7A600;font-size:24px;font-weight:bold;line-height:30px;">MATCH HOT DOG À <span style="white-space:nowrap;">1$</span></div><div style="padding-top:8px;color:#FFFFFF;font-size:15px;line-height:22px;">Les hot dogs seront à <span style="white-space:nowrap;">1$</span> pour le match.</div></td></tr></table></td></tr>
<tr><td align="center" style="padding:26px 20px 12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #F7A600;"><tr><td align="center" style="padding:18px;color:#fff;font-size:17px;line-height:26px;"><strong style="color:#F7A600;font-size:25px;">50 % de rabais</strong><br>Utilisez le code promo <strong>BSR50</strong> à l’achat de votre billet.</td></tr></table></td></tr>
<tr><td align="center" style="padding:18px 20px 28px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#F7A600" style="padding:15px 24px;"><a href="${ticketUrl}" style="color:#000;text-decoration:none;font-size:16px;font-weight:bold;">ACHETER MON BILLET</a></td></tr></table></td></tr>
<tr><td align="center" style="padding:0 20px 24px;color:#999;font-size:12px;">Vous recevez ce courriel de Le Courteau.<br><a href="https://lecourteau.com/users/desabonnement?email=${encodeURIComponent(email)}" style="display:inline-block;margin-top:10px;padding:8px 14px;border:1px solid #777;color:#bbb;text-decoration:none;">Se désabonner</a></td></tr>
</table></td></tr></table></body></html>`;

const sendOpeningMatchCampaign = async (mail, onProgress = () => {}) => {
  const { SES_SMTP_HOST, SES_SMTP_PORT, SES_SMTP_USER, SES_SMTP_PASSWORD, MAIL_FROM, MAIL_REPLY_TO } = process.env;
  if (![SES_SMTP_HOST, SES_SMTP_PORT, SES_SMTP_USER, SES_SMTP_PASSWORD, MAIL_FROM, MAIL_REPLY_TO].every(Boolean)) {
    throw new Error("Configuration SMTP incomplète.");
  }
  const port = Number(SES_SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Port SMTP invalide.");
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
        const info = await transporter.sendMail({ from: MAIL_FROM, replyTo: MAIL_REPLY_TO, to: user.email, subject: "Match d’ouverture BSR Trois-Rivières — 25 septembre 2026", html: buildHtml(user.name, user.email), text: `Bonjour ${user.name || "cher partisan"},\n\nMatch d’ouverture : St-Lambert-de-Lauzon vs BSR Trois-Rivières, vendredi 25 septembre 2026 à 20 h. Ouverture des portes à 17 h. DJ et animation, restaurant et bar ouverts. Un chandail pour les 100 premiers partisans !\n\nMATCH HOT DOG À 1$\nLes hot dogs seront à 1$ pour le match.\n\n50 % de rabais avec le code BSR50. Achetez votre billet : ${ticketUrl}` });
        if (mail) acceptedMessages.push({ email: user.email, messageId: info.messageId, response: info.response });
        sent++;
      } catch (error) {
        console.error("[openingMatchMail] Échec pour", user.email, error);
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
  return { recipients, sent, failed: failed.length, failedEmails: failed, batches, ...(mail ? { acceptedMessages } : {}) };
};

module.exports = { sendOpeningMatchCampaign, buildHtml };
