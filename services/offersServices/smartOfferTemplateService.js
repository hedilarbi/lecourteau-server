const replaceTemplateValues = (template, values) =>
  String(template || "").replace(
    /{{?(name|category|item|discount|points|threshold)}?}/g,
    (_match, key) => String(values[key] ?? ""),
  );

const renderRuleNotifications = (rule, offer) => {
  const discountValue = Number(rule?.discountValue) || 0;
  const values = {
    name: String(offer?.user?.name || "cher client").trim(),
    category: String(offer?.targetCategory?.name || "").trim(),
    item: String(
      offer?.targetMenuItem?.name ||
      offer?.freeItem?.name ||
      offer?.triggerItem?.name ||
      "",
    ).trim(),
    discount: discountValue
      ? rule?.offerType === "bonus_basket"
        ? `${discountValue}$`
        : `${discountValue}%`
      : "",
    points: Number(rule?.bonusPoints) || "",
    threshold: Number(rule?.bonusThreshold) || 0,
  };

  return {
    notificationTitle: replaceTemplateValues(rule?.notificationTitle, values),
    notificationBody: replaceTemplateValues(rule?.notificationBody, values),
  };
};

// Les montants sont dérivés de la règle réellement sélectionnée, pas d'un
// texte libre qui peut rester inchangé après une modification dans le dashboard.
const renderBasketStrategyNotification = (strategy) => {
  const threshold = Number(strategy?.bonusThreshold) || 0;
  const thresholdText = threshold > 0
    ? ` dès ${threshold} $ de sous-total (avant taxes et frais)`
    : " sur ta prochaine commande";
  const value = Number(strategy?.discountValue) || 0;
  const points = Number(strategy?.bonusPoints) || 0;

  if (strategy?.offerType === "loyalty_points" && points > 0) {
    return {
      title: "🎁 Des points bonus pour ta prochaine commande",
      body: `Gagne ${points} points de fidélité bonus${thresholdText}.`,
    };
  }
  if (strategy?.offerType === "bonus_basket" && value > 0) {
    return {
      title: "🎁 Un rabais pour ta prochaine commande",
      body: `Profite de ${value} $ de rabais${thresholdText}.`,
    };
  }
  if (strategy?.offerType === "discount_order" && value > 0) {
    return {
      title: "🎁 Un rabais pour ta prochaine commande",
      body: `Profite de ${value} % de rabais sur ta commande${threshold > 0 ? thresholdText : ""}.`,
    };
  }
  if (strategy?.offerType === "free_item") {
    return {
      title: "🎁 Un article offert pour ta prochaine commande",
      body: `Reçois un article offert${thresholdText}.`,
    };
  }
  return null;
};

module.exports = { renderRuleNotifications, renderBasketStrategyNotification };
