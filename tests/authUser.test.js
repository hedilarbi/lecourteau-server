const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.SECRET_KEY = process.env.SECRET_KEY || "test-secret";
const authUser = require("../middlewares/authUser");

const USER_ID = "507f1f77bcf86cd799439011";
const OTHER_ID = "507f1f77bcf86cd799439012";

const run = ({ authorization, params = {} }) => {
  const req = { headers: authorization ? { authorization } : {}, params };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let calledNext = false;
  authUser(req, res, () => {
    calledNext = true;
  });
  return { req, res, calledNext };
};

const tokenFor = (id, secret = process.env.SECRET_KEY) =>
  jwt.sign({ id, phone_number: "+15555555555" }, secret);

test("rejects a request without token", () => {
  const { res, calledNext } = run({ params: { id: USER_ID } });
  assert.equal(calledNext, false);
  assert.equal(res.statusCode, 401);
});

test("rejects a token signed with another key", () => {
  const { res, calledNext } = run({
    authorization: `Bearer ${tokenFor(USER_ID, "wrong-secret")}`,
    params: { id: USER_ID },
  });
  assert.equal(calledNext, false);
  assert.equal(res.statusCode, 401);
});

test("rejects a token belonging to another user", () => {
  const { res, calledNext } = run({
    authorization: `Bearer ${tokenFor(OTHER_ID)}`,
    params: { id: USER_ID },
  });
  assert.equal(calledNext, false);
  assert.equal(res.statusCode, 403);
});

test("accepts the user's own token and exposes it on req.user", () => {
  const token = tokenFor(USER_ID);
  const { req, calledNext } = run({
    authorization: `Bearer ${token}`,
    params: { id: USER_ID },
  });
  assert.equal(calledNext, true);
  assert.deepEqual(req.user, { id: USER_ID, token });
});

test("accepts a valid token on routes without :id", () => {
  const { req, calledNext } = run({ authorization: `Bearer ${tokenFor(USER_ID)}` });
  assert.equal(calledNext, true);
  assert.equal(req.user.id, USER_ID);
});
