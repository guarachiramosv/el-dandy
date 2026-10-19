export const moneyInputPattern = /^[0-9]*([.,][0-9]{0,2})?$/;

const toCents = (value: number) => Math.round(value * 100);

export const parseMoneyInput = (value: string): number | null => {
  const normalized = value.trim().replace(",", ".");
  if (!normalized || !moneyInputPattern.test(value.trim())) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export interface CashReconciliationInput {
  expectedCash: number;
  expectedQr: number;
  countedCash: string;
  verifiedQr: string;
  confirmed: boolean;
  notes: string;
}

export interface CashReconciliationResult {
  countedCash: number | null;
  verifiedQr: number | null;
  cashDifference: number | null;
  qrDifference: number | null;
  hasDifference: boolean;
  errors: string[];
  canSubmit: boolean;
}

export function validateCashReconciliation(input: CashReconciliationInput): CashReconciliationResult {
  const countedCash = parseMoneyInput(input.countedCash);
  const verifiedQr = parseMoneyInput(input.verifiedQr);
  const cashDifference = countedCash === null
    ? null
    : (toCents(countedCash) - toCents(input.expectedCash)) / 100;
  const qrDifference = verifiedQr === null
    ? null
    : (toCents(verifiedQr) - toCents(input.expectedQr)) / 100;
  const hasDifference = (cashDifference !== null && cashDifference !== 0)
    || (qrDifference !== null && qrDifference !== 0);
  const errors: string[] = [];

  if (countedCash === null) errors.push("Cuenta el efectivo e ingresa el monto encontrado.");
  if (verifiedQr === null) errors.push("Verifica los pagos QR e ingresa el monto confirmado.");
  if (hasDifference && input.notes.trim().length < 5) {
    errors.push("Explica el motivo del sobrante o faltante antes de enviar el cierre.");
  }
  if (!input.confirmed) {
    errors.push("Confirma que contaste el efectivo y verificaste los pagos QR.");
  }

  return {
    countedCash,
    verifiedQr,
    cashDifference,
    qrDifference,
    hasDifference,
    errors,
    canSubmit: errors.length === 0,
  };
}

