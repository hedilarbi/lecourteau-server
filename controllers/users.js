const User = require("../models/User");
const jwt = require("jsonwebtoken");
const generateToken = require("../utils/generateToken");

const createUser = async (req, res) => {
  const { phone_number } = req.body;

  try {
    const verifyPhone = await User.findOne({ phone_number });
    if (verifyPhone) {
      const token = generateToken(verifyPhone._id, verifyPhone.phone_number);
      return res.status(200).json({ user: verifyPhone, token });
    }
    const newUser = new User({
      phone_number,

      createdAt: new Date().toISOString(),
    });
    const response = await newUser.save();
    const token = generateToken(response._id, response.phone_number);

    res.status(200).json({ user: response, token });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateUser = async (req, res) => {
  const { email, name } = req.body;
  const { id } = req.params;
  try {
    const response = await User.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          name: name,
          email: email,
        },
      },
      { new: true } // This option returns the updated user
    );
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
const setUserInfo = async (req, res) => {
  const { address, email, name, coords, date_of_birth } = req.body;

  const { id } = req.params;

  let newAddress;
  if (address.length > 0 && coords.longitude) {
    newAddress = {
      address,
      coords,
    };
  }
  try {
    const response = await User.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          name: name,
          email: email,
          is_profile_setup: true,
          date_of_birth: new Date(date_of_birth),
        },
        $push: {
          addresses: newAddress, // This will add the new address to the addresses array
        },
      },
      { new: true } // This option returns the updated user
    );
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    await User.findByIdAndDelete(id);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getUsers = async (req, res) => {
  try {
    let response = await User.find().select("name phone_number email");
    response = response.reverse();
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getUser = async (req, res) => {
  const { id } = req.params;
  try {
    const response = await User.findById(id).populate("orders");
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const addToFavorites = async (req, res) => {
  const { menuItem_id } = req.body;
  const { id } = req.params;

  try {
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.favorites.includes(menuItem_id)) {
      return res.status(400).json({ error: "Favorite already exists" });
    }
    user.favorites.push(menuItem_id);

    await user.save();
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const removeFromFavorites = async (req, res) => {
  const { menuItem_id } = req.body;
  const { id } = req.params;

  try {
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const index = user.favorites.indexOf(menuItem_id);

    if (index === -1) {
      return res.status(400).json({ error: "Favorite not found" });
    }

    user.favorites.splice(index, 1);

    await user.save();
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getOrdersList = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id)
      .select("orders")
      .populate({
        path: "orders",
        populate: { path: "orderItems", populate: "item customizations" },
      });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getFavorites = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id)
      .select("favorites")
      .populate({ path: "favorites", select: "name image" });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const addToAddresses = async (req, res) => {
  const { address, coords } = req.body;

  const { id } = req.params;

  try {
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.addresses.push({
      address,
      coords: {
        latitude: coords.latitude,
        longitude: coords.longitude,
      },
    });

    await user.save();
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteFromAddresses = async (req, res) => {
  try {
    const { id, addressId } = req.params;

    let user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const addressIndex = User.addresses.findIndex(
      (address) => address._id == addressId
    );
    if (addressIndex === -1) {
      return res.status(404).json({ error: "Address not found" });
    }

    user.addresses.splice(addressIndex, 1);
    await user.save();

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

const getUserByToken = async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];

  try {
    const decodedData = jwt.verify(token, process.env.SECRET_KEY);

    const response = await User.findById(decodedData.id);

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateUserExpoToken = async (req, res) => {
  const { id } = req.params;

  const { token } = req.body;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "No user" });
    }
    user.expo_token = token;
    await user.save();
    res.json({ message: "expo token updated", status: true });
  } catch (err) {
    res.json({ message: err.message, status: false });
  }
};

module.exports = {
  createUser,
  updateUser,
  deleteUser,
  getUser,
  getUsers,
  addToFavorites,
  getOrdersList,
  addToAddresses,
  deleteFromAddresses,
  getFavorites,
  removeFromFavorites,
  getUserByToken,
  setUserInfo,
  updateUserExpoToken,
};
