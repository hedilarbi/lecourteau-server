const { default: mongoose } = require("mongoose");
const { deleteImagesFromFirebase } = require("../firebase");
const Staff = require("../models/staff");
const generateStaffToken = require("../utils/generateStaffToken");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const saltRounds = 10;
const createStaff = async (req, res) => {
  let firebaseUrl = null;
  if (req.file) {
    firebaseUrl = req.file.firebaseUrl;
  }
  const { name, username, password, role, restaurant } = req.body;
  try {
    const verifyStaff = await Staff.findOne({ username });

    if (verifyStaff) {
      return res.status(403).json({ message: "this username already exist" });
    }

    const hashedPasword = await bcrypt.hash(password, saltRounds);
    const newStaff = new Staff({
      name,
      image: firebaseUrl,
      restaurant,
      username,
      password: hashedPasword,
      role,
      createdAt: new Date().toISOString(),
    });
    const response = await newStaff.save();
    const restau = await mongoose.models.Restaurant.findById(restaurant);
    restau.staff.push(response._id);
    await restau.save();
    res.status(200).json(response);
  } catch (err) {
    res.json({ message: err.message });
  }
};

const getStaffMembers = async (req, res) => {
  try {
    const response = await Staff.find().populate({
      path: "restaurant",
      select: "name",
    });
    res.status(200).json(response);
  } catch (error) {
    res.json({ message: error.message });
  }
};
const getStaffMember = async (req, res) => {
  const { id } = req.params;
  try {
    const response = await Staff.findById(id).populate({
      path: "restaurant",
      select: "name",
    });
    res.status(200).json(response);
  } catch (error) {
    res.json({ message: error.message });
  }
};
const deleteStaffMember = async (req, res) => {
  const { id } = req.params;
  try {
    const response = await Staff.findById(id);
    if (!response) {
      return res
        .status(404)
        .json({ success: false, message: "Article n'existe pas" });
    }
    await deleteImagesFromFirebase(response.image);
    await Staff.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "item deleted" });
  } catch (error) {
    res.json({ message: error.message });
  }
};

const updateStaffMember = async (req, res) => {
  const { id } = req.params;
  const { name, username, restaurant, role } = req.body;
  try {
    const response = await Staff.findByIdAndUpdate(
      id,
      {
        name,

        username,
        role,
        restaurant,
      },
      { new: true }
    ).populate({ path: "restaurant", select: "name" });

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
const loginStaff = async (req, res) => {
  const { username, password, expoToken } = req.body;

  try {
    const staff = await Staff.findOne({ username });
    if (!staff) {
      return res.status(401).json({ message: "compte n'existe pas" });
    }
    const verify = await bcrypt.compare(password, staff.password);
    if (!verify) {
      return res.status(403).json({ message: "mot de passe eroné" });
    }

    const token = generateStaffToken(staff._id, staff.username);

    await mongoose.models.Restaurant.findByIdAndUpdate(
      staff.restaurant,
      { expo_token: expoToken },
      { new: true }
    );

    res.status(200).json({ staff, token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getStaffByToken = async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];

  try {
    const decodedData = jwt.verify(token, process.env.SECRET_KEY);

    const response = await Staff.findById(decodedData.id);

    res.status(200).json(response);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  loginStaff,
  createStaff,
  getStaffByToken,
  getStaffMember,
  getStaffMembers,
  deleteStaffMember,
  updateStaffMember,
};
