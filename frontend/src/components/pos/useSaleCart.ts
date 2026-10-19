import { useCallback, useMemo, useRef, useState } from "react";
import type { Product } from "../../types";
import { productStep, resolveAvailableStock, type CartItem } from "./posDomain";

interface UseSaleCartOptions {
  branchId?: string | null;
  onError: (message: string) => void;
}

export function useSaleCart({ branchId, onError }: UseSaleCartOptions) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const cartRef = useRef<CartItem[]>([]);
  const [discount, setDiscountState] = useState(0);

  const getAvailableStock = useCallback(
    (product: Product) => resolveAvailableStock(product, branchId),
    [branchId],
  );

  const addProduct = useCallback((product: Product) => {
    const availableStock = getAvailableStock(product);
    const step = productStep(product);
    if (availableStock < step) {
      onError("Producto sin stock disponible en tu sucursal.");
      return false;
    }
    const currentCart = cartRef.current;
    const existing = currentCart.find((item) => item.product.id === product.id);
    if (existing && existing.cantidad + step > availableStock) {
      onError(`Stock insuficiente. Disponible: ${availableStock}`);
      return false;
    }
    const productForCart = { ...product, stock: availableStock };
    const nextCart = existing
      ? currentCart.map((item) => item.product.id === product.id ? { ...item, cantidad: item.cantidad + step } : item)
      : [...currentCart, { product: productForCart, cantidad: step }];
    cartRef.current = nextCart;
    setCart(nextCart);
    return true;
  }, [getAvailableStock, onError]);

  const changeQuantity = useCallback((productId: string, direction: -1 | 1) => {
    const nextCart = cartRef.current.map((item) => {
      if (item.product.id !== productId) return item;
      const step = productStep(item.product);
      const next = Math.max(step, Math.min(item.product.stock, item.cantidad + direction * step));
      if (next === item.cantidad && direction > 0) onError(`Stock insuficiente. Disponible: ${item.product.stock}`);
      return { ...item, cantidad: next };
    });
    cartRef.current = nextCart;
    setCart(nextCart);
  }, [onError]);

  const removeProduct = useCallback((productId: string) => {
    const nextCart = cartRef.current.filter((item) => item.product.id !== productId);
    cartRef.current = nextCart;
    setCart(nextCart);
  }, []);

  const setDiscount = useCallback((value: number) => {
    setDiscountState(Number.isFinite(value) ? Math.max(value, 0) : 0);
  }, []);

  const clear = useCallback(() => {
    cartRef.current = [];
    setCart([]);
    setDiscountState(0);
  }, []);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.product.precioVenta * item.cantidad, 0);
    return {
      subtotal,
      totalQuantity: cart.reduce((sum, item) => sum + item.cantidad, 0),
      total: Math.max(subtotal - discount, 0),
    };
  }, [cart, discount]);

  return { cart, discount, ...totals, getAvailableStock, addProduct, changeQuantity, removeProduct, setDiscount, clear };
}
