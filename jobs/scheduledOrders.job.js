const cron = require("node-cron");
const Order = require("../models/Order");
const { SCHEDULED, ON_GOING } = require("../utils/constants");
function startScheduledOrdersJob() {
  // toutes les minutes
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const in45Min = new Date(now.getTime() + 45 * 60 * 1000);
      const in30Min = new Date(now.getTime() + 30 * 60 * 1000);

      // On "débloque" les commandes dont scheduledFor est dans <= 45 min si delivery, sinon <= 30 min
      const res = await Order.updateMany(
        {
          status: SCHEDULED,
          "scheduled.isScheduled": true,
          "scheduled.processed": false,
          "scheduled.scheduledFor": { $ne: null },
          $or: [
            { type: "delivery", "scheduled.scheduledFor": { $lte: in45Min } },
            { type: { $ne: "delivery" }, "scheduled.scheduledFor": { $lte: in30Min } },
          ],
        },
        {
          $set: {
            status: ON_GOING,
            "scheduled.processed": true,
          },
        },
      );

      // optionnel: log léger
      if (res.modifiedCount > 0) {
        console.log(
          `[scheduledOrdersJob] ${res.modifiedCount} commande(s) passée(s) en cours`,
        );
      }
    } catch (err) {
      console.error("[scheduledOrdersJob] error:", err);
    }
  });
}

module.exports = { startScheduledOrdersJob };
