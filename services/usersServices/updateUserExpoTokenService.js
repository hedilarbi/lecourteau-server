const User = require("../../models/User");

const updateUserExpoTokenService = async (id, expoToken) => {
  const user = await User.findById(id);
  if (!user) {
    return { error: "User not found" };
  }

  const wasUninstalled = user.appIsInstalled === false;

  user.expo_token = expoToken;

  // If the user had previously uninstalled the app (appIsInstalled=false)
  // and they're now registering a new token → they reinstalled the app
  if (wasUninstalled && expoToken) {
    user.appIsInstalled = true;
    user.appUninstalledAt = null;
    console.log(`[updateUserExpoTokenService] User ${user.name || id} reinstalled the app. Restored appIsInstalled=true.`);
  }

  await user.save();
  return { user };
};

module.exports = {
  updateUserExpoTokenService,
};
