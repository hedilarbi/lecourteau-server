require("dotenv/config");
const mongoose = require("mongoose");
const crypto = require("crypto");
const Setting = require("../models/Setting");
const SmartClientSetting = require("../modules/smart-client/smartClientSetting.model");
const SmartClientLog = require("../modules/smart-client/smartClientLog.model");
const SmartClientStateDefinition = require("../modules/smart-client/smartClientStateDefinition.model");

const SMART_CLIENT_COLLECTIONS = [
  "smartclientrules",
  "smartclientlogs",
  "smartclientsessions",
  "smartclientexposures",
  "smartclientsettings",
  "smartclientstatedefinitions",
];

const run = async () => {
  await mongoose.connect(process.env.DEV_DB_CONNECTION);

  const legacySetting = await Setting.findOne({}).lean();
  await SmartClientSetting.updateOne(
    {},
    { $setOnInsert: { isActive: Boolean(legacySetting?.smartClient?.isActive) } },
    { upsert: true },
  );

  const legacyLogs = SmartClientLog.collection.find({ eventId: { $exists: false } }, { projection: { _id: 1 } });
  const operations = [];
  for await (const log of legacyLogs) {
    operations.push({ updateOne: { filter: { _id: log._id }, update: { $set: { eventId: `legacy:${log._id}:${crypto.randomUUID()}` } } } });
    if (operations.length === 500) {
      await SmartClientLog.collection.bulkWrite(operations);
      operations.length = 0;
    }
  }
  if (operations.length) await SmartClientLog.collection.bulkWrite(operations);

  // Collapse historical restaurant-scoped definitions into one global definition per state.
  const definitions = await SmartClientStateDefinition.collection
    .find({})
    .sort({ updatedAt: -1, createdAt: -1 })
    .toArray();
  const retainedStateIds = new Set();
  const duplicateDefinitionIds = [];
  for (const definition of definitions) {
    if (retainedStateIds.has(definition.stateId)) duplicateDefinitionIds.push(definition._id);
    else retainedStateIds.add(definition.stateId);
  }
  if (duplicateDefinitionIds.length) {
    await SmartClientStateDefinition.collection.deleteMany({ _id: { $in: duplicateDefinitionIds } });
  }

  const settings = await SmartClientSetting.collection.find({}).sort({ updatedAt: -1 }).toArray();
  if (settings.length > 1) {
    await SmartClientSetting.collection.deleteMany({ _id: { $in: settings.slice(1).map((setting) => setting._id) } });
  }

  await mongoose.connection.collection("smartclientrules").updateMany(
    { location: { $in: ["push", "email", "sms"] } },
    { $set: { location: "in_app" } },
  );

  for (const collectionName of SMART_CLIENT_COLLECTIONS) {
    const collection = mongoose.connection.collection(collectionName);
    await collection.updateMany({ restaurant: { $exists: true } }, { $unset: { restaurant: "" } });
    const indexes = await collection.indexes();
    for (const index of indexes) {
      if (index.name !== "_id_" && Object.prototype.hasOwnProperty.call(index.key, "restaurant")) {
        await collection.dropIndex(index.name);
      }
    }
  }

  await SmartClientStateDefinition.collection.updateMany({ enabled: { $exists: false } }, { $set: { enabled: true } });
  await SmartClientStateDefinition.collection.updateMany({ priority: { $exists: false } }, { $set: { priority: 50 } });
  await SmartClientStateDefinition.collection.updateMany(
    { minimumDurationSeconds: { $exists: false } },
    { $set: { minimumDurationSeconds: 0 } },
  );

  await Promise.all([
    SmartClientLog.syncIndexes(),
    SmartClientStateDefinition.syncIndexes(),
    SmartClientSetting.syncIndexes(),
  ]);
  console.log("Migration Smart Client v2 terminée.");
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
