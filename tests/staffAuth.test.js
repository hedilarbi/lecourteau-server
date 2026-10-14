const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const jwt = require("jsonwebtoken");

process.env.SECRET_KEY = "test-user-secret";
process.env.STAFF_SECRET_KEY = "test-staff-secret";

// Remplace le modèle Staff pour ne pas toucher à la base.
const STAFF_ROLES = {
  "507f1f77bcf86cd799439021": "admin",
  "507f1f77bcf86cd799439022": "Caissier",
  "507f1f77bcf86cd799439023": "Livreur",
};
const staffModelPath = path.resolve(__dirname, "../models/staff.js");
require.cache[staffModelPath] = {
  id: staffModelPath,
  filename: staffModelPath,
  loaded: true,
  exports: {
    findById: (id) => ({
      select: () => ({
        lean: async () => (STAFF_ROLES[id] ? { role: STAFF_ROLES[id] } : null),
      }),
    }),
  },
};

const authStaff = require("../middlewares/authStaff");
const requireStaffRole = require("../middlewares/requireStaffRole");
const { requireStaffSelfOrRole } = requireStaffRole;
const authUserOrStaffRole = require("../middlewares/authUserOrStaffRole");
const generateStaffToken = require("../utils/generateStaffToken");

const USER_ID = "507f1f77bcf86cd799439011";
const OTHER_USER_ID = "507f1f77bcf86cd799439012";
const ADMIN_ID = "507f1f77bcf86cd799439021";
const CASHIER_ID = "507f1f77bcf86cd799439022";
const DRIVER_ID = "507f1f77bcf86cd799439023";

const userToken = (id) => jwt.sign({ id, phone_number: "+15555555555" }, process.env.SECRET_KEY);
const staffToken = (id) => generateStaffToken(id, "staff");

// Exécute une chaîne de middlewares et renvoie le statut final.
const runChain = (middlewares, { token, params = {} }) =>
  new Promise((resolve) => {
    const req = { headers: token ? { authorization: `Bearer ${token}` } : {}, params };
    const res = {
      status(code) {
        resolve({ status: code, req });
        return this;
      },
      json() {
        return this;
      },
    };
    const next = (index) => () => {
      if (index === middlewares.length) return resolve({ status: "next", req });
      return middlewares[index](req, res, next(index + 1));
    };
    next(0)();
  });

const listUsers = [authStaff, requireStaffRole("admin", "Caissier")];
const banUser = [authStaff, requireStaffRole("admin")];
const deleteUser = [authUserOrStaffRole("admin")];
const getUser = [authUserOrStaffRole()];
const manageStaff = [authStaff, requireStaffRole("admin")];
const DELETED_STAFF_ID = "507f1f77bcf86cd799439029";

test("staff tokens are signed with STAFF_SECRET_KEY, not SECRET_KEY", () => {
  const token = staffToken(ADMIN_ID);
  assert.throws(() => jwt.verify(token, process.env.SECRET_KEY));
  assert.equal(jwt.verify(token, process.env.STAFF_SECRET_KEY).id, ADMIN_ID);
});

test("a client token cannot open staff routes", async () => {
  assert.equal((await runChain(listUsers, { token: userToken(ADMIN_ID) })).status, 403);
});

test("an old staff token signed with SECRET_KEY is rejected", async () => {
  const oldToken = jwt.sign({ id: ADMIN_ID, username: "admin" }, process.env.SECRET_KEY);
  assert.equal((await runChain(listUsers, { token: oldToken })).status, 403);
});

test("user list: admin and cashier only", async () => {
  assert.equal((await runChain(listUsers, { token: staffToken(ADMIN_ID) })).status, "next");
  assert.equal((await runChain(listUsers, { token: staffToken(CASHIER_ID) })).status, "next");
  assert.equal((await runChain(listUsers, { token: staffToken(DRIVER_ID) })).status, 403);
  assert.equal((await runChain(listUsers, {})).status, 401);
});

test("ban: admin only", async () => {
  const params = { id: USER_ID };
  assert.equal((await runChain(banUser, { token: staffToken(ADMIN_ID), params })).status, "next");
  assert.equal((await runChain(banUser, { token: staffToken(CASHIER_ID), params })).status, 403);
  assert.equal((await runChain(banUser, { token: userToken(USER_ID), params })).status, 403);
});

