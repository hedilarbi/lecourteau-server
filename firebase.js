var admin = require("firebase-admin");

var serviceAccount = require("./firebase.json");

const BUCKET = "gs://lecourteau-19bdb.appspot.com";
const BUCKET_NAME = "lecourteau-19bdb.appspot.com";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: BUCKET,
});

const bucket = admin.storage().bucket();

const uploadImageToFirebase = (req, res, next) => {
  if (!req.file) return next();
  const image = req.file;
  const imageName = Date.now() + "." + image.originalname.split(".").pop();

  const file = bucket.file(imageName);
  const stream = file.createWriteStream({
    metadata: {
      contentType: image.mimetype,
    },
  });

  stream.on("error", (e) => {
    console.log(e);
  });

  stream.on("finish", async () => {
    await file.makePublic();

    req.file.firebaseUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${imageName}`;

    next();
  });

  stream.end(image.buffer);
};



const deleteImagesFromFirebase = async (req, res, next) => {
  if (!req.body.toDelete) return next();
  const images = req.body.toDelete;

  try {
    if (typeof req.body.toDelete === "object") {
      for (const image of images) {
        const imageName = image.split("/").pop();
        const file = bucket.file(imageName);
        await file.delete();
      }
    } else {
      const imageName = req.body.toDelete.split("/").pop();
      const file = bucket.file(imageName);
      await file.delete();
    }
  } catch (err) {
    return res.status(500).json({ message: "error in delete from firebase" });
  }

  next();
};

module.exports = {
  uploadImageToFirebase,
 
  deleteImagesFromFirebase,
};
