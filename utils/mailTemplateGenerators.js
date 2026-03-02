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
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#111827;color:#ffffff;padding:20px 24px;border-radius:14px 14px 0 0;">
      <h1 style="margin:0;font-size:22px;line-height:28px;">${title}</h1>
      <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">${subtitle}</p>
    </div>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 14px 14px;">
      ${bodyHtml}
      <p style="margin:20px 0 0;font-size:12px;color:#6b7280;">
        Équipe CLUB COURTEAU
      </p>
    </div>
  </div>
</body>
</html>
`;

const generateSubscriptionActivationEmail = ({
  userName,
  monthlyPrice,
  currency,
  currentPeriodEnd,
}) => {
  const safeName = userName || "Client";
  const priceLabel = formatMoneyForMail(monthlyPrice, currency);
  const periodEndLabel = formatDateForMail(currentPeriodEnd);

  return wrapSimpleMail(
    "Bienvenue au CLUB COURTEAU",
    "Votre abonnement est maintenant actif.",
    `
      <p style="margin:0 0 12px;font-size:15px;">Bonjour ${safeName},</p>
      <p style="margin:0 0 12px;font-size:15px;">
        Félicitations, votre abonnement <strong>CLUB COURTEAU</strong> est activé.
      </p>
      <p style="margin:0 0 8px;font-size:14px;">
        Prix mensuel: <strong>${priceLabel}</strong>
      </p>
      <p style="margin:0;font-size:14px;">
        Prochaine échéance: <strong>${periodEndLabel}</strong>
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
    "Votre abonnement CLUB COURTEAU a été renouvelé.",
    `
      <p style="margin:0 0 12px;font-size:15px;">Bonjour ${safeName},</p>
      <p style="margin:0 0 12px;font-size:15px;">
        Votre paiement de renouvellement a été accepté.
      </p>
      <p style="margin:0 0 8px;font-size:14px;">
        Montant payé: <strong>${amountLabel}</strong>
      </p>
      <p style="margin:0;font-size:14px;">
        Nouvelle échéance: <strong>${periodEndLabel}</strong>
      </p>
    `,
  );
};

const generateSubscriptionRenewalFailedEmail = ({
  userName,
  amountDue,
  currency,
  nextAttemptDate,
}) => {
  const safeName = userName || "Client";
  const amountLabel = formatMoneyForMail(amountDue, currency);
  const nextAttemptLabel = formatDateForMail(nextAttemptDate);

  return wrapSimpleMail(
    "Paiement de renouvellement échoué",
    "Votre abonnement reste en attente de paiement.",
    `
      <p style="margin:0 0 12px;font-size:15px;">Bonjour ${safeName},</p>
      <p style="margin:0 0 12px;font-size:15px;">
        Le paiement de renouvellement de votre abonnement <strong>CLUB COURTEAU</strong> a échoué.
      </p>
      <p style="margin:0 0 8px;font-size:14px;">
        Montant dû: <strong>${amountLabel}</strong>
      </p>
      <p style="margin:0 0 8px;font-size:14px;">
        Prochaine tentative Stripe: <strong>${nextAttemptLabel}</strong>
      </p>
      <p style="margin:0;font-size:14px;">
        Vous pouvez mettre à jour votre carte dans l'application, section <strong>Mon abonnement</strong>.
      </p>
    `,
  );
};

module.exports = {
  generateOrderConfirmationEmail,
  generateSubscriptionActivationEmail,
  generateSubscriptionRenewalSuccessEmail,
  generateSubscriptionRenewalFailedEmail,
};
