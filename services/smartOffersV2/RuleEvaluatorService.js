const jsep = require("jsep");

/**
 * Moteur d'évaluation des règles dynamiques.
 */
class RuleEvaluatorService {
  /**
   * Évalue si un utilisateur correspond à une règle dynamique.
   * @param {Object} userContext - Le contexte pré-calculé de l'utilisateur ou les données brutes nécessaires.
   * @param {Object} rule - L'objet DynamicRule.
   * @returns {Boolean}
   */
  static evaluate(userContext, rule) {
    if (!rule.conditions || rule.conditions.length === 0) {
      // S'il n'y a pas de conditions, la règle est toujours vraie
      return true;
    }

    // 1. Évaluer chaque condition individuellement
    const conditionResults = {};
    for (const condition of rule.conditions) {
      conditionResults[condition.conditionId] = this.evaluateCondition(
        userContext,
        condition
      );
    }

    // 2. Évaluer l'expression logique globale
    if (!rule.logicalExpression) {
      return Object.values(conditionResults).every((res) => res === true);
    }
    return this.evaluateLogicalExpression(rule.logicalExpression, conditionResults);
  }

  /**
   * Évalue une condition spécifique en fonction du contexte utilisateur.
   */
  static evaluateCondition(userContext, condition) {
    const { criteria, operator, value, periodDays } = condition;
    
    // Obtenir la valeur réelle de l'utilisateur pour ce critère
    const userValue = this.extractCriteriaValue(userContext, criteria, periodDays);

    switch (operator) {
      case "==":
        return userValue == value;
      case "!=":
        return userValue != value;
      case ">":
        return userValue > value;
      case ">=":
        return userValue >= value;
      case "<":
        return userValue < value;
      case "<=":
        return userValue <= value;
      case "in":
        return Array.isArray(value) && value.includes(userValue);
      case "not_in":
        return Array.isArray(value) && !value.includes(userValue);
      default:
        return false;
    }
  }

  /**
   * Extrait ou calcule la valeur d'un critère depuis le contexte utilisateur.
   */
  static extractCriteriaValue(userContext, criteria, periodDays) {
    // Si une période est spécifiée, on filtre les commandes
    let relevantOrders = userContext.orders || [];
    if (periodDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - periodDays);
      relevantOrders = relevantOrders.filter(
        (o) => new Date(o.createdAt) >= cutoffDate
      );
    }

