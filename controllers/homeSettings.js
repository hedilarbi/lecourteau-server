const createHomeSettingService = require("../services/homeSettingsServices/createHomeSettingService");
const getHomeSettingsService = require("../services/homeSettingsServices/getHomeSettingsService");
const updateHomeSettingService = require("../services/homeSettingsServices/updateHomeSettingService");
const deleteHomeSettingService = require("../services/homeSettingsServices/deleteHomeSettingService");

const createHomeSetting = async (req, res) => {
  const firebaseUrl = req.file ? req.file.firebaseUrl : null;
  const { title, subTitle, description, menuItemId, offerId, codePromoId } =
    req.body;

  if (!title || !subTitle || !description) {
    return res.status(400).json({
      success: false,
      message: "Title, subTitle and description are required",
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
      description,
      firebaseUrl,
      menuItemId,
      offerId,
      codePromoId,
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
  const { title, subTitle, description, menuItemId, offerId, codePromoId } =
    req.body;

  try {
    const { error, response } = await updateHomeSettingService(
      id,
      title,
      subTitle,
      description,
      firebaseUrl,
      menuItemId,
      offerId,
      codePromoId,
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
