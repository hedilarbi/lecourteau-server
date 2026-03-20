const generateOrderConfirmationEmail = (
  name,
  code,
  type,
  address,
  total,
  items,
) => {
  const date = formatDateToFrench();

  orderType = type === "delivery" ? "à livrer" : "à emporter";

  let itemsList = items.map(
    (item) =>
      `
    <p style='color:white'>${item.name} - ${item.price.toFixed(2)}$ (
      ${item.customizations?.map(
        (customization) =>
          `<span style="color:gray"> ${customization}, </span>`,
      )}  
    )</p>
  `,
  );

  return ` 
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Template</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #000000;
            color: black;
            font-family: Arial, sans-serif;
            line-height: 1.6;
            width: 100%;
        }
        .container {
            width: 100%;
            color:white;
            margin: 0 auto;
            padding: 20px;
            box-sizing: border-box;
              background-color: black;
        }
        .header {
            display: flex;
         
            width: 100%;
       }
        .header img {
            max-width: 150px;
            height: 150px;
            
        }
        .header .text {
            margin-left: auto;
            text-align: right;
            margin-top: 60px;
        }
        h1, p {
            margin: 0;
        }
       
    </style>
</head>
<body >
    <div class="container">
        <div class="header" >
            <img src="https://firebasestorage.googleapis.com/v0/b/lecourteau-19bdb.appspot.com/o/icon.png?alt=media&token=dde8431f-d60d-40d0-9fe9-40>
            <div class="text" >
               <p style='color:white'> <strong >Total:</strong> ${total} $</p>
<p style='color:white' > ${date}</p>
            </div>
        </div>
          <h1 style="margin-top:20px;font-size:32px;color:white">Merci pour votre commande, ${name}!</h1>

<p style="margin-top:20px;font-size:16px;color:white"> Votre commande ${orderType} chez Casse-croûte Courteau a été passée avec succès, votre code de commande est <strong > ${code} </strong> </p>

<p style="margin-top:20px;font-size:20px;color:white"><strong >Total:</strong> ${total} $</p>

<div style="margin-top:20px">
${itemsList}
</div>

${type === "delivery" ? `<p style='margin-top:20px;font-size:16px;color:white'><strong >Livrer à:</strong> ${address} </p>` : ""}
    </div>
 
</body>
</html>
`;
};

function formatDateToFrench() {
  const date = new Date();
  const months = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

const formatMoneyForMail = (amount, currency = "CAD") => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return `0.00 ${String(currency || "CAD").toUpperCase()}`;

  try {
    return new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: String(currency || "CAD").toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericAmount);
  } catch (error) {
    return `${numericAmount.toFixed(2)} ${String(currency || "CAD").toUpperCase()}`;
  }
};

const formatDateForMail = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const wrapSimpleMail = (title, subtitle, bodyHtml) => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111827;">
  <div style="max-width:640px;margin:0 auto;padding:28px 18px;">
    <div style="background:#111827;border-radius:24px;overflow:hidden;box-shadow:0 18px 40px rgba(17,24,39,0.14);">
      <div style="padding:18px 24px;border-bottom:1px solid rgba(255,255,255,0.08);">
        <p style="margin:0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#f7a600;font-weight:700;">
          CLUB COURTEAU
        </p>
      </div>
      <div style="padding:28px 24px 24px;color:#ffffff;">
        <h1 style="margin:0;font-size:28px;line-height:34px;font-weight:700;">${title}</h1>
        <p style="margin:10px 0 0;font-size:15px;line-height:23px;color:rgba(255,255,255,0.82);">
          ${subtitle}
        </p>
      </div>
    </div>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:28px 24px;border-radius:0 0 24px 24px;box-shadow:0 10px 30px rgba(15,23,42,0.06);">
      ${bodyHtml}
      <p style="margin:28px 0 0;font-size:12px;line-height:18px;color:#6b7280;">
        Merci de faire partie de CLUB COURTEAU.<br />
        Équipe Courteau
      </p>
    </div>
  </div>
