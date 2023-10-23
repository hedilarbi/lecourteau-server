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

const updateMenuItemImageInFirebase = async (req, res, next) => {
  if (!req.body.fileToDelete || !req.file) return next();

  const oldImageName = req.body.fileToDelete.split("/").pop();

  const oldImageFile = bucket.file(oldImageName);
  try {
    await oldImageFile.delete();
    console.log("image deleted");
  } catch (err) {
    console.log(err.message);
    res.status(404).json({ success: false, message: err.message });
  }
  const image = req.file;
  const imageName = Date.now() + "." + image.originalname.split(".").pop();

  const file = bucket.file(imageName);
  const stream = file.createWriteStream({
    metadata: {
      contentType: image.mimetype,
    },
  });
  console.log("image added");
  stream.on("error", (e) => {
    console.log(e);
    res.status(404).json({ success: false, message: e.message });
  });

  stream.on("finish", async () => {
    await file.makePublic();

    req.file.firebaseUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${imageName}`;
    console.log("image finished");
    next();
  });

  stream.end(image.buffer);
};

const deleteImagesFromFirebase = async (image) => {
  try {
    const imageName = image.split("/").pop();
    const file = bucket.file(imageName);
    await file.delete();
  } catch (err) {
    return err.message;
  }
};

module.exports = {
  uploadImageToFirebase,
  updateMenuItemImageInFirebase,
  deleteImagesFromFirebase,
};
