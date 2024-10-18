const MenuItem = require("../../models/MenuItem");

const getItemsNamesService = async () => {
  try {
    const response = await MenuItem.find().select("name prices"); // Fetch item names and prices
    return { response }; // Return the fetched response
  } catch (err) {
    console.error("Error in getItemsNamesService:", err); // Log the error for debugging
    return { error: err.message }; // Return error message
  }
};

module.exports = getItemsNamesService;
