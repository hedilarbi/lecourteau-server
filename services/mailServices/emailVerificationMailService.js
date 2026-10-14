const nodemailer = require("nodemailer");

const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  const { SES_SMTP_HOST, SES_SMTP_PORT, SES_SMTP_USER, SES_SMTP_PASSWORD, MAIL_FROM } = process.env;
  if (![SES_SMTP_HOST, SES_SMTP_PORT, SES_SMTP_USER, SES_SMTP_PASSWORD, MAIL_FROM].every(Boolean)) {
    throw new Error("Configuration SMTP incomplète.");
  }
  const port = Number(SES_SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Port SMTP invalide.");
  transporter = nodemailer.createTransport({ host: SES_SMTP_HOST, port, secure: port === 465, auth: { user: SES_SMTP_USER, pass: SES_SMTP_PASSWORD } });
  return transporter;
};

const buildHtml = (name, code, expiresInMinutes) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000;color:#fff;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#000;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#000000" style="max-width:480px;background:#000000;border:1px solid #343434;">
<tr><td align="center" style="padding:28px 20px 12px;"><img src="https://www.lecourteau.com/logo.png" alt="Le Courteau" width="150" style="display:block;max-width:150px;height:auto;"></td></tr>
<tr><td align="center" style="padding:10px 20px 18px;color:#F7A600;font-size:22px;font-weight:bold;">Vérification de votre courriel</td></tr>
<tr><td style="padding:0 26px;color:#fff;font-size:15px;line-height:24px;">Bonjour${name ? ` <strong>${escapeHtml(name)}</strong>` : ""},<br><br>Voici votre code pour confirmer votre adresse courriel :</td></tr>
<tr><td align="center" style="padding:24px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" style="border:2px solid #F7A600;"><tr><td align="center" style="padding:16px 28px;color:#fff;font-size:34px;font-weight:bold;letter-spacing:10px;">${escapeHtml(code)}</td></tr></table></td></tr>
<tr><td style="padding:0 26px 26px;color:#fff;font-size:14px;line-height:22px;">Ce code expire dans ${expiresInMinutes} minutes. Si vous n’avez pas demandé cette vérification, vous pouvez ignorer ce courriel.</td></tr>
<tr><td align="center" style="padding:0 20px 24px;color:#999;font-size:12px;">Vous recevez ce courriel de Le Courteau.</td></tr>
</table></td></tr></table></body></html>`;

const sendEmailVerificationCodeMail = async ({ to, name, code, expiresInMinutes }) => {
  const { MAIL_FROM, MAIL_REPLY_TO } = process.env;
  await getTransporter().sendMail({
    from: MAIL_FROM,
    ...(MAIL_REPLY_TO ? { replyTo: MAIL_REPLY_TO } : {}),
    to,
    subject: `${code} est votre code de vérification Le Courteau`,
    html: buildHtml(name, code, expiresInMinutes),
    text: `Bonjour${name ? ` ${name}` : ""},\n\nVoici votre code pour confirmer votre adresse courriel : ${code}\n\nCe code expire dans ${expiresInMinutes} minutes. Si vous n’avez pas demandé cette vérification, vous pouvez ignorer ce courriel.`,
  });
};

module.exports = { sendEmailVerificationCodeMail };
