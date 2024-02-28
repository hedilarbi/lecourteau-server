const sharp = require("sharp");

const optimizeImage = (req, res, next) => {
  if (!req.file) {
    return next();
  }
  const image = req.file;
  sharp(image.buffer)
    .resize(600, 400)
    .toFormat("jpeg")
    .jpeg({ quality: 75, chromaSubsampling: "4:4:4" })
    .toBuffer()
    .then((data) => {
      req.file.buffer = data;
      req.file.size = data.length;
      req.file.mimetype = "image/jpeg";
      next();
    })
    .catch((err) => {
      next(err);
    });
};

const optimizeImages = async (req, res, next) => {
  if (!req.files) {
    return next();
  }

  const images = req.files;
  const processImage = async (image, index) => {
    try {
      const data = await sharp(image.buffer)
        .resize(500, 400)
        .toFormat("jpeg")
        .jpeg({ quality: 75, chromaSubsampling: "4:4:4" })
        .toBuffer();
      req.files[index].buffer = data;
      req.files[index].size = data.length;
      req.files[index].mimetype = "image/jpeg";
    } catch (err) {
      next(err);
    }
  };
  await Promise.all(images.map(processImage));

  next();
};

module.exports = { optimizeImage, optimizeImages };
