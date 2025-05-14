const sharp = require("sharp");

const optimizeImage = (req, res, next) => {
  if (!req.file || !req.file.buffer) {
    return next();
  }

  sharp(req.file.buffer)
    .resize(700, 670, {
      fit: "cover",
      position: "center",
    })
    .toFormat("jpeg") // Convert to JPEG
    .jpeg({ quality: 75, chromaSubsampling: "4:4:4" })
    .toBuffer()
    .then((data) => {
      // Update the file properties to reflect JPEG conversion
      req.file.buffer = data;
      req.file.size = data.length;
      req.file.mimetype = "image/jpeg";

      // Update the filename extension to .jpg (if originalname exists)
      if (req.file.originalname) {
        req.file.originalname = req.file.originalname.replace(
          /\.[^/.]+$/, // Match the existing extension
          ".jpg" // Replace with .jpg
        );
      }

      next();
    })
    .catch((err) => {
      console.error("Sharp optimization error:", err);
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
