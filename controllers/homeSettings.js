const createHomeSettingService = require("../services/homeSettingsServices/createHomeSettingService");
const getHomeSettingsService = require("../services/homeSettingsServices/getHomeSettingsService");
const updateHomeSettingService = require("../services/homeSettingsServices/updateHomeSettingService");
const deleteHomeSettingService = require("../services/homeSettingsServices/deleteHomeSettingService");

const createHomeSetting = async (req, res) => {
  const firebaseUrl = req.file ? req.file.firebaseUrl : null;
  const { title, subTitle, menuItemId, offerId, codePromoId, codePromoTitle } =
    req.body;

  if (!title || !subTitle) {
    return res.status(400).json({
      success: false,
      message: "Title and subTitle are required",
    });
  }

  if (!firebaseUrl) {
    return res.status(400).json({
      success: false,
      message: "Image is required",
    });
  }

  try {
    const { error, response } = await createHomeSettingService(
      title,
      subTitle,
      firebaseUrl,
      menuItemId,
      offerId,
      codePromoId,
      codePromoTitle,
    );

    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    return res.status(201).json(response);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getHomeSettings = async (req, res) => {
  try {
    const { error, response } = await getHomeSettingsService();

    if (error) {
      const statusCode = error === "Home setting not found" ? 404 : 500;
      return res.status(statusCode).json({ success: false, message: error });
    }

    return res.status(200).json(response);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const updateHomeSetting = async (req, res) => {
  const { id } = req.params;
  const firebaseUrl = req.file ? req.file.firebaseUrl : null;
  const { title, subTitle, menuItemId, offerId, codePromoId, codePromoTitle } =
    req.body;

  try {
    const { error, response } = await updateHomeSettingService(
      id,
      title,
      subTitle,
      firebaseUrl,
      menuItemId,
      offerId,
      codePromoId,
      codePromoTitle,
    );

    if (error) {
      const statusCode = error === "Home setting not found" ? 404 : 400;
      return res.status(statusCode).json({ success: false, message: error });
    }

    return res.status(200).json(response);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const deleteHomeSetting = async (req, res) => {
  const { id } = req.params;

  try {
    const { error, response } = await deleteHomeSettingService(id);

    if (error) {
      const statusCode = error === "Home setting not found" ? 404 : 400;
      return res.status(statusCode).json({ success: false, message: error });
    }

    return res.status(200).json({ success: true, message: response });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createHomeSetting,
  getHomeSettings,
  updateHomeSetting,
  deleteHomeSetting,
};
