// Pourboire versé au livreur Uber Direct, configuré par restaurant (settings.uber_courier_tip) :
//   - pourboire du client de 1 $ ou plus → with_customer_tip : montant fixe, ou % du pourboire du client ;
//   - pourboire du client sous 1 $ (y compris 0) → without_customer_tip_amount : montant fixe.
// Le restaurant paie la différence quand le montant dépasse le pourboire du client.
// Commande sous le seuil min_order_amount (sous-total après rabais) → aucun pourboire (0 = pas de seuil).
// Restaurant non configuré → 0 (aucun pourboire envoyé à Uber).
const CUSTOMER_TIP_THRESHOLD = 1;
const TIP_MODES = ["fixed", "percent"];

const toAmount = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : 0;
};

/** Configuration propre (valeurs positives, % plafonné à 100). */
const normalizeUberCourierTipConfig = (config = {}) => {
  const mode = TIP_MODES.includes(config?.with_customer_tip?.mode) ? config.with_customer_tip.mode : "fixed";
  const value = toAmount(config?.with_customer_tip?.value);
  return {
    with_customer_tip: { mode, value: mode === "percent" ? Math.min(100, value) : value },
    without_customer_tip_amount: toAmount(config?.without_customer_tip_amount),
    min_order_amount: toAmount(config?.min_order_amount),
  };
};

/** Montant de la commande comparé au seuil : sous-total après rabais (sinon sous-total). */
const getOrderAmountForCourierTip = (order) => {
  const after = Number(order?.sub_total_after_discount);
  return Number.isFinite(after) && after > 0 ? after : Number(order?.sub_total) || 0;
};

/** Pourboire du livreur, en dollars (arrondi au cent). */
const computeUberCourierTip = (customerTip, config, orderAmount = null) => {
  const normalized = normalizeUberCourierTipConfig(config);
  if (normalized.min_order_amount > 0 && orderAmount !== null && Number(orderAmount) < normalized.min_order_amount) {
    return 0;
  }
  const tip = toAmount(customerTip);
  if (tip >= CUSTOMER_TIP_THRESHOLD) {
    const { mode, value } = normalized.with_customer_tip;
    return mode === "percent" ? toAmount((tip * value) / 100) : value;
  }
  return normalized.without_customer_tip_amount;
};

module.exports = {
  CUSTOMER_TIP_THRESHOLD,
  normalizeUberCourierTipConfig,
  computeUberCourierTip,
  getOrderAmountForCourierTip,
};
