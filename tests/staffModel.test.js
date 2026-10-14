const test = require("node:test");
const assert = require("node:assert/strict");
const Staff = require("../models/staff");

const projectionOf = (query) => {
  query._applyPaths();
  return query._fields || {};
};

test("password is never selected by default", () => {
  assert.equal(projectionOf(Staff.find()).password, 0);
  assert.equal(projectionOf(Staff.findById("507f1f77bcf86cd799439011")).password, 0);
});

test("password can be requested explicitly for login", () => {
  const fields = projectionOf(Staff.findOne({ username: "admin" }).select("+password"));
  assert.notEqual(fields.password, 0);
});

test("password is stripped from JSON responses", () => {
  const staff = new Staff({ username: "admin", role: "admin", password: "$2b$10$hash" });
  const json = JSON.parse(JSON.stringify(staff));
  assert.equal(json.password, undefined);
  assert.equal(json.username, "admin");
  assert.equal(staff.password, "$2b$10$hash");
});
