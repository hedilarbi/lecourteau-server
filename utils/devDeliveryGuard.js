// En dev (NODE_ENV=dev), les emails partent normalement, SAUF vers les adresses fictives des
// comptes générés par les scripts de test : elles n'existent pas, et chaque envoi reviendrait en
// erreur (rebond SES), ce qui dégrade la réputation du compte d'envoi. Les notifications push
// partent normalement.
//
// Le filtre est posé au niveau de nodemailer pour couvrir tous les points d'envoi, présents et
// futurs. Un envoi entièrement filtré renvoie un succès simulé : la logique métier continue.
const nodemailer = require("nodemailer");

const DEV_ENV_VALUES = ["dev", "development"];
// Domaines des comptes de test (scripts/generateSmartOffersTestUsers.js, tests e2e…).
const FAKE_TEST_EMAIL_DOMAINS = [
  "@test-smart-matrix.com",
  "@test-gamification.com",
  "@test-e2e.courteau.com",
];

const isDevEnvironment = () =>
  DEV_ENV_VALUES.includes(String(process.env.NODE_ENV || "").trim().toLowerCase());

const toAddressList = (value) => {
  if (!value) return [];
  const list = Array.isArray(value) ? value : String(value).split(",");
  return list
    .map((entry) => (typeof entry === "object" ? entry?.address : entry))
    .map((address) => String(address || "").trim())
    .filter(Boolean);
};

const isFakeTestAddress = (address) => {
  const normalized = address.toLowerCase().replace(/.*<([^>]+)>.*/, "$1");
  return FAKE_TEST_EMAIL_DOMAINS.some((domain) => normalized.endsWith(domain));
};

let installed = false;

const installDevDeliveryGuard = () => {
  if (installed || !isDevEnvironment()) return false;
  installed = true;

  const originalCreateTransport = nodemailer.createTransport.bind(nodemailer);
  nodemailer.createTransport = (...args) => {
    const transporter = originalCreateTransport(...args);
    const originalSendMail = transporter.sendMail.bind(transporter);

    transporter.sendMail = (mail = {}, callback) => {
      const filtered = { ...mail };
      const skipped = [];
      ["to", "cc", "bcc"].forEach((field) => {
        const addresses = toAddressList(mail[field]);
        if (!addresses.length) return;
        const kept = addresses.filter((address) => !isFakeTestAddress(address));
        skipped.push(...addresses.filter(isFakeTestAddress));
        filtered[field] = kept.length ? kept : undefined;
      });

      if (skipped.length) {
        console.log(`[devDeliveryGuard] Email NON envoyé à une adresse de test fictive → ${skipped.join(", ")} : ${mail.subject}`);
      }

      if (!filtered.to && !filtered.cc && !filtered.bcc) {
        const simulated = { messageId: `dev-suppressed-${Date.now()}`, accepted: [], rejected: skipped };
        if (typeof callback === "function") {
          callback(null, simulated);
          return undefined;
        }
        return Promise.resolve(simulated);
      }
      return originalSendMail(filtered, callback);
    };
    return transporter;
  };

  console.warn("⚠️  NODE_ENV=dev : emails envoyés normalement, sauf vers les adresses fictives des comptes de test.");
  return true;
};

module.exports = { installDevDeliveryGuard, isDevEnvironment };
