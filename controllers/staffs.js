const {
  createStaffService,
} = require("../services/staffsServices/createStaffService");
const {
  getStaffMembersService,
} = require("../services/staffsServices/getStaffMembersService");
const {
  getStaffMemberService,
} = require("../services/staffsServices/getStaffMemberService");
const {
  deleteStaffMemberService,
} = require("../services/staffsServices/deleteStaffMemberService");
const {
  updateStaffMemberService,
} = require("../services/staffsServices/updateStaffMemberService");
const {
  loginStaffService,
} = require("../services/staffsServices/loginStaffService");
const {
  getStaffByTokenService,
} = require("../services/staffsServices/getStaffByTokenService");
const {
  affectOrderToStaffService,
} = require("../services/staffsServices/affectOrderToStaffService");
const {
  getStaffOrderService,
} = require("../services/staffsServices/getStaffOrderService");
const {
  getAvailableDriversService,
} = require("../services/staffsServices/getAvailableDriversService");
const {
  getDriversOrdersService,
} = require("../services/staffsServices/getDriversOrdersService");
const saltRounds = 10;
const bcrypt = require("bcrypt");
const createStaff = async (req, res) => {
  let firebaseUrl = null;
  if (req.file) {
    firebaseUrl = req.file.firebaseUrl;
  }

  const { name, username, password, role, restaurant } = req.body;
  try {
    const { response, error } = await createStaffService(
      name,
      username,
      password,
      role,
      restaurant,
      firebaseUrl
    );
    if (error) {
      return res.status(400).json({ message: error });
    }

    res.status(200).json(response);
  } catch (err) {
    res.json({ message: err.message });
  }
};

const getStaffMembers = async (req, res) => {
  try {
    const { response } = await getStaffMembersService();
    res.status(200).json(response);
  } catch (error) {
    res.json({ message: error.message });
  }
};
const getStaffMember = async (req, res) => {
  const { id } = req.params;
  try {
    const { response } = await getStaffMemberService(id);
    res.status(200).json(response);
  } catch (error) {
    res.json({ message: error.message });
  }
};
const deleteStaffMember = async (req, res) => {
  const { id } = req.params;
  try {
    const { response } = await deleteStaffMemberService(id);
    res.status(200).json(response);
  } catch (error) {
    res.json({ message: error.message });
  }
};

const updateStaffMember = async (req, res) => {
  const { id } = req.params;
  const { name, username, restaurant, role } = req.body;

  try {
    const { response } = await updateStaffMemberService(
      id,
      name,
      username,
      restaurant,
      role
    );

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
const loginStaff = async (req, res) => {
  const { username, password, expoToken } = req.body;

  try {
    const { error, staff, token } = await loginStaffService(
      username,
      password,
      expoToken
    );
    if (error) {
      console.error("error in login service:", error);
      return res.status(400).json({ message: error });
    }

    res.status(200).json({ staff, token });
  } catch (error) {
    console.error("error in login controller:", error);
    res.status(500).json({ message: error.message });
  }
};

const getStaffByToken = async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];

  try {
    const { response, error } = await getStaffByTokenService(token);
    if (error) {
      return res.status(400).json({ message: error });
    }

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const affectOrderToStaff = async (req, res) => {
  const { orderId } = req.body;
  const { id } = req.params;

  try {
    const { response, error } = await affectOrderToStaffService(orderId, id);
    if (error) {
      return res.status(400).json({ message: error });
    }
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getStaffOrder = async (req, res) => {
  const { id } = req.params;

  try {
    const { lastItem } = await getStaffOrderService(id);
    res.status(200).json(lastItem);
  } catch (error) {
    res.json({ message: error.message });
  }
};

const getAvailableDrivers = async (req, res) => {
  try {
    const { response } = await getAvailableDriversService();
    res.status(200).json(response);
  } catch (error) {
    res.json({ message: error.message });
  }
};

const getDriverOrders = async (req, res) => {
  const { id } = req.params;
  try {
    const { response } = await getDriversOrdersService(id);
    res.status(200).json(response.orders);
  } catch (error) {
    res.json({ message: error.message });
  }
};

const updatePassword = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  try {
    const hashedPasword = await bcrypt.hash(password, saltRounds);
    const staff = await Staff.findById(id);
    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }
    staff.password = hashedPasword;
    await staff.save();
    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    res.json({ message: error.message });
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
  affectOrderToStaff,
  getStaffOrder,
  getAvailableDrivers,
  getDriverOrders,
  updatePassword,
};