</body>
</html>
`;

const generateSubscriptionActivationEmail = ({
  userName,
  amountPaid,
  currency,
  currentPeriodEnd,
}) => {
  const safeName = userName || "Client";
  const amountLabel = formatMoneyForMail(amountPaid, currency);
  const periodEndLabel = formatDateForMail(currentPeriodEnd);

  return wrapSimpleMail(
    "Votre abonnement est confirmé",
    "Bienvenue dans CLUB COURTEAU. Votre accès premium est maintenant actif.",
    `
      <p style="margin:0 0 16px;font-size:15px;line-height:24px;">Bonjour ${safeName},</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:24px;color:#374151;">
        Votre abonnement <strong>CLUB COURTEAU</strong> a bien été activé. Vous pouvez dès maintenant profiter de 15 % de rabais sur les commandes admissibles, de la livraison gratuite et d&apos;1 article gratuit par mois.
      </p>
      <div style="margin:0 0 18px;border:1px solid #e5e7eb;border-radius:16px;padding:18px;background:#fafafa;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;font-weight:700;">
          Récapitulatif
        </p>
        <p style="margin:0 0 10px;font-size:15px;line-height:22px;color:#111827;">
          Montant facturé aujourd&apos;hui: <strong>${amountLabel}</strong>
        </p>
        <p style="margin:0;font-size:15px;line-height:22px;color:#111827;">
          Prochaine échéance: <strong>${periodEndLabel}</strong>
        </p>
      </div>
      <p style="margin:0;font-size:14px;line-height:22px;color:#4b5563;">
        Vos avantages comprennent 15 % de rabais sur les commandes admissibles, la livraison gratuite et 1 article gratuit par mois.
      </p>
    `,
  );
};

const generateSubscriptionRenewalSuccessEmail = ({
  userName,
  amountPaid,
  currency,
  currentPeriodEnd,
}) => {
  const safeName = userName || "Client";
  const amountLabel = formatMoneyForMail(amountPaid, currency);
  const periodEndLabel = formatDateForMail(currentPeriodEnd);

  return wrapSimpleMail(
    "Renouvellement confirmé",
    "Votre abonnement CLUB COURTEAU continue sans interruption.",
    `
      <p style="margin:0 0 16px;font-size:15px;line-height:24px;">Bonjour ${safeName},</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:24px;color:#374151;">
        Nous confirmons que le paiement de renouvellement de votre abonnement <strong>CLUB COURTEAU</strong> a été accepté. Vous pouvez dès maintenant profiter de 15 % de rabais sur les commandes admissibles, de la livraison gratuite et d&apos;1 article gratuit par mois.
      </p>
      <div style="margin:0 0 18px;border:1px solid #e5e7eb;border-radius:16px;padding:18px;background:#fafafa;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;font-weight:700;">
          Paiement reçu
        </p>
        <p style="margin:0 0 10px;font-size:15px;line-height:22px;color:#111827;">
          Montant payé: <strong>${amountLabel}</strong>
        </p>
        <p style="margin:0;font-size:15px;line-height:22px;color:#111827;">
          Prochaine échéance: <strong>${periodEndLabel}</strong>
        </p>
      </div>
      <p style="margin:0;font-size:14px;line-height:22px;color:#4b5563;">
        Vous continuez de profiter de 15 % de rabais sur les commandes admissibles, de la livraison gratuite et d&apos;1 article gratuit par mois sur votre nouveau cycle.
      </p>
    `,
  );
};

const generateSubscriptionRenewalFailedEmail = ({
  userName,
  amountDue,
  currency,
  nextAttemptDate,
  graceEndDate,
}) => {
  const safeName = userName || "Client";
  const amountLabel = formatMoneyForMail(amountDue, currency);
  const nextAttemptLabel = formatDateForMail(nextAttemptDate);
  const graceEndLabel = formatDateForMail(graceEndDate);

  return wrapSimpleMail(
    "Paiement de renouvellement échoué",
    "Nous n&apos;avons pas pu traiter votre paiement. Nous réessaierons automatiquement.",
    `
      <p style="margin:0 0 16px;font-size:15px;line-height:24px;">Bonjour ${safeName},</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:24px;color:#374151;">
        Le renouvellement de votre abonnement <strong>CLUB COURTEAU</strong> n&apos;a pas pu être complété avec la carte enregistrée.
      </p>
      <div style="margin:0 0 18px;border:1px solid #F7D9A2;border-radius:16px;padding:18px;background:#FFF8EA;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#9A6700;font-weight:700;">
          Action recommandée
        </p>
        <p style="margin:0 0 10px;font-size:15px;line-height:22px;color:#7A4D00;">
          Montant dû: <strong>${amountLabel}</strong>
        </p>
        <p style="margin:0 0 10px;font-size:15px;line-height:22px;color:#7A4D00;">
          Prochaine tentative: <strong>${nextAttemptLabel}</strong>
        </p>
        <p style="margin:0;font-size:15px;line-height:22px;color:#7A4D00;">
          Date limite avant suspension: <strong>${graceEndLabel}</strong>
        </p>
      </div>
      <p style="margin:0;font-size:14px;line-height:22px;color:#4b5563;">
        Pour éviter une suspension, mettez à jour votre moyen de paiement dans l&apos;application, section <strong>Mon abonnement</strong>.
      </p>
    `,
  );
};

const generateSubscriptionSuspendedEmail = ({
  userName,
  amountDue,
  currency,
}) => {
  const safeName = userName || "Client";
  const amountLabel = formatMoneyForMail(amountDue, currency);

  return wrapSimpleMail(
    "Abonnement suspendu",
    "Le paiement n&apos;a pas pu être récupéré après plusieurs tentatives.",
    `
      <p style="margin:0 0 16px;font-size:15px;line-height:24px;">Bonjour ${safeName},</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:24px;color:#374151;">
        Votre abonnement <strong>CLUB COURTEAU</strong> est maintenant suspendu, car nous n&apos;avons pas pu confirmer le paiement de renouvellement.
      </p>
      <div style="margin:0 0 18px;border:1px solid #e5e7eb;border-radius:16px;padding:18px;background:#fafafa;">
        <p style="margin:0;font-size:15px;line-height:22px;color:#111827;">
          Montant non payé: <strong>${amountLabel}</strong>
        </p>
      </div>
      <p style="margin:0;font-size:14px;line-height:22px;color:#4b5563;">
        Pour réactiver votre abonnement, ouvrez <strong>Mon abonnement</strong> dans l&apos;application et lancez une nouvelle activation avec une méthode de paiement valide.
      </p>
    `,
  );
};

module.exports = {
  generateOrderConfirmationEmail,
  generateSubscriptionActivationEmail,
  generateSubscriptionRenewalSuccessEmail,
  generateSubscriptionRenewalFailedEmail,
  generateSubscriptionSuspendedEmail,
};