    switch (criteria) {
      case "total_spent":
        return relevantOrders.reduce((sum, o) => sum + (o.sub_total || o.total_price || 0), 0);
      
      case "average_basket":
        if (relevantOrders.length === 0) return 0;
        const total = relevantOrders.reduce((sum, o) => sum + (o.sub_total || o.total_price || 0), 0);
        return total / relevantOrders.length;
      
      case "orders_count":
      case "orders_last_X_days":
        return relevantOrders.length;
      
      case "recency_days":
        if (relevantOrders.length === 0) return 999;
        // relevantOrders est supposé être trié par date décroissante
        const lastOrder = relevantOrders[0];
        return Math.floor((new Date() - new Date(lastOrder.createdAt)) / (1000 * 60 * 60 * 24));

      case "average_days_between_orders":
        return userContext.medianOrderIntervalDays || 999;

      case "recency_to_cadence_ratio":
        return userContext.recencyToCadenceRatio || 0;

      case "account_age_days":
        return userContext.accountAgeDays || 0;

      case "fidelity_points":
        return userContext.user.fidelity_points || 0;
      
      case "is_subscribed":
        return userContext.user.subscriptionIsActive || false;
      
      case "has_app":
      case "app_is_installed":
        return userContext.user.appIsInstalled !== false;
      
      case "open_rate":
        return userContext.openRate || 0;
      
      case "rewards_claimed":
      case "smart_offers_used":
        return (userContext.userOffers || []).filter(o => o.status === "used" || o.status === "redeemed").length;
        
      case "smart_offers_conversion_rate": {
        const offers = userContext.userOffers || [];
        if (offers.length === 0) return 0;
        const used = offers.filter(o => o.status === "used" || o.status === "redeemed").length;
        return (used / offers.length) * 100;
      }

      case "favorite_category":
        return this.computeFavoriteCategory(relevantOrders);
        
      case "favorite_item":
        return this.computeFavoriteItem(relevantOrders);

      case "preferred_day":
        return this.computeStatisticalMode(relevantOrders, (o) => {
          return this.getPartsInTimezone(new Date(o.createdAt)).day;
        });
      
      case "preferred_hour":
        return this.computeStatisticalMode(relevantOrders, (o) => {
          return this.getPartsInTimezone(new Date(o.createdAt)).hour;
        });

      // Ajouter d'autres critères selon les besoins...
      
      default:
        return null;
    }
  }

  static computeFavoriteItem(orders) {
    const itemCounts = {};
    for (const order of orders) {
      for (const item of (order.orderItems || [])) {
        const itemId = item.item?._id || item.item;
        if (itemId) {
          itemCounts[itemId] = (itemCounts[itemId] || 0) + 1;
        }
      }
    }
    const sorted = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : null;
  }

  static computeFavoriteCategory(orders) {
    // Une implémentation simple pour trouver la catégorie la plus commandée
    const catCounts = {};
    for (const order of orders) {
      for (const item of (order.orderItems || [])) {
        // En supposant que item.item est populé avec sa catégorie, ou qu'on a un map
        const catId = item.item?.category?._id || item.item?.category;
        if (catId) {
          catCounts[catId] = (catCounts[catId] || 0) + 1;
        }
      }
    }
    const sorted = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : null;
  }

  static getPartsInTimezone(date, timezone = "America/Toronto") {
    try {
      const formatterForParts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour12: false, hour: "numeric" });
      const hourPart = formatterForParts.formatToParts(date).find(p => p.type === "hour");
      let hour = hourPart ? parseInt(hourPart.value, 10) : 12;
      if (hour === 24) hour = 0; // Fix edge case if format returns 24
      
      const weekdayName = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" }).format(date);
      const dayMap = { "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6 };
      const day = dayMap[weekdayName] !== undefined ? dayMap[weekdayName] : date.getDay();
      
      return { hour, day };
    } catch (error) {
      return { hour: date.getHours(), day: date.getDay() };
    }
  }

  static computeStatisticalMode(orders, extractFn) {
    if (!orders || orders.length === 0) return null;
    
    const counts = {};
    let maxCount = 0;
    let modeValue = null;

    for (const order of orders) {
      if (!order.createdAt) continue;
      const val = extractFn(order);
      counts[val] = (counts[val] || 0) + 1;
      
      if (counts[val] > maxCount) {
        maxCount = counts[val];
        modeValue = val;
      }
    }
    
    return modeValue;
  }

  /**
   * Parse et évalue l'expression logique (ex: "C1 AND (C2 OR C3)")
   */
  static evaluateLogicalExpression(expression, conditionResults) {
    try {
      // JSEP parse l'expression Javascript. On va transformer les 'AND'/'OR' en '&&'/'||' pour le parseur.
      const jsExpression = expression.replace(/AND/gi, "&&").replace(/OR/gi, "||");
      const ast = jsep(jsExpression);
      
      return this.evaluateAst(ast, conditionResults);
    } catch (err) {
      console.error("Erreur lors de l'évaluation de l'expression logique:", err);
      return false;
    }
  }

  static evaluateAst(node, context) {
    if (!node) return false;

    if (node.type === "Identifier") {
      return Boolean(context[node.name]);
    }
    
    if (node.type === "LogicalExpression" || node.type === "BinaryExpression") {
      const left = this.evaluateAst(node.left, context);
      
      if (node.operator === "&&" && !left) return false;
      if (node.operator === "||" && left) return true;
      
      const right = this.evaluateAst(node.right, context);
      
      if (node.operator === "&&") return left && right;
      if (node.operator === "||") return left || right;
    }
    
    return false;
  }
}

module.exports = RuleEvaluatorService;
