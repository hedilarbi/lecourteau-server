const crypto = require("crypto");
const { sendMailCampaign, loadKit } = require("../services/mailServices/mailCampaignService");
let currentJob = null;

const validToken = (req) => {
  const expected = process.env.MAIL_TOKEN;
  const provided = req.query.token;
  if (!expected || typeof provided !== "string") return false;
  const actual = Buffer.from(provided);
  const target = Buffer.from(expected);
  return actual.length === target.length && crypto.timingSafeEqual(actual, target);
};

const sendCampaignMail = async (req, res) => {
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

  const { subject } = req.query;
  if (subject !== undefined && (typeof subject !== "string" || !subject.trim())) {
    return res.status(400).json({ error: "Objet invalide." });
  }

  let kit;
  try {
    kit = await loadKit();
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  const mailSubject = subject?.trim() || kit.title;
  if (!mailSubject) {
    return res.status(400).json({ error: "Objet manquant : ajoutez un <title> au kit ou le paramètre subject." });
  }

  if (currentJob?.status === "running") {
    return res.status(409).json({ error: "Un envoi est déjà en cours.", job: currentJob });
  }

  const job = { id: crypto.randomUUID(), status: "running", startedAt: new Date().toISOString(), mail: mail || null, subject: mailSubject, recipients: 0, sent: 0, failed: 0, batches: 0 };
  currentJob = job;
  res.status(202).json({ message: "Envoi démarré.", job });
  setImmediate(async () => {
    try {
      const result = await sendMailCampaign({ mail, subject: mailSubject }, (progress) => Object.assign(job, progress));
      Object.assign(job, { status: "completed", ...result, finishedAt: new Date().toISOString() });
    } catch (error) {
      console.error("[mailCampaign]", error);
      Object.assign(job, { status: "failed", error: error.message, finishedAt: new Date().toISOString() });
    }
  });
};

const getCampaignMailStatus = (req, res) => {
  if (!validToken(req)) return res.status(401).json({ error: "Token invalide." });
  if (!currentJob) return res.status(404).json({ error: "Aucun envoi lancé." });
  return res.json({ job: currentJob });
};

module.exports = { sendCampaignMail, getCampaignMailStatus };
