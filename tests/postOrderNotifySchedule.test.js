const test = require("node:test");
const assert = require("node:assert/strict");
const { getScheduledNotifyAt } = require("../services/smartOffersV2/ProfilingService");

// Commande 1C93EB2B : confirmée le 15 octobre à 20 h 21 (Toronto, UTC-4), heure d'envoi du client 19 h.
const eveningOrder = new Date("2026-10-16T00:21:50Z");

test("scan normal : heure déjà passée → envoi immédiat (comportement inchangé)", () => {
  assert.equal(getScheduledNotifyAt(eveningOrder, 19).toISOString(), eveningOrder.toISOString());
});

test("après commande : le lendemain à l'heure habituelle, jamais tout de suite", () => {
  assert.equal(
    getScheduledNotifyAt(eveningOrder, 19, { notBeforeTomorrow: true }).toISOString(),
    "2026-10-16T23:00:00.000Z", // 16 octobre, 19 h Toronto
  );
});

test("après commande le matin : quand même le lendemain, pas plus tard le jour même", () => {
  const morningOrder = new Date("2026-10-15T12:00:00Z"); // 8 h Toronto
  assert.equal(getScheduledNotifyAt(morningOrder, 19).toISOString(), "2026-10-15T23:00:00.000Z");
  assert.equal(
    getScheduledNotifyAt(morningOrder, 19, { notBeforeTomorrow: true }).toISOString(),
    "2026-10-16T23:00:00.000Z",
  );
});

test("après commande tard le soir avant le passage à l'heure d'hiver : jour suivant correct", () => {
  // 31 octobre 2026, 23 h 30 Toronto (UTC-4) ; le 1er novembre, l'heure recule (UTC-5).
  const lateOrder = new Date("2026-11-01T03:30:00Z");
  assert.equal(
    getScheduledNotifyAt(lateOrder, 11, { notBeforeTomorrow: true }).toISOString(),
    "2026-11-01T16:00:00.000Z", // 1er novembre, 11 h Toronto (UTC-5)
  );
});
