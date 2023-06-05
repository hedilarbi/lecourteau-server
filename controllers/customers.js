const Customer = require("../models/Customer");

const createCustomer = async (req, res) => {
  const { phone_number } = req.body;
  try {
    const verifyPhone = await Customer.findOne({ phone_number });
    if (verifyPhone) {
      return res
        .status(403)
        .json({ message: "Un compte existe déja avec ce numéro" });
    }
    const newCustomer = new Customer({
      phone_number,
      createdAt: new Date().toISOString(),
    });
    const response = await newCustomer.save();
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateCustomer = async (req, res) => {
  const { phone_number, email, profile_img, name } = req.body;
  const { id } = req.params;
  try {
    const response = await Customer.findByIdAndUpdate(
      id,
      { phone_number, email, profile_img, name },
      { new: true }
    );
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteCustomer = async (req, res) => {
  const { id } = req.params;
  try {
    await Customer.findByIdAndDelete(id);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getCustomers = async (req, res) => {
  try {
    const response = await Customer.find();
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getCustomer = async (req, res) => {
  const { id } = req.params;
  try {
    const response = await Customer.findById(id);
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const addToFavorites = async (req, res) => {
  const { menuItem_id } = req.body;
  const { id } = req.params;

  try {
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    if (customer.favorites.includes(menuItem_id)) {
      return res.status(400).json({ error: "Favorite already exists" });
    }
    customer.favorites.push(menuItem_id);

    await customer.save();
    res.status(200).json(customer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteFromFavorites = async (req, res) => {
  const { id } = req.params;
  const { menuItem_id } = req.body;
  try {
    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const favoriteIndex = customer.favorites.indexOf(menuItem_id);
    if (favoriteIndex === -1) {
      return res.status(404).json({ error: "Favorite not found" });
    }

    customer.favorites.splice(favoriteIndex, 1);
    await customer.save();

    res.status(200).json(customer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const addToAddresses = async (req, res) => {
  const { address } = req.body;
  const { id } = req.params;

  try {
    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    customer.addresses.push(address);

    await customer.save();
    res.status(200).json(customer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteFromAddresses = async (req, res) => {
  try {
    const { id, addressId } = req.params;

    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const addressIndex = customer.addresses.findIndex(
      (address) => address._id == addressId
    );
    if (addressIndex === -1) {
      return res.status(404).json({ error: "Address not found" });
    }

    customer.addresses.splice(addressIndex, 1);
    await customer.save();

    res.status(200).json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
};

module.exports = {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomer,
  getCustomers,
  addToFavorites,
  deleteFromFavorites,
  addToAddresses,
  deleteFromAddresses,
};
