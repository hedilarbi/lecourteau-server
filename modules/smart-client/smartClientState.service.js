const SmartClientStateDefinition = require("./smartClientStateDefinition.model");

class SmartClientStateService {
  async evaluate({ event, signals = {}, fallbackState = "Neutre" }) {
    const definitions = await SmartClientStateDefinition.find({
      // Les définitions créées avant l'ajout de `enabled` n'ont pas ce champ.
      // Elles sont actives par défaut, comme côté mobile (`enabled !== false`).
      enabled: { $ne: false },
    }).sort({ priority: -1 }).lean();
    if (!definitions.length) return fallbackState;

    const cart = signals.cart || {};
    const session = signals.session || {};
    for (const definition of definitions) {
      const criteria = definition.criteria || {};
      switch (definition.stateId) {
        case "Frustré":
          if ((session.velocityScore || 0) >= (criteria.rapidClicksCount || Infinity) ||
              (session.failedSearchesCount || 0) >= (criteria.failedSearchesCount || Infinity) ||
              (criteria.promoCodeFailed && session.promoCodeFailed)) return definition.stateId;
          break;
        case "Sur le départ":
          if ((cart.lines || 0) > 0 && (event === "app_backgrounded" || (session.idleTime || 0) >= (criteria.cartInactivitySeconds || Infinity) * 1000 || (criteria.cartExitIntent && session.cartExitIntent))) return definition.stateId;
          break;
        case "Pas le moment":
          if ((cart.lines || 0) === 0 && (event === "app_backgrounded" || (session.idleTime || 0) >= (criteria.cartInactivitySeconds || Infinity) * 1000)) return definition.stateId;
          break;
        case "Sensible au prix":
          if ((criteria.itemRemovedAfterTotal && cart.itemRemovedAfterTotal) ||
              (criteria.sizeDowngraded && cart.sizeDowngraded) ||
              ((criteria.cartBelowHabitPct || 0) > 0 && (cart.belowHabitPct || 0) >= criteria.cartBelowHabitPct) ||
              (session.promosConsultationsCount || 0) >= (criteria.promosConsultationsCount || Infinity) ||
              ((cart.proximityToFreeDelivery || 0) > 0 && cart.proximityToFreeDelivery <= (criteria.freeDeliveryProximity || 0))) return definition.stateId;
          break;
        case "Indécis":
          if ((session.idleTime || 0) >= (criteria.inactivitySeconds || Infinity) * 1000 ||
              (session.oscillationsCount || (session.isOscillating ? 1 : 0)) >= (criteria.oscillationsCount || Infinity) ||
              (session.optionsChangesCount || 0) >= (criteria.optionsChangesCount || Infinity) ||
              (session.distinctProductsViewed || 0) >= (criteria.distinctProductsViewedCount || Infinity) ||
              (session.productSwitchesCount || 0) >= (criteria.productSwitchesCount || Infinity) ||
              (session.productRevisitsCount || 0) >= (criteria.productRevisitsCount || Infinity)) return definition.stateId;
          break;
        case "Décidé":
          if ((cart.lines || 0) > 0 &&
              (session.checkoutTimeSeconds || Infinity) <= (criteria.checkoutTimeSeconds || 0) &&
              (!criteria.habitualItemsOnly || cart.habitualItemsOnly)) return definition.stateId;
          break;
        case "Satisfait":
          if (event === "order_confirmed") return definition.stateId;
          break;
        case "Explorateur":
          if ((cart.lines || 0) === 0 && (session.screensVisited || 0) >= (criteria.screensVisitedCount || 6)) return definition.stateId;
          break;
        default:
          break;
      }
    }
    return definitions.some((item) => item.stateId === fallbackState) ? fallbackState : "Neutre";
  }
}

module.exports = new SmartClientStateService();
