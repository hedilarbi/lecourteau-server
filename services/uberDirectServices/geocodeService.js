const https = require("https");
const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});
const getAddressFromCoords = async (latitude, longitude) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return { error: "Missing Google Maps API key." };
  }

  if (latitude === undefined || longitude === undefined) {
    return { error: "Missing coordinates for geocoding." };
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;

  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (err) {
          return resolve({
            error: "Invalid response from Google Geocoding API.",
          });
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          return resolve({
            error: "Google Geocoding API error.",
            details: parsed,
          });
        }

        const result = parsed?.results?.[0];
        if (!result) {
          return resolve({
            error: "No geocoding results found for coordinates.",
            details: parsed,
          });
        }

        const components = result?.address_components || [];
        const get = (type) =>
          components.find((component) => component.types?.includes(type));

        const streetNumber = get("street_number")?.long_name;
        const route = get("route")?.long_name;
        let streetAddress = [streetNumber, route]
          .filter(Boolean)
          .join(" ")
          .trim();

        if (!streetAddress && result?.formatted_address) {
          streetAddress = result.formatted_address.split(",")[0]?.trim();
        }

        const city =
          get("locality")?.long_name ||
          get("postal_town")?.long_name ||
          get("administrative_area_level_3")?.long_name ||
          get("sublocality")?.long_name ||
          get("sublocality_level_1")?.long_name;

        const state =
          get("administrative_area_level_1")?.short_name ||
          get("administrative_area_level_1")?.long_name;

        const country = get("country")?.long_name;
        const zipCode = get("postal_code")?.long_name;

        return resolve({
          response: {
            streetAddress,
            city,
            state,
            country,
            zipCode,
          },
        });
      });
    });

    req.on("error", (err) => resolve({ error: err.message }));
  });
};

module.exports = {
  getAddressFromCoords,
};
