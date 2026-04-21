const cron = require("node-cron");
const {
  promoteScheduledOrdersService,
} = require("../services/ordersServices/promoteScheduledOrdersService");

function startScheduledOrdersJob() {
  // toutes les minutes
  cron.schedule("* * * * *", async () => {
    try {
      const { promotedCount, uberCreationAttempts, uberFailures } =
        await promoteScheduledOrdersService();

      // optionnel: log léger
      if (promotedCount > 0) {
        console.log(
          `[scheduledOrdersJob] ${promotedCount} commande(s) passée(s) en cours`,
        );
      }

      if (uberFailures.length > 0) {
        console.log(
          `[scheduledOrdersJob] ${uberFailures.length}/${uberCreationAttempts} création(s) Uber Direct échouée(s)`,
        );
      }
    } catch (err) {
      console.error("[scheduledOrdersJob] error:", err);
    }
  });
}

module.exports = { startScheduledOrdersJob };