test("delete: the account owner or an admin", async () => {
  const params = { id: USER_ID };
  assert.equal((await runChain(deleteUser, { token: userToken(USER_ID), params })).status, "next");
  assert.equal((await runChain(deleteUser, { token: userToken(OTHER_USER_ID), params })).status, 403);
  assert.equal((await runChain(deleteUser, { token: staffToken(ADMIN_ID), params })).status, "next");
  assert.equal((await runChain(deleteUser, { token: staffToken(CASHIER_ID), params })).status, 403);
  assert.equal((await runChain(deleteUser, { params })).status, 401);
});

test("get user: the account owner or any existing staff", async () => {
  const params = { id: USER_ID };
  assert.equal((await runChain(getUser, { token: userToken(USER_ID), params })).status, "next");
  assert.equal((await runChain(getUser, { token: userToken(OTHER_USER_ID), params })).status, 403);
  assert.equal((await runChain(getUser, { token: staffToken(ADMIN_ID), params })).status, "next");
  assert.equal((await runChain(getUser, { token: staffToken(DRIVER_ID), params })).status, "next");
  assert.equal((await runChain(getUser, { token: staffToken(DELETED_STAFF_ID), params })).status, 403);
  assert.equal((await runChain(getUser, { params })).status, 401);
});

test("staff create / update / password: admin only", async () => {
  const params = { id: CASHIER_ID };
  assert.equal((await runChain(manageStaff, { token: staffToken(ADMIN_ID), params })).status, "next");
  assert.equal((await runChain(manageStaff, { token: staffToken(CASHIER_ID), params })).status, 403);
  assert.equal((await runChain(manageStaff, { token: staffToken(DRIVER_ID), params })).status, 403);
  assert.equal((await runChain(manageStaff, { token: userToken(USER_ID), params })).status, 403);
  assert.equal((await runChain(manageStaff, { params })).status, 401);
});

test("staff list and delete: admin only", async () => {
  const adminOnly = [authStaff, requireStaffRole("admin")];
  assert.equal((await runChain(adminOnly, { token: staffToken(ADMIN_ID) })).status, "next");
  assert.equal((await runChain(adminOnly, { token: staffToken(CASHIER_ID) })).status, 403);
});

test("get staff: the staff themself or an admin", async () => {
  const getStaff = [authStaff, requireStaffSelfOrRole("admin")];
  const params = { id: DRIVER_ID };
  assert.equal((await runChain(getStaff, { token: staffToken(DRIVER_ID), params })).status, "next");
  assert.equal((await runChain(getStaff, { token: staffToken(ADMIN_ID), params })).status, "next");
  assert.equal((await runChain(getStaff, { token: staffToken(CASHIER_ID), params })).status, 403);
  assert.equal((await runChain(getStaff, { token: staffToken(DELETED_STAFF_ID), params: { id: DELETED_STAFF_ID } })).status, 403);
  assert.equal((await runChain(getStaff, { token: userToken(DRIVER_ID), params })).status, 403);
});

test("affect order: any existing staff", async () => {
  const affectOrder = [authStaff, requireStaffRole()];
  const params = { id: DRIVER_ID };
  assert.equal((await runChain(affectOrder, { token: staffToken(DRIVER_ID), params })).status, "next");
  assert.equal((await runChain(affectOrder, { token: staffToken(CASHIER_ID), params })).status, "next");
  assert.equal((await runChain(affectOrder, { token: staffToken(DELETED_STAFF_ID), params })).status, 403);
  assert.equal((await runChain(affectOrder, { token: userToken(USER_ID), params })).status, 403);
});

test("staff routes fail closed when STAFF_SECRET_KEY equals SECRET_KEY", async () => {
  const staffKey = process.env.STAFF_SECRET_KEY;
  process.env.STAFF_SECRET_KEY = process.env.SECRET_KEY;
  try {
    assert.throws(() => staffToken(ADMIN_ID));
    const token = jwt.sign({ id: ADMIN_ID }, process.env.SECRET_KEY);
    assert.equal((await runChain(listUsers, { token })).status, 500);
  } finally {
    process.env.STAFF_SECRET_KEY = staffKey;
  }
});
