const test = require("node:test");
const assert = require("node:assert/strict");
const { notifyCustomer } = require("../services/notificationServices/notifyCustomer");

const TOKEN = "ExponentPushToken[abc123]";
const push = { title: "Retard", body: "20 min de retard", data: {} };
const email = { subject: "Votre commande #03CE0726 : prête vers 16 h 41", paragraphs: ["Votre commande a du retard."] };
const fakeExpo = (ticket, calls) => ({ sendPushNotificationsAsync: async (msgs) => { calls.push(msgs); return [ticket]; } });
const fakeMail = (sent, fail = false) => ({ sendMail: async (m) => { if (fail) throw new Error("SES down"); sent.push(m); } });

test("push acceptée : pas de courriel", async () => {
  const calls = []; const sent = [];
  const channel = await notifyCustomer({ user: { name: "Edith M", email: "e@x.com", expo_token: TOKEN }, push, email, deps: { expo: fakeExpo({ status: "ok" }, calls), transporter: fakeMail(sent) } });
  assert.equal(channel, "push");
  assert.equal(calls.length, 1);
  assert.equal(sent.length, 0);
});

test("client du site web (pas de jeton) : courriel", async () => {
  const calls = []; const sent = [];
  const channel = await notifyCustomer({ user: { name: "Edith Massicotte", email: "e@x.com" }, push, email, deps: { expo: fakeExpo({ status: "ok" }, calls), transporter: fakeMail(sent) } });
  assert.equal(channel, "email");
  assert.equal(calls.length, 0);
  assert.equal(sent[0].to, "e@x.com");
  assert.equal(sent[0].subject, email.subject);
  assert.match(sent[0].text, /^Bonjour Edith,/);
});

test("push refusée par Expo (ticket en erreur) : courriel", async () => {
  const sent = [];
  const channel = await notifyCustomer({ user: { name: "A", email: "a@x.com", expo_token: TOKEN }, push, email, deps: { expo: fakeExpo({ status: "error", details: { error: "DeviceNotRegistered" } }, []), transporter: fakeMail(sent) } });
  assert.equal(channel, "email");
  assert.equal(sent.length, 1);
});

test("push qui plante : courriel", async () => {
  const sent = [];
  const expo = { sendPushNotificationsAsync: async () => { throw new Error("réseau"); } };
  const channel = await notifyCustomer({ user: { email: "a@x.com", expo_token: TOKEN }, push, email, deps: { expo, transporter: fakeMail(sent) } });
  assert.equal(channel, "email");
});

test("app désinstallée : pas de push, courriel", async () => {
  const calls = []; const sent = [];
  const channel = await notifyCustomer({ user: { email: "a@x.com", expo_token: TOKEN, appIsInstalled: false }, push, email, deps: { expo: fakeExpo({ status: "ok" }, calls), transporter: fakeMail(sent) } });
  assert.equal(channel, "email");
  assert.equal(calls.length, 0);
});

test("ni push ni courriel possible : null", async () => {
  assert.equal(await notifyCustomer({ user: { name: "A" }, push, email, deps: { transporter: fakeMail([]) } }), null);
  assert.equal(await notifyCustomer({ user: { email: "a@x.com" }, push, email, deps: { transporter: fakeMail([], true) } }), null);
});

test("le courriel échappe le HTML du nom", async () => {
  const sent = [];
  await notifyCustomer({ user: { name: "<b>Jo</b>", email: "a@x.com" }, push, email, deps: { transporter: fakeMail(sent) } });
  assert.ok(!sent[0].html.includes("<b>Jo"));
});
