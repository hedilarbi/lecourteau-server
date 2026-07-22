const nodemailer = require("nodemailer");

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

const generateSmartOfferUninstalledEmail = ({
  userName,
  offerTitle,
  offerBody,
  userId,
}) => {
  const safeName = userName || "Gourmand";
  const title = offerTitle || "Une offre exclusive pour vous !";
  const body = offerBody || "Profitez d'un avantage spécial sur votre prochaine commande chez Casse-croûte Courteau.";
  
  let apiUrl = process.env.API_URL || process.env.SERVER_URL || "https://api.lecourteau.com/api";
  if (!apiUrl.endsWith("/api")) {
    apiUrl = `${apiUrl.replace(/\/$/, "")}/api`;
  }
  const unsubscribeUrl = `${apiUrl}/personalized-offers/unsubscribe?userId=${userId}`;
  const appInstallUrl = process.env.APP_DOWNLOAD_URL || "https://lecourteau.com/telecharger";

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;">
  <div style="max-width:600px;margin:0 auto;padding:28px 16px;">
    <!-- Header -->
    <div style="background:#0f172a;border-radius:24px 24px 0 0;overflow:hidden;box-shadow:0 18px 40px rgba(15,23,42,0.14);text-align:center;padding:36px 24px;">
      <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#f7a600;font-weight:800;">
        ✨ CLUB COURTEAU EXCLUSIF
      </p>
      <h1 style="margin:0;font-size:26px;line-height:34px;font-weight:800;color:#ffffff;">
        ${title}
      </h1>
    </div>

    <!-- Body Content -->
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:32px 24px;border-radius:0 0 24px 24px;box-shadow:0 10px 30px rgba(15,23,42,0.06);">
      <p style="margin:0 0 18px;font-size:16px;line-height:24px;color:#111827;">
        Bonjour <strong>${safeName}</strong>,
      </p>
      <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:#4b5563;">
        Vous nous manquez ! Nous avons remarqué que vous n'êtes pas venu depuis un moment, alors nous avons préparé une récompense personnalisée juste pour vous :
      </p>

      <!-- Offer Box -->
      <div style="margin:0 0 28px;border:2px dashed #f7a600;border-radius:16px;padding:24px;background:#fffaf0;text-align:center;">
        <span style="display:inline-block;padding:4px 12px;background:#fef08a;color:#854d0e;border-radius:9999px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">
          🎁 Votre Récompense Active
        </span>
        <p style="margin:0;font-size:18px;font-weight:700;color:#1e293b;line-height:26px;">
          ${body}
        </p>
      </div>

      <p style="margin:0 0 28px;font-size:15px;line-height:24px;color:#374151;text-align:center;">
        Pour en profiter, réinstallez notre application mobile. Votre offre s'appliquera automatiquement dans votre panier !
      </p>

      <!-- CTA Button -->
      <div style="text-align:center;margin:0 0 32px;">
        <a href="${appInstallUrl}" style="display:inline-block;padding:16px 32px;background:#f7a600;color:#0f172a;font-size:16px;font-weight:800;text-decoration:none;border-radius:14px;box-shadow:0 10px 20px rgba(247,166,0,0.25);">
          📲 Réinstaller l'app & Profiter de l'offre
        </a>
      </div>

      <!-- Unsubscribe Footer -->
      <div style="margin-top:36px;padding-top:24px;border-top:1px solid #f1f5f9;text-align:center;">
        <p style="margin:0 0 14px;font-size:12px;color:#94a3b8;line-height:18px;">
          Vous recevez cet e-mail car vous êtes membre de CLUB COURTEAU.<br />
          Si vous ne souhaitez plus recevoir d'offres promotionnelles par e-mail :
        </p>
        <a href="${unsubscribeUrl}" style="display:inline-block;padding:8px 16px;background:#f8fafc;color:#64748b;font-size:11px;font-weight:600;text-decoration:none;border-radius:8px;border:1px solid #e2e8f0;">
          🚫 Se désabonner des emails d'offres
        </a>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

const sendSmartOfferUninstalledEmail = async ({
  userEmail,
  userName,
  offerTitle,
  offerBody,
  userId,
}) => {
  if (!userEmail) return false;
  if (!canSendEmails()) {
    console.log("[smartOfferMailService] Email skipped: MAIL_USER/MAIL_PASS missing");
    return false;
  }

  const subject = offerTitle || "🎁 Une surprise vous attend chez Club Courteau !";
  const html = generateSmartOfferUninstalledEmail({
    userName,
    offerTitle,
    offerBody,
    userId,
  });

  try {
    const transporter = createMailerTransport();
    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: userEmail,
      subject,
      html,
    });
    console.log(`[smartOfferMailService] Smart Offer email sent successfully to ${userEmail} (user ${userId})`);
    return true;
  } catch (error) {
    console.error("[smartOfferMailService] Error sending email to", userEmail, error.message);
    return false;
  }
};

module.exports = {
  sendSmartOfferUninstalledEmail,
};
