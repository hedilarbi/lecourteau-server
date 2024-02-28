const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const categoriesRoutes = require("./routes/categories");
const usersRoutes = require("./routes/users");
const ordersRoutes = require("./routes/orders");
const toppingsRoutes = require("./routes/toppings");
const menuItemsRoutes = require("./routes/menuItems");
const offersRoutes = require("./routes/offers");
const toppingCategoriesRoutes = require("./routes/toppingCategory");
const rewardsRoutes = require("./routes/rewards");
const settingsRoutes = require("./routes/settings");
const staffsRoutes = require("./routes/staffs");
const paymentsRoutes = require("./routes/payments");
const statsRoutes = require("./routes/stats");
const restaurantsRoutes = require("./routes/restaurants");
const notifiersRoutes = require("./routes/notifies");
require("dotenv/config");

const { createServer } = require("http");

const app = express();
const httpServer = createServer(app);

app.use(cors());

app.use(bodyParser.json({ limit: "50mb", extended: true }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

app.use("/api/users", usersRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/toppings", toppingsRoutes);
app.use("/api/menuItems", menuItemsRoutes);
app.use("/api/offers", offersRoutes);
app.use("/api/toppingCategories", toppingCategoriesRoutes);
app.use("/api/rewards", rewardsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/staffs", staffsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/restaurants", restaurantsRoutes);
app.use("/api/notifiers", notifiersRoutes);

mongoose.connect(process.env.PROD_DB_CONNECTION, { useNewUrlParser: true });

httpServer.listen(process.env.PORT, () => {
  console.log("listening on port 5000");
});
