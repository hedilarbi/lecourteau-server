require('dotenv').config();
const mongoose = require('mongoose');

const run = async () => {
  try {
    await mongoose.connect(process.env.DEV_DB_CONNECTION);
    const db = mongoose.connection.db;

    const rules = await db.collection('smartofferrules').find({
      strategyId: { $in: [3, 4, 5, 6, 7] }
    }).toArray();

    rules.forEach(rule => {
      console.log(`\nS${rule.strategyId} | Segment: ${rule.segment} | Group: ${rule.group} | Type: ${rule.offerType}`);
      console.log(`- Discount Value (bonus points/value): ${rule.discountValue || rule.bonusPoints}`);
      console.log(`- Threshold (bonusThreshold): ${rule.bonusThreshold}`);
      console.log(`- Is Active: ${rule.isActive}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
};

run();
