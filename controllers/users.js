const {
  updateUserService,
} = require("../services/usersServices/updateUserService");
const {
  setUserInfoService,
} = require("../services/usersServices/setUserInfoService");
const {
  deleteUserService,
} = require("../services/usersServices/deleteUserService");
const {
  getUsersService,
} = require("../services/usersServices/getUsersService");
const { getUserService } = require("../services/usersServices/getUserService");
const {
  removeFromFavoritesService,
} = require("../services/usersServices/removeFromFavoritesService");
const {
  getOrdersListService,
} = require("../services/usersServices/getOrdersListService");
const {
  getFavoritesService,
} = require("../services/usersServices/getFavoritesService");
const {
  addToAddressesService,
} = require("../services/usersServices/addToAddressesService");
const {
  deleteFromAddressesService,
} = require("../services/usersServices/deleteFromAddressesService");
const {
  getUserByTokenService,
} = require("../services/usersServices/getUserByTokenService");
const {
  updateUserExpoTokenService,
} = require("../services/usersServices/updateUserExpoTokenService");
const {
  createUserService,
} = require("../services/usersServices/createUserService");
const e = require("express");
const {
  addToFavoritesService,
} = require("../services/usersServices/addToFavoritesService");

const createUser = async (req, res) => {
  const { phone_number } = req.body;

  try {
    const { user, token, error } = await createUserService(phone_number);
    if (error) {
      return res.status(400).json(error);
    }
    res.status(200).json({ user, token });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateUser = async (req, res) => {
  const { email, name } = req.body;
  const { id } = req.params;

  try {
    const { response, error } = await updateUserService(id, email, name);
    if (error) {
      return res.status(400).json(error);
    }
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
const setUserInfo = async (req, res) => {
  const { address, email, name, coords, date_of_birth } = req.body;
  const { id } = req.params;

  try {
    const updatedUser = await setUserInfoService(
      id,
      address,
      email,
      name,
      coords,
      date_of_birth
    );
    res.status(200).json(updatedUser);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await deleteUserService(id);
    if (error) {
      return res.status(404).json(error);
    }
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const { response, error } = await getUsersService();
    if (error) {
      return res.status(404).json(error);
    }

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getUser = async (req, res) => {
  const { id } = req.params;
  try {
    const { response } = await getUserService(id);

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const addToFavorites = async (req, res) => {
  const { itemId } = req.body;
  const { id } = req.params;

  try {
    const { error, user } = await addToFavoritesService(id, itemId);

    if (error) {
      return res.status(400).json({ success: false, error });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const removeFromFavorites = async (req, res) => {
  const { menuItem_id } = req.body;
  const { id } = req.params;

  try {
    const { error, user } = await removeFromFavoritesService(id, menuItem_id);
    if (error) {
      return res.status(400).json({ success: false, error });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getOrdersList = async (req, res) => {
  const { id } = req.params;
  try {
    const { user } = await getOrdersListService(id);
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getFavorites = async (req, res) => {
  const { id } = req.params;
  try {
    const { error, user } = await getFavoritesService(id);
    if (error) {
      return res.status(404).json({ error });
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
    const { error, user } = await addToAddressesService(id, address, coords);
    if (error) {
      return res.status(404).json({ error });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteFromAddresses = async (req, res) => {
  const { id, addressId } = req.params;
  try {
    const { error, user } = await deleteFromAddressesService(id, addressId);
    if (error) {
      return res.status(404).json({ error });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getUserByToken = async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];

  try {
    const { error, user } = await getUserByTokenService(token);

    if (error) {
      return res.status(404).json({ error });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateUserExpoToken = async (req, res) => {
  const { id } = req.params;
  const { token } = req.body;

  try {
    const { error, user } = await updateUserExpoTokenService(id, token);
    if (error) {
      return res.status(404).json({ error });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
