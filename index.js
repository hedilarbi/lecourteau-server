const express = require("express");
const mongoose = require("mongoose");
require("dotenv/config");

const { createServer } = require("http");

const app = express();
const httpServer = createServer(app);

httpServer.listen(process.env.PORT, () => {
  console.log("listening on port 5000");
});
