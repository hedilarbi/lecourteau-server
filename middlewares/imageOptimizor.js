const sharp = require("sharp");

const optimizeImage = (req, res, next) => {
  if (!req.file || !req.file.buffer) {
    return next();
  }

  sharp(req.file.buffer)
    .metadata()
    .then((metadata) => {
      const hasAlpha = Boolean(metadata.hasAlpha);
      let pipeline = sharp(req.file.buffer).resize(700, 670, {
        fit: "cover",
        position: "center",
      });

      if (hasAlpha) {
        pipeline = pipeline.png({
          compressionLevel: 9,
          quality: 80,
          palette: true,
        });
      } else {
        pipeline = pipeline.jpeg({ quality: 75, chromaSubsampling: "4:4:4" });
      }

      return pipeline.toBuffer().then((data) => ({ data, hasAlpha }));
    })
    .then(({ data, hasAlpha }) => {
      req.file.buffer = data;
      req.file.size = data.length;
      req.file.mimetype = hasAlpha ? "image/png" : "image/jpeg";

      if (req.file.originalname) {
        req.file.originalname = req.file.originalname.replace(
          /\.[^/.]+$/,
          hasAlpha ? ".png" : ".jpg"
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
      const metadata = await sharp(image.buffer).metadata();
      const hasAlpha = Boolean(metadata.hasAlpha);
      let pipeline = sharp(image.buffer).resize(500, 400);

      if (hasAlpha) {
        pipeline = pipeline.png({
          compressionLevel: 9,
          quality: 80,
          palette: true,
        });
      } else {
        pipeline = pipeline.jpeg({ quality: 75, chromaSubsampling: "4:4:4" });
      }

      const data = await pipeline.toBuffer();
      req.files[index].buffer = data;
      req.files[index].size = data.length;
      req.files[index].mimetype = hasAlpha ? "image/png" : "image/jpeg";
      if (req.files[index].originalname) {
        req.files[index].originalname = req.files[index].originalname.replace(
          /\.[^/.]+$/,
          hasAlpha ? ".png" : ".jpg"
        );
      }
    } catch (err) {
      next(err);
    }
  };
  await Promise.all(images.map(processImage));

  next();
};

module.exports = { optimizeImage, optimizeImages };
