import type { PaymentMethod, Product } from "../../types";

export interface CartItem {
  product: Product;
  cantidad: number;
}

export const sellerPaymentOptions = ["EFECTIVO", "QR", "MIXTO", "CREDITO"] as const;
export type SellerPaymentOption = (typeof sellerPaymentOptions)[number];

export const money = (value: number) =>
  `Bs ${value.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const productUnitLabel = (product: Product) => product.unidadVenta === "METRO" ? "m" : "unidades";
export const productStep = (product: Product) => product.unidadVenta === "METRO" ? 0.5 : 1;

export const formatQuantity = (value: number, product?: Product) =>
  `${value.toLocaleString("es-BO", { maximumFractionDigits: 2 })} ${product ? productUnitLabel(product) : "unidades"}`;

export const productConditionLabel = (condition?: string | null) => condition === "USADO" ? "Usado" : "Nuevo";

export const productConditionClass = (condition?: string | null) =>
  condition === "USADO"
    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
    : "border-green-500/40 bg-green-500/10 text-green-200";

export function resolveAvailableStock(product: Product, branchId?: string | null) {
  if (!branchId) return product.stock;
  const activeBranchStocks = product.stockSucursales?.filter(
    (item) => item.estado === "ACTIVO" && item.activo !== false,
  ) || [];
  const sellerBranchStock = activeBranchStocks.find((item) => item.sucursalId === branchId);
  if (sellerBranchStock) return sellerBranchStock.stock;
  const productBranchStock = activeBranchStocks.find((item) => item.sucursalId === product.sucursalId);
  return productBranchStock?.stock ?? product.stock;
}

export interface SaleDraftValidationInput {
  hasUser: boolean;
  cart: CartItem[];
  isClosed: boolean;
  isCorrectionMode: boolean;
  correctionReason: string;
  saleType: "CONTADO" | "CREDITO";
  dueDate: string;
  paymentMethod: PaymentMethod;
  mixedCashAmount: number;
  subtotal: number;
  discount: number;
  total: number;
}

export function validateSaleDraft(input: SaleDraftValidationInput): string | null {
  if (!input.hasUser) return "Debes iniciar sesión nuevamente.";
  if (input.cart.length === 0) return "Agrega al menos un producto.";
  if (input.isClosed) return "La caja de esta jornada ya fue cerrada.";
  if (!Number.isFinite(input.discount) || input.discount < 0) return "El descuento no puede ser negativo.";
  if (input.discount > input.subtotal) return "El descuento no puede superar el subtotal de la venta.";
  if (input.total <= 0) return "El total de la venta debe ser mayor a cero.";
  if (input.isCorrectionMode && input.correctionReason.trim().length < 5) {
    return "Explica el motivo de la corrección con al menos 5 caracteres.";
  }
  if (input.saleType === "CREDITO" && !input.dueDate) {
    return "Indica la fecha en que el cliente pagará el crédito.";
  }
  if (input.paymentMethod === "MIXTO" && (
    !Number.isFinite(input.mixedCashAmount)
    || input.mixedCashAmount <= 0
    || input.mixedCashAmount >= input.total
  )) {
    return "En pago mixto, el efectivo debe ser mayor a cero y menor al total.";
  }
  return null;
}

export function validateInvoiceCustomer(name: string, phone: string, saleType: "CONTADO" | "CREDITO") {
  if (!name.trim()) return "Ingresa el nombre del cliente o empresa para la factura.";
  if (saleType === "CREDITO" && !phone.trim()) return "Ingresa el número de celular del cliente para la venta a crédito.";
  return null;
}
