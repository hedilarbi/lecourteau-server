const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const categoriesRoutes =  require('./routes/categories')
const customersRoutes =  require('./routes/customers')
const ordersRoutes =  require('./routes/orders')
const toppingsRoutes =  require('./routes/toppings')
const menuItemsRoutes =  require('./routes/menuItems')

require("dotenv/config");

const { createServer } = require("http");

const app = express();
const httpServer = createServer(app);

app.use(cors());


app.use(bodyParser.json({ limit: "50mb", extended: true }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

app.use("/api/customers",customersRoutes)
app.use("/api/categories",categoriesRoutes)
app.use("/api/orders",ordersRoutes)
app.use("/api/toppings",toppingsRoutes)
app.use("/api/menuItems",menuItemsRoutes)

mongoose.connect(process.env.DB_CONNECTION, { useNewUrlParser: true }, );

httpServer.listen(process.env.PORT, () => {
  console.log("listening on port 5000");
});
