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

module.exports = { renderRuleNotifications };
