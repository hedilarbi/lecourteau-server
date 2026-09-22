const crypto = require("crypto");
const { sendOpeningMatchCampaign } = require("../services/mailServices/openingMatchMailService");
let currentJob = null;

const validToken = (req) => {
  const expected = process.env.MAIL_TOKEN;
  const provided = req.query.token;
  if (!expected || typeof provided !== "string") return false;
  const actual = Buffer.from(provided);
  const target = Buffer.from(expected);
  return actual.length === target.length && crypto.timingSafeEqual(actual, target);
};

const sendOpeningMatchMail = (req, res) => {
  if (!validToken(req)) {
    return res.status(401).json({ error: "Token invalide." });
  }

  const mail = req.query.email || req.query.mail;
  if (req.query.email !== undefined && req.query.mail !== undefined) {
    return res.status(400).json({ error: "Utilisez seulement email ou mail." });
  }
  if (mail !== undefined && (typeof mail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail))) {
    return res.status(400).json({ error: "Adresse mail invalide." });
  }
  if (!mail && req.query.all !== "true") {
    return res.status(400).json({ error: "Indiquez email=adresse ou all=true pour tous les utilisateurs." });
  }

  if (currentJob?.status === "running") {
    return res.status(409).json({ error: "Un envoi est déjà en cours.", job: currentJob });
  }

  const job = { id: crypto.randomUUID(), status: "running", startedAt: new Date().toISOString(), mail: mail || null, recipients: 0, sent: 0, failed: 0, batches: 0 };
  currentJob = job;
  res.status(202).json({ message: "Envoi démarré.", job });
  setImmediate(async () => {
    try {
      const result = await sendOpeningMatchCampaign(mail, (progress) => Object.assign(job, progress));
      Object.assign(job, { status: "completed", ...result, finishedAt: new Date().toISOString() });
    } catch (error) {
      console.error("[openingMatchMail]", error);
      Object.assign(job, { status: "failed", error: error.message, finishedAt: new Date().toISOString() });
    }
  });
};

const getOpeningMatchMailStatus = (req, res) => {
  if (!validToken(req)) return res.status(401).json({ error: "Token invalide." });
  if (!currentJob) return res.status(404).json({ error: "Aucun envoi lancé." });
  return res.json({ job: currentJob });
};

module.exports = { sendOpeningMatchMail, getOpeningMatchMailStatus };
