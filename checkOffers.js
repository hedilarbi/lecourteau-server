const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const PersonalizedOffer = require("./models/PersonalizedOffer");

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log("Connected to MongoDB");
    const offers = await PersonalizedOffer.find({}).lean();
    console.log("All offers:", offers);
    mongoose.disconnect();
  })
  .catch(err => console.error(err));
