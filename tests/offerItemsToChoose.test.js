const test = require("node:test");
const assert = require("node:assert/strict");
const { parseItemsToChoose, validateOrderOfferChoices } = require("../utils/offerItemsToChoose");

const offer = {
  _id: "o1",
  name: "Menu Duo",
  itemsToChoose: 2,
  items: [
    { item: "poutine", quantity: 1 },
    { item: "frites", quantity: 2 },
    { item: "burger", quantity: 1 },
    { item: "salade", quantity: 1 },
  ],
};
const OfferModel = {
  find: () => ({ select: () => ({ lean: async () => [offer] }) }),
};

test("parseItemsToChoose : vide = tous inclus, bornes 1..n-1", () => {
  assert.deepEqual(parseItemsToChoose("", 4), { value: null });
  assert.deepEqual(parseItemsToChoose("0", 4), { value: null });
  assert.deepEqual(parseItemsToChoose("2", 4), { value: 2 });
  assert.ok(parseItemsToChoose("4", 4).error);
  assert.ok(parseItemsToChoose("1.5", 4).error);
});

test("2 articles différents de l'offre : valide (Frites ×2 compte pour 1)", async () => {
  const error = await validateOrderOfferChoices(
    [{ offer: "o1", items: [{ item: "frites" }, { item: "frites" }, { item: "burger" }] }],
    OfferModel,
  );
  assert.equal(error, null);
});

test("même article choisi deux fois (quantité 1) : refusé", async () => {
  const error = await validateOrderOfferChoices(
    [{ offer: "o1", items: [{ item: "poutine" }, { item: "poutine" }] }],
    OfferModel,
  );
  assert.match(error, /trop d'exemplaires/);
});

test("mauvais nombre de choix : refusé", async () => {
  const error = await validateOrderOfferChoices(
    [{ offer: "o1", items: [{ item: "poutine" }, { item: "burger" }, { item: "salade" }] }],
    OfferModel,
  );
  assert.match(error, /Choisissez 2 articles/);
});

test("article hors de l'offre : refusé", async () => {
  const error = await validateOrderOfferChoices(
    [{ offer: "o1", items: [{ item: "poutine" }, { item: "pizza" }] }],
    OfferModel,
  );
  assert.match(error, /n'en fait pas partie/);
});
