const mongoose = require("mongoose");
require("dotenv").config({ path: "/Users/hedilarbi/Desktop_Local/courteaux/lecourteau-server/.env" });
const DynamicRule = require("../models/DynamicRule");

const run = async () => {
  try {
    await mongoose.connect(process.env.DEV_DB_CONNECTION);
    const rule25 = await DynamicRule.findOne({ name: "Règle Complexe 25" }).lean();
    console.log("logicalExpression:", rule25.logicalExpression);
    console.log("conditions:", rule25.conditions);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
run();
