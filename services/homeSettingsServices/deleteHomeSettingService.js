const { deleteImagesFromFirebase } = require("../../firebase");
const HomeSetting = require("../../models/HomeSetting");

const deleteHomeSettingService = async (id) => {
  try {
    const homeSetting = await HomeSetting.findById(id);
    if (!homeSetting) {
      return { error: "Home setting not found" };
    }

    if (homeSetting.image) {
      await deleteImagesFromFirebase(homeSetting.image);
    }

    await HomeSetting.findByIdAndDelete(id);

    return { response: "Home setting deleted" };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = deleteHomeSettingService;
