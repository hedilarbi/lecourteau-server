// Les tokens staff sont signés avec leur propre clé : un token client ne doit
// jamais ouvrir une route du dashboard. Pas de repli sur SECRET_KEY, sinon la
// séparation disparaîtrait silencieusement.
const getStaffSecretKey = () => {
  const key = process.env.STAFF_SECRET_KEY;
  if (!key || key === process.env.SECRET_KEY) {
    throw new Error("STAFF_SECRET_KEY manquante ou identique à SECRET_KEY.");
  }
  return key;
};

module.exports = getStaffSecretKey;
