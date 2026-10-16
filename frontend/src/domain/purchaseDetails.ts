export type PurchaseCurrency = "BOB" | "BRL";

export type PurchaseCost = {
  precioBs: number;
  precioReales: number;
  tipoCambio: number;
};

export const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const calculatePurchaseUnitCostBs = (currency: PurchaseCurrency, cost: PurchaseCost) => (
  currency === "BRL"
    ? roundCurrency(cost.precioReales * cost.tipoCambio)
    : roundCurrency(cost.precioBs)
);

export const validatePurchaseCost = (currency: PurchaseCurrency, cost: PurchaseCost): string | null => {
  if (!Number.isFinite(cost.precioBs) || cost.precioBs < 0) return "El precio de compra no puede ser negativo.";
  if (currency === "BRL") {
    if (!Number.isFinite(cost.precioReales) || cost.precioReales < 0) return "El precio de compra en reales no puede ser negativo.";
    if (!Number.isFinite(cost.tipoCambio) || cost.tipoCambio <= 0) return "El tipo de cambio debe ser mayor a 0 para compras en reales.";
  }
  return null;
};
