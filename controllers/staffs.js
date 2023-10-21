const Staff = require("../models/staff");
const generateStaffToken = require("../utils/generateStaffToken");
const bcrypt = require("bcrypt");
const createStaff = async (req, res) => {
  const saltRounds = 10;
  const { name, username, password, role } = req.body;
  try {
    const verifyStaff = await Staff.findOne({ username });

    if (verifyStaff) {
      return res.status(403).json({ message: "this username already exist" });
    }

    const hashedPasword = await bcrypt.hash(password, saltRounds);
    const newStaff = new Staff({
      name,
      username,
      password: hashedPasword,
      role,
      createdAt: new Date().toISOString(),
    });
    const response = await newStaff.save();
    const token = generateStaffToken(response._id, response.username);
    res.status(200).json({ staff: response, token });
  } catch (err) {
    res.json({ message: err.message });
  }
};

const loginStaff = async (req, res) => {
  const { username, password } = req.body;
  console.log("hyv");

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
    res.status(500).json({ message: error.message });
  }
};

module.exports = { loginStaff, createStaff, getStaffByToken };
