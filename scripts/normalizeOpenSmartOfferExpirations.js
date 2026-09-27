require("dotenv").config();
const mongoose = require("mongoose");

const PersonalizedOffer = require("../models/PersonalizedOffer");
const {
  calculateSmartOfferValidUntil,
  endOfQuebecDay,
  formatSmartOfferExpiry,
} = require("../utils/smartOfferNotificationBody");

const OPEN_STATUSES = ["active", "viewed", "clicked"];
const TARGET_STATUSES = [...OPEN_STATUSES, "prepared"];
const BATCH_SIZE = 500;

const run = async () => {
  const shouldApply = process.argv.includes("--apply");
  const useProduction = process.argv.includes("--prod");
  const uri = useProduction
    ? process.env.PROD_DB_CONNECTION
    : process.env.DEV_DB_CONNECTION;

  if (!uri) {
    throw new Error(`${useProduction ? "PROD" : "DEV"}_DB_CONNECTION is required.`);
  }
  if (shouldApply && !useProduction) {
    throw new Error("Refusing to apply without the explicit --prod flag.");
  }

  await mongoose.connect(uri);
  try {
    const offers = await PersonalizedOffer.find({
      status: { $in: TARGET_STATUSES },
    })
      .select("status validUntil scheduledNotifyAt validityHours")
      .lean();

    const operations = [];
    const counts = {
      scanned: offers.length,
      open: 0,
      prepared: 0,
      changed: 0,
      unchanged: 0,
      skipped: 0,
    };
    const samples = [];

    for (const offer of offers) {
      const isPrepared = offer.status === "prepared";
      if (isPrepared) counts.prepared += 1;
      else counts.open += 1;

      const normalizedValidUntil = isPrepared
        ? calculateSmartOfferValidUntil(offer.scheduledNotifyAt, offer.validityHours)
        : endOfQuebecDay(offer.validUntil);

      if (!normalizedValidUntil) {
        counts.skipped += 1;
        continue;
      }

      const currentTime = offer.validUntil ? new Date(offer.validUntil).getTime() : null;
      if (currentTime === normalizedValidUntil.getTime()) {
        counts.unchanged += 1;
        continue;
      }

      operations.push({
        updateOne: {
          filter: { _id: offer._id, status: offer.status },
          update: {
            $set: {
              validUntil: normalizedValidUntil,
              updatedAt: new Date(),
            },
          },
        },
      });
      counts.changed += 1;

      if (samples.length < 10) {
        samples.push({
          id: String(offer._id),
          status: offer.status,
          beforeUtc: offer.validUntil || null,
          afterUtc: normalizedValidUntil,
          afterQuebec: formatSmartOfferExpiry(normalizedValidUntil),
        });
      }
    }

    console.log(JSON.stringify({
      mode: shouldApply ? "apply" : "dry-run",
      database: useProduction ? "production" : "development",
      counts,
      samples,
    }, null, 2));

    if (!shouldApply || operations.length === 0) return;

    let matched = 0;
    let modified = 0;
    for (let index = 0; index < operations.length; index += BATCH_SIZE) {
      const result = await PersonalizedOffer.bulkWrite(
        operations.slice(index, index + BATCH_SIZE),
        { ordered: false },
      );
      matched += result.matchedCount || 0;
      modified += result.modifiedCount || 0;
    }

    const remainingInvalid = await PersonalizedOffer.find({
      status: { $in: TARGET_STATUSES },
    })
      .select("status validUntil")
      .lean()
      .then((documents) => documents.filter((offer) =>
        !offer.validUntil || !formatSmartOfferExpiry(offer.validUntil)?.endsWith("23 h 59"),
      ));

    console.log(JSON.stringify({
      result: { matched, modified },
      verification: {
        remainingInvalid: remainingInvalid.length,
        invalidIds: remainingInvalid.slice(0, 20).map((offer) => String(offer._id)),
      },
    }, null, 2));

    if (remainingInvalid.length > 0) {
      throw new Error(`${remainingInvalid.length} offer(s) failed expiration verification.`);
    }
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
