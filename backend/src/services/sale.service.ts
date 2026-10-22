import { assertPreviousCashClosed } from './cashClosingPolicy.service';
import { CashClosingAction, CashClosingStatus, PaymentMethod, Prisma, SaleType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { StockService } from './stock.service';

const stockService = new StockService();

type SaleItemInput = {
  productoId: string;
  cantidad: number;
  descuentoItem: number;
};

type CreateSaleInput = {
  usuarioId: string;
  sucursalId: string;
  clienteId?: string | null;
  metodoPago: PaymentMethod;
  tipoVenta: SaleType;
  descuento: number;
  fechaVencimiento?: string | null;
  fechaNegocio?: string | null;
  cierreCorregidoId?: string | null;
  motivoCorreccion?: string | null;
  pagos?: SalePaymentInput[];
  items: SaleItemInput[];
};

type SalePaymentInput = {
  metodoPago: 'EFECTIVO' | 'QR';
  monto: number;
};

type CloseCashRegisterInput = {
  usuarioId: string;
  sucursalId: string;
  fecha?: string | null;
  montoDeclarado: number;
  notas?: string | null;
  depositadoBanco?: boolean;
  montoDepositado?: number | null;
  referenciaDeposito?: string | null;
};

type ReviewCashClosingInput = {
  cierreId: string;
  administradorId: string;
  comentario: string;
};

type CreateCashExpenseInput = {
  usuarioId: string;
  sucursalId: string;
  fecha?: string | null;
  motivo: string;
  monto: number;
  metodoPago: 'EFECTIVO' | 'QR';
  notas?: string | null;
};

type InternalUserScope = {
  id?: string | null;
  sucursalId?: string | null;
  role?: string | null;
};

type DailySummaryInput = {
  usuarioId?: string | null;
  sucursalId: string;
  fecha?: string | null;
  includeAllSellers?: boolean;
};

const BOLIVIA_UTC_OFFSET_HOURS = 4;

type ProductWithBranchStock = Prisma.ProductoGetPayload<{
  include: { stockSucursales: true };
}>;

function getBusinessDay(dateValue?: string | null) {
  if (dateValue && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const [year, month, day] = dateValue.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, day, BOLIVIA_UTC_OFFSET_HOURS, 0, 0, 0));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end, label: dateValue };
  }

  const base = dateValue ? new Date(dateValue) : new Date();
  if (Number.isNaN(base.getTime())) {
    throw Object.assign(new Error('Fecha invalida'), { status: 400 });
  }

  const boliviaTime = new Date(base.getTime() - BOLIVIA_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  const year = boliviaTime.getUTCFullYear();
  const month = boliviaTime.getUTCMonth();
  const day = boliviaTime.getUTCDate();
  const start = new Date(Date.UTC(year, month, day, BOLIVIA_UTC_OFFSET_HOURS, 0, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const label = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { start, end, label };
}

function getBusinessDayLabel(date: Date) {
  return getBusinessDay(date.toISOString()).label;
}

function parseDueDate(dateValue?: string | null) {
  if (!dateValue) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const [year, month, day] = dateValue.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  }
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    throw Object.assign(new Error('Fecha de pago invalida'), { status: 400 });
  }
  return parsed;
}

function sellerBusinessDayScope(usuarioId: string, sucursalId: string) {
  return {
    usuarioId,
    OR: [
      { sucursalId },
      { usuario: { sucursalId } },
    ],
  };
}

function branchBusinessDayScope(sucursalId: string) {
  return {
    OR: [
      { sucursalId },
      { usuario: { sucursalId } },
    ],
  };
}

function emptyTotals() {
  return {
    cantidadVentas: 0,
    totalVentas: 0,
    totalEfectivo: 0,
    totalTransferencia: 0,
    totalQr: 0,
    totalTarjeta: 0,
    totalCredito: 0,
  };
}

function emptyExpenseTotals() {
  return {
    totalGastos: 0,
    totalEfectivo: 0,
    totalQr: 0,
  };
}

function emptyCreditPaymentTotals() {
  return {
    totalCobrosCredito: 0,
    totalEfectivo: 0,
    totalTransferencia: 0,
    totalQr: 0,
    totalTarjeta: 0,
  };
}

function getNetTotals(
  totals: ReturnType<typeof emptyTotals>,
  gastos: ReturnType<typeof emptyExpenseTotals>,
  cobrosCredito: ReturnType<typeof emptyCreditPaymentTotals> = emptyCreditPaymentTotals()
) {
  const netoEfectivo = Math.max(totals.totalEfectivo + cobrosCredito.totalEfectivo - gastos.totalEfectivo, 0);
  const netoQr = Math.max(totals.totalQr + cobrosCredito.totalQr - gastos.totalQr, 0);
  return {
    totalEfectivo: netoEfectivo,
    totalQr: netoQr,
    totalDisponible:
      netoEfectivo +
      totals.totalTransferencia +
      cobrosCredito.totalTransferencia +
      netoQr +
      totals.totalTarjeta +
      cobrosCredito.totalTarjeta,
  };
}

function buildSalePayments(
  total: number,
  tipoVenta: SaleType,
  metodoPago: PaymentMethod,
  pagos?: SalePaymentInput[],
) {
  if (tipoVenta === 'CREDITO') return [];

  if (metodoPago !== 'MIXTO') {
    return [{ metodoPago, monto: total }];
  }

  const efectivo = pagos?.find((pago) => pago.metodoPago === 'EFECTIVO')?.monto ?? 0;
  const qr = pagos?.find((pago) => pago.metodoPago === 'QR')?.monto ?? 0;
  const roundedTotal = Math.round(total * 100);
  const roundedPayments = Math.round((efectivo + qr) * 100);

  if (efectivo <= 0 || qr <= 0 || roundedPayments !== roundedTotal) {
    throw Object.assign(new Error('Los montos en efectivo y QR deben ser mayores a cero y sumar exactamente el total de la venta.'), { status: 400 });
  }

  return [
    { metodoPago: PaymentMethod.EFECTIVO, monto: efectivo },
    { metodoPago: PaymentMethod.QR, monto: qr },
  ];
}

function addSalePaymentsToTotals(
  totals: { totalEfectivo: number; totalTransferencia: number; totalQr: number; totalTarjeta: number },
  venta: { total: number; metodoPago: PaymentMethod; pagos?: Array<{ metodoPago: PaymentMethod; monto: number }> },
) {
  const pagos = venta.pagos?.length ? venta.pagos : [{ metodoPago: venta.metodoPago, monto: venta.total }];
  pagos.forEach((pago) => {
    if (pago.metodoPago === 'EFECTIVO') totals.totalEfectivo += pago.monto;
    else if (pago.metodoPago === 'TRANSFERENCIA') totals.totalTransferencia += pago.monto;
    else if (pago.metodoPago === 'QR') totals.totalQr += pago.monto;
    else if (pago.metodoPago === 'TARJETA') totals.totalTarjeta += pago.monto;
  });
}

function resolveSaleStock(producto: ProductWithBranchStock, requestedSucursalId: string) {
  const activeBranches = producto.stockSucursales.filter((stock) => stock.estado === 'ACTIVO' && stock.activo);
  const requestedBranch = activeBranches.find((stock) => stock.sucursalId === requestedSucursalId);
  if (requestedBranch) {
    return { sucursalId: requestedBranch.sucursalId, availableStock: requestedBranch.stock };
  }

  const productBranch = activeBranches.find((stock) => stock.sucursalId === producto.sucursalId);
  if (productBranch) {
    return { sucursalId: productBranch.sucursalId, availableStock: productBranch.stock };
  }

  const branchWithStock = activeBranches.find((stock) => stock.stock > 0) || activeBranches[0];
  if (branchWithStock) {
    return { sucursalId: branchWithStock.sucursalId, availableStock: branchWithStock.stock };
  }

  return { sucursalId: producto.sucursalId, availableStock: producto.stock };
}

const saleVoidRequestInclude = {
  solicitante: { select: { id: true, nombre: true, email: true } },
  administrador: { select: { id: true, nombre: true, email: true } },
} satisfies Prisma.SolicitudAnulacionVentaInclude;

const saleInclude = {
  usuario: { select: { id: true, nombre: true, email: true } },
  sucursal: true,
  cliente: true,
  cuenta: { include: { pagos: true } },
  detalles: { include: { producto: true } },
  pagos: { orderBy: { createdAt: 'asc' as const } },
  solicitudAnulacion: { include: saleVoidRequestInclude },
} satisfies Prisma.VentaInclude;

export class SaleService {
  async updatePaymentMethod(id: string, metodoPago: PaymentMethod, actor: InternalUserScope, pagos?: SalePaymentInput[]) {
    if (metodoPago !== 'EFECTIVO' && metodoPago !== 'QR' && metodoPago !== 'MIXTO') {
      throw Object.assign(new Error('Solo se permite cambiar a EFECTIVO, QR o MIXTO'), { status: 400 });
    }

    const venta = await prisma.venta.findUnique({
      where: { id },
      select: { usuarioId: true, sucursalId: true, total: true, tipoVenta: true, fechaNegocio: true },
    });

    if (!venta) {
      throw Object.assign(new Error('Venta no encontrada'), { status: 404 });
    }

    if (actor.role === 'SELLER' && (venta.usuarioId !== actor.id || venta.sucursalId !== actor.sucursalId)) {
      throw Object.assign(new Error('No puedes cambiar el metodo de pago de una venta de otro vendedor.'), { status: 403 });
    }

    const paymentRows = buildSalePayments(venta.total, venta.tipoVenta, metodoPago, pagos);

    return prisma.$transaction(async (tx) => {
      const cierre = await tx.cierreCaja.findFirst({
        where: {
          fecha: getBusinessDay(venta.fechaNegocio.toISOString()).start,
          usuarioId: venta.usuarioId,
          sucursalId: venta.sucursalId,
        },
      });
      if (cierre && cierre.estado !== CashClosingStatus.OBSERVADO) {
        throw Object.assign(new Error('No se puede modificar el pago porque la caja esta enviada o aprobada.'), { status: 409 });
      }
      await tx.pagoVenta.deleteMany({ where: { ventaId: id } });
      if (paymentRows.length) {
        await tx.pagoVenta.createMany({ data: paymentRows.map((pago) => ({ ...pago, ventaId: id })) });
      }
      return tx.venta.update({
        where: { id },
        data: { metodoPago },
        include: saleInclude,
      });
    });
  }

  async getAll() {
    return prisma.venta.findMany({
      include: saleInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingVoidRequests() {
    return prisma.venta.findMany({
      where: {
        solicitudAnulacion: {
          is: { estado: 'PENDIENTE' },
        },
      },
      include: saleInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateSaleInput) {
    const productIds = data.items.map((item) => item.productoId);
    const uniqueProductIds = Array.from(new Set(productIds));

    const ventaId = await prisma.$transaction(async (tx) => {
      if (data.tipoVenta === 'CREDITO' && !data.clienteId) {
        throw Object.assign(new Error('Selecciona un cliente para venta a credito'), { status: 400 });
      }
      if (data.tipoVenta === 'CREDITO') {
        if (!data.fechaVencimiento) {
          throw Object.assign(new Error('Indica la fecha de pago para venta a credito'), { status: 400 });
        }
        const clienteCredito = await tx.cliente.findUnique({ where: { id: data.clienteId! } });
        if (!clienteCredito?.telefono?.trim()) {
          throw Object.assign(new Error('Registra el celular del cliente para venta a credito'), { status: 400 });
        }
      }

      const today = getBusinessDay();
      const businessDay = getBusinessDay(data.fechaNegocio);
      const isHistoricalCorrection = businessDay.label !== today.label;
      if (!isHistoricalCorrection && !data.cierreCorregidoId) await assertPreviousCashClosed(tx, data.usuarioId, data.sucursalId, today.start);
      let correctionClosing: { id: string } | null = null;

      if (isHistoricalCorrection || data.cierreCorregidoId) {
        if (!data.cierreCorregidoId || !data.motivoCorreccion?.trim()) {
          throw Object.assign(new Error('Selecciona el cierre observado y explica la correccion.'), { status: 400 });
        }
        correctionClosing = await tx.cierreCaja.findFirst({
          where: {
            id: data.cierreCorregidoId,
            fecha: businessDay.start,
            usuarioId: data.usuarioId,
            sucursalId: data.sucursalId,
            estado: CashClosingStatus.OBSERVADO,
          },
          select: { id: true },
        });
        if (!correctionClosing) {
          throw Object.assign(new Error('El cierre seleccionado no esta observado o no pertenece a esta jornada.'), { status: 409 });
        }
      } else {
        const previousObserved = await tx.cierreCaja.findFirst({
          where: {
            usuarioId: data.usuarioId,
            sucursalId: data.sucursalId,
            fecha: { lt: today.start },
            estado: CashClosingStatus.OBSERVADO,
          },
          select: { fecha: true },
        });
        if (previousObserved) {
          throw Object.assign(new Error('Tienes un cierre observado pendiente. Corrigelo antes de registrar ventas de hoy.'), { status: 409 });
        }
      }

      const cierre = await tx.cierreCaja.findFirst({
        where: {
          fecha: businessDay.start,
          ...sellerBusinessDayScope(data.usuarioId, data.sucursalId),
        },
      });
      if (cierre && cierre.estado !== CashClosingStatus.OBSERVADO) {
        throw Object.assign(new Error('La caja de hoy ya fue cerrada. No se pueden registrar mas ventas.'), { status: 409 });
      }
      if (cierre?.estado === CashClosingStatus.OBSERVADO && !correctionClosing) {
        throw Object.assign(new Error('Esta caja esta observada. Registra la venta desde el modo de correccion.'), { status: 409 });
      }

      const productos = await tx.producto.findMany({
        where: { id: { in: uniqueProductIds } },
        include: { stockSucursales: true },
      });

      const productMap = new Map(productos.map((producto) => [producto.id, producto]));
      const saleStockMap = new Map<string, { sucursalId: string; availableStock: number }>();

      for (const item of data.items) {
        const producto = productMap.get(item.productoId);
        if (!producto) {
          throw Object.assign(new Error('Producto no encontrado'), { status: 404 });
        }
        const saleStock = resolveSaleStock(producto, data.sucursalId);
        saleStockMap.set(item.productoId, saleStock);
        if (saleStock.availableStock < item.cantidad) {
          throw Object.assign(
            new Error(`Stock insuficiente para ${producto.descripcion}. Disponible: ${saleStock.availableStock}`),
            { status: 400 }
          );
        }
      }

      const detalles = data.items.map((item) => {
        const producto = productMap.get(item.productoId)!;
        const grossLineTotal = producto.precioVenta * item.cantidad;
        if (item.descuentoItem > grossLineTotal) {
          throw Object.assign(new Error(`El descuento de ${producto.descripcion} no puede superar Bs ${grossLineTotal}.`), { status: 400 });
        }
        const lineSubtotal = grossLineTotal - item.descuentoItem;
        return {
          tipoLinea: 'PRODUCTO' as const,
          productoId: item.productoId,
          descripcion: producto.descripcion,
          unidadVenta: producto.unidadVenta,
          cantidad: item.cantidad,
          precioUnitario: producto.precioVenta,
          costoUnitario: producto.precioCompra,
          subtotal: Math.max(lineSubtotal, 0),
        };
      });

      const subtotal = detalles.reduce((sum, item) => sum + item.subtotal, 0);
      if (data.descuento > subtotal) {
        throw Object.assign(new Error('El descuento no puede superar el subtotal de la venta.'), { status: 400 });
      }
      const total = Math.max(subtotal - data.descuento, 0);
      const pagos = buildSalePayments(total, data.tipoVenta, data.metodoPago, data.pagos);

      const venta = await tx.venta.create({
        data: {
          usuario: { connect: { id: data.usuarioId } },
          sucursal: { connect: { id: data.sucursalId } },
          cliente: data.clienteId ? { connect: { id: data.clienteId } } : undefined,
          metodoPago: data.metodoPago,
          tipoVenta: data.tipoVenta,
          subtotal,
          descuento: data.descuento,
          total,
          fechaNegocio: businessDay.start,
          esCorreccionCierre: Boolean(correctionClosing),
          motivoCorreccion: correctionClosing ? data.motivoCorreccion?.trim() : null,
          cierreCorregido: correctionClosing ? { connect: { id: correctionClosing.id } } : undefined,
          detalles: { create: detalles },
          pagos: pagos.length ? { create: pagos } : undefined,
        },
      });

      for (const item of data.items) {
        const producto = productMap.get(item.productoId)!;
        const saleStock = saleStockMap.get(item.productoId) ?? resolveSaleStock(producto, data.sucursalId);
        const stockAnterior = saleStock.availableStock;
        const stockNuevo = stockAnterior - item.cantidad;
        await tx.productoStockSucursal.upsert({
          where: { productoId_sucursalId: { productoId: item.productoId, sucursalId: saleStock.sucursalId } },
          update: { stock: stockNuevo },
          create: {
            productoId: item.productoId,
            sucursalId: saleStock.sucursalId,
            stock: stockNuevo,
          },
        });
        await tx.producto.update({
          where: { id: item.productoId },
          data: { stock: { decrement: item.cantidad } },
        });
        await tx.movimientoStock.create({
          data: {
            tipoMovimiento: 'VENTA',
            productoId: item.productoId,
            sucursalId: saleStock.sucursalId,
            stockAnterior,
            stockNuevo,
            cantidad: -item.cantidad,
            usuarioId: data.usuarioId,
            referenciaId: venta.id,
            referenciaTipo: 'VENTA',
          },
        });
      }

      if (data.tipoVenta === 'CREDITO' && data.clienteId) {
        await tx.cuentaCobrar.create({
          data: {
            clienteId: data.clienteId,
            ventaId: venta.id,
            sucursalId: data.sucursalId,
            montoTotal: total,
            saldo: total,
            fechaVencimiento: parseDueDate(data.fechaVencimiento),
            estado: 'PENDIENTE',
          },
        });
      }

      return venta.id;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10000,
      timeout: 20000,
    });

    await Promise.all(uniqueProductIds.map((productoId) => stockService.syncLowStockAlert(prisma, productoId)));

    return prisma.venta.findUnique({
      where: { id: ventaId },
      include: saleInclude,
    });
  }

  async getDailySummary(params: DailySummaryInput) {
    const businessDay = getBusinessDay(params.fecha);
    const scopedWhere = params.includeAllSellers
      ? branchBusinessDayScope(params.sucursalId)
      : sellerBusinessDayScope(String(params.usuarioId || ''), params.sucursalId);
    const where: Prisma.VentaWhereInput = {
      ...scopedWhere,
      fechaNegocio: { gte: businessDay.start, lt: businessDay.end },
    };
    const expenseWhere: Prisma.GastoCajaWhereInput = {
      ...scopedWhere,
      fechaNegocio: { gte: businessDay.start, lt: businessDay.end },
    };
    const closingWhere: Prisma.CierreCajaWhereInput = {
      fecha: businessDay.start,
      ...scopedWhere,
    };

    const [ventas, cierre, gastos, pagosCredito] = await Promise.all([
      prisma.venta.findMany({
        where,
        include: saleInclude,
        orderBy: { createdAt: 'desc' },
      }),
      params.includeAllSellers ? Promise.resolve(null) : prisma.cierreCaja.findFirst({ where: closingWhere }),
      prisma.gastoCaja.findMany({
        where: expenseWhere,
        include: {
          usuario: { select: { id: true, nombre: true, email: true } },
          sucursal: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.pagoCredito.findMany({
        where: {
          ...(params.includeAllSellers ? {} : { usuarioId: String(params.usuarioId || '') }),
          fechaNegocio: { gte: businessDay.start, lt: businessDay.end },
          cuenta: { sucursalId: params.sucursalId },
        },
        include: {
          cuenta: { include: { cliente: true, venta: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totals = ventas.reduce((acc, venta) => {
      acc.cantidadVentas += 1;
      acc.totalVentas += venta.total;
      if (venta.tipoVenta === 'CREDITO') acc.totalCredito += venta.total;
      else addSalePaymentsToTotals(acc, venta);
      return acc;
    }, emptyTotals());

    const gastosTotals = gastos.reduce((acc, gasto) => {
      acc.totalGastos += gasto.monto;
      if (gasto.metodoPago === 'EFECTIVO') acc.totalEfectivo += gasto.monto;
      else if (gasto.metodoPago === 'QR') acc.totalQr += gasto.monto;
      return acc;
    }, emptyExpenseTotals());

    const cobrosCreditoTotals = pagosCredito.reduce((acc, pago) => {
      acc.totalCobrosCredito += pago.monto;
      if (pago.metodoPago === 'EFECTIVO') acc.totalEfectivo += pago.monto;
      else if (pago.metodoPago === 'TRANSFERENCIA') acc.totalTransferencia += pago.monto;
      else if (pago.metodoPago === 'QR') acc.totalQr += pago.monto;
      else if (pago.metodoPago === 'TARJETA') acc.totalTarjeta += pago.monto;
      return acc;
    }, emptyCreditPaymentTotals());

    return {
      fecha: businessDay.label,
      desde: businessDay.start,
      hasta: businessDay.end,
      cerrado: Boolean(cierre && cierre.estado !== CashClosingStatus.OBSERVADO),
      estadoCaja: cierre?.estado || 'ABIERTA',
      cierre,
      totals,
      gastos: {
        totals: gastosTotals,
        items: gastos,
      },
      cobrosCredito: {
        totals: cobrosCreditoTotals,
        items: pagosCredito,
      },
      netos: getNetTotals(totals, gastosTotals, cobrosCreditoTotals),
      ventas,
    };
  }

  async getPendingCashClosings(params: { usuarioId: string; sucursalId: string }) {
    const today = getBusinessDay();
    const scope = sellerBusinessDayScope(params.usuarioId, params.sucursalId);
    const [ventas, gastos, pagosCredito, cierres] = await Promise.all([
      prisma.venta.findMany({
        where: {
          ...scope,
          fechaNegocio: { lt: today.start },
        },
        select: { fechaNegocio: true, total: true },
      }),
      prisma.gastoCaja.findMany({
        where: {
          ...scope,
          fechaNegocio: { lt: today.start },
        },
        select: { fechaNegocio: true, monto: true },
      }),
      prisma.pagoCredito.findMany({
        where: {
          usuarioId: params.usuarioId,
          fechaNegocio: { lt: today.start },
          cuenta: { sucursalId: params.sucursalId },
        },
        select: { fechaNegocio: true, monto: true },
      }),
      prisma.cierreCaja.findMany({
        where: {
          AND: [
            scope,
            {
              OR: [
                { fecha: { lt: today.start } },
                { estado: CashClosingStatus.OBSERVADO },
              ],
            },
          ],
        },
        select: {
          id: true,
          fecha: true,
          estado: true,
          diferencia: true,
          motivoObservacion: true,
          version: true,
          cantidadVentas: true,
          totalVentas: true,
          totalGastos: true,
        },
      }),
    ]);

    const closingsByDay = new Map(cierres.map((cierre) => [getBusinessDayLabel(cierre.fecha), cierre]));
    const pendingByDay = new Map<string, {
      fecha: string;
      cantidadVentas: number;
      totalVentas: number;
      totalGastos: number;
      cierreId?: string;
      estado: 'SIN_ENVIAR' | CashClosingStatus;
      diferencia?: number;
      motivoObservacion?: string | null;
      version?: number;
    }>();

    cierres
      .filter((cierre) => cierre.estado !== CashClosingStatus.APROBADO)
      .forEach((cierre) => {
        const fecha = getBusinessDayLabel(cierre.fecha);
        const isCurrentDay = cierre.fecha >= today.start;
        pendingByDay.set(fecha, {
          fecha,
          cantidadVentas: isCurrentDay ? cierre.cantidadVentas : 0,
          totalVentas: isCurrentDay ? cierre.totalVentas : 0,
          totalGastos: isCurrentDay ? cierre.totalGastos : 0,
          cierreId: cierre.id,
          estado: cierre.estado,
          diferencia: cierre.diferencia,
          motivoObservacion: cierre.motivoObservacion,
          version: cierre.version,
        });
      });

    ventas.forEach((venta) => {
      const fecha = getBusinessDayLabel(venta.fechaNegocio);
      if (closingsByDay.get(fecha)?.estado === CashClosingStatus.APROBADO) return;
      const current = pendingByDay.get(fecha) || { fecha, cantidadVentas: 0, totalVentas: 0, totalGastos: 0, estado: 'SIN_ENVIAR' as const };
      current.cantidadVentas += 1;
      current.totalVentas += venta.total;
      pendingByDay.set(fecha, current);
    });

    gastos.forEach((gasto) => {
      const fecha = getBusinessDayLabel(gasto.fechaNegocio);
      if (closingsByDay.get(fecha)?.estado === CashClosingStatus.APROBADO) return;
      const current = pendingByDay.get(fecha) || { fecha, cantidadVentas: 0, totalVentas: 0, totalGastos: 0, estado: 'SIN_ENVIAR' as const };
      current.totalGastos += gasto.monto;
      pendingByDay.set(fecha, current);
    });
    pagosCredito.forEach((pago) => {
      const fecha = getBusinessDayLabel(pago.fechaNegocio);
      if (closingsByDay.get(fecha)?.estado === CashClosingStatus.APROBADO) return;
      const current = pendingByDay.get(fecha) || { fecha, cantidadVentas: 0, totalVentas: 0, totalGastos: 0, estado: 'SIN_ENVIAR' as const };
      pendingByDay.set(fecha, current);
    });

    return Array.from(pendingByDay.values()).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  async createCashExpense(data: CreateCashExpenseInput) {
    const today = getBusinessDay();
    const businessDay = getBusinessDay(data.fecha);
    const isHistoricalCorrection = businessDay.label !== today.label;
    if (!isHistoricalCorrection) await assertPreviousCashClosed(prisma, data.usuarioId, data.sucursalId, today.start);
    const [cierre, previousObserved] = await Promise.all([
      prisma.cierreCaja.findFirst({
        where: {
          fecha: businessDay.start,
          ...sellerBusinessDayScope(data.usuarioId, data.sucursalId),
        },
      }),
      prisma.cierreCaja.findFirst({
        where: {
          usuarioId: data.usuarioId,
          sucursalId: data.sucursalId,
          fecha: { lt: today.start },
          estado: CashClosingStatus.OBSERVADO,
        },
        select: { id: true },
      }),
    ]);

    if (isHistoricalCorrection && cierre?.estado !== CashClosingStatus.OBSERVADO) {
      throw Object.assign(new Error('Solo se pueden agregar gastos historicos a un cierre observado por el administrador.'), { status: 409 });
    }

    if (!isHistoricalCorrection && previousObserved) {
      throw Object.assign(new Error('Tienes un cierre observado pendiente. Corrigelo antes de registrar gastos de hoy.'), { status: 409 });
    }

    if (cierre && cierre.estado !== CashClosingStatus.OBSERVADO) {
      throw Object.assign(new Error('La caja de ese dia ya fue cerrada. No se pueden registrar mas gastos.'), { status: 409 });
    }

    return prisma.gastoCaja.create({
      data: {
        usuarioId: data.usuarioId,
        sucursalId: data.sucursalId,
        motivo: data.motivo,
        monto: data.monto,
        metodoPago: data.metodoPago,
        notas: data.notas || null,
        fechaNegocio: businessDay.start,
      },
      include: {
        usuario: { select: { id: true, nombre: true, email: true } },
        sucursal: true,
      },
    });
  }

  async deleteCashExpense(
    id: string,
    scope?: { usuarioId?: string | null; sucursalId?: string | null; role?: string | null },
  ) {
    return prisma.$transaction(async (tx) => {
      const gasto = await tx.gastoCaja.findUnique({ where: { id } });
      if (!gasto) throw Object.assign(new Error('Gasto no encontrado'), { status: 404 });

      if (
        scope?.role === 'SELLER' &&
        (gasto.usuarioId !== scope.usuarioId || gasto.sucursalId !== scope.sucursalId)
      ) {
        throw Object.assign(new Error('No puedes anular gastos de otro vendedor.'), { status: 403 });
      }

      const businessDay = getBusinessDay(gasto.fechaNegocio.toISOString());
      const cierre = await tx.cierreCaja.findFirst({
        where: {
          fecha: businessDay.start,
          ...sellerBusinessDayScope(gasto.usuarioId, gasto.sucursalId),
        },
      });

      if (cierre && cierre.estado !== CashClosingStatus.OBSERVADO) {
        throw Object.assign(new Error('No se puede anular el gasto porque la caja de ese dia ya fue cerrada.'), { status: 409 });
      }

      await tx.gastoCaja.delete({ where: { id } });
      return { success: true };
    });
  }

  async requestSaleVoid(id: string, motivo: string, user: InternalUserScope) {
    return prisma.$transaction(async (tx) => {
      const venta = await tx.venta.findUnique({
        where: { id },
        include: {
          solicitudAnulacion: true,
        },
      });
      if (!venta) throw Object.assign(new Error('Venta no encontrada'), { status: 404 });
      if (!user.id) throw Object.assign(new Error('Sesion requerida'), { status: 401 });

      if (user.role === 'SELLER' && (venta.usuarioId !== user.id || venta.sucursalId !== user.sucursalId)) {
        throw Object.assign(new Error('No puedes solicitar anulacion de una venta de otro vendedor.'), { status: 403 });
      }

      const businessDay = getBusinessDay(venta.fechaNegocio.toISOString());
      const cierre = await tx.cierreCaja.findFirst({
        where: {
          fecha: businessDay.start,
          ...sellerBusinessDayScope(venta.usuarioId, venta.sucursalId),
        },
      });
      if (cierre && cierre.estado !== CashClosingStatus.OBSERVADO) {
        throw Object.assign(new Error('No se puede solicitar anulacion porque la caja de ese dia ya fue cerrada.'), { status: 409 });
      }

      if (venta.solicitudAnulacion?.estado === 'PENDIENTE') {
        throw Object.assign(new Error('Esta venta ya tiene una solicitud de anulacion pendiente.'), { status: 409 });
      }

      return tx.solicitudAnulacionVenta.create({
        data: {
          ventaId: id,
          solicitanteId: user.id,
          motivo,
        },
        include: saleVoidRequestInclude,
      });
    });
  }

  async approveSaleVoidRequest(requestId: string, adminId: string) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.solicitudAnulacionVenta.findUnique({
        where: { id: requestId },
        include: { venta: true },
      });
      if (!request) throw Object.assign(new Error('Solicitud de anulacion no encontrada'), { status: 404 });
      if (request.estado !== 'PENDIENTE') {
        throw Object.assign(new Error('La solicitud ya fue procesada'), { status: 409 });
      }

      await tx.solicitudAnulacionVenta.update({
        where: { id: requestId },
        data: {
          estado: 'APROBADA',
          administradorId: adminId,
          approvedAt: new Date(),
        },
      });

      return this.deleteSaleWithTransaction(tx, request.ventaId, request.motivo, adminId);
    });
  }

  async deleteSale(id: string, motivo: string = 'Anulación de venta', actorId?: string | null) {
    return prisma.$transaction((tx) => this.deleteSaleWithTransaction(tx, id, motivo, actorId));
  }

  private async deleteSaleWithTransaction(tx: Prisma.TransactionClient, id: string, motivo: string, actorId?: string | null) {
    const venta = await tx.venta.findUnique({
      where: { id },
      include: { detalles: true, remachadoTrabajos: true }
    });
    if (!venta) throw Object.assign(new Error('Venta no encontrada'), { status: 404 });

    const businessDay = getBusinessDay(venta.fechaNegocio.toISOString());
    const cierre = await tx.cierreCaja.findFirst({
      where: {
        fecha: businessDay.start,
        ...sellerBusinessDayScope(venta.usuarioId, venta.sucursalId),
      }
    });
    if (cierre && cierre.estado !== CashClosingStatus.OBSERVADO) {
      throw Object.assign(new Error('No se puede anular la venta porque la caja de ese dia ya fue cerrada.'), { status: 409 });
    }

    for (const detalle of venta.detalles) {
      if (detalle.tipoLinea === 'PRODUCTO' && detalle.productoId) {
        const producto = await tx.producto.findUnique({
          where: { id: detalle.productoId },
          include: { stockSucursales: true }
        });

        if (producto) {
          const movimiento = await tx.movimientoStock.findFirst({
            where: {
              referenciaId: venta.id,
              referenciaTipo: 'VENTA',
              productoId: detalle.productoId
            }
          });

          const sucursalIdTarget = movimiento ? movimiento.sucursalId : venta.sucursalId;
          const targetStock = producto.stockSucursales.find(s => s.sucursalId === sucursalIdTarget);
          
          if (targetStock) {
            const stockAnterior = targetStock.stock;
            const stockNuevo = stockAnterior + detalle.cantidad;

            await tx.productoStockSucursal.update({
              where: { productoId_sucursalId: { productoId: detalle.productoId, sucursalId: sucursalIdTarget } },
              data: { stock: stockNuevo }
            });

            await tx.producto.update({
              where: { id: detalle.productoId },
              data: { stock: { increment: detalle.cantidad } }
            });

            await tx.movimientoStock.create({
              data: {
                tipoMovimiento: 'AJUSTE',
                productoId: detalle.productoId,
                sucursalId: sucursalIdTarget,
                stockAnterior,
                stockNuevo,
                cantidad: detalle.cantidad,
                usuarioId: actorId || venta.usuarioId,
                referenciaId: venta.id,
                referenciaTipo: 'ANULACION',
                notas: `Venta anulada - Motivo: ${motivo}`
              }
            });
          }
        }
      }
    }

    for (const trabajo of venta.remachadoTrabajos) {
      const medida = await tx.remachadoMedida.findUnique({ where: { id: trabajo.medidaId } });
      if (medida) {
        const stockNuevo = medida.stockJuegos + trabajo.cantidadJuegos;
        await tx.remachadoMedida.update({
          where: { id: trabajo.medidaId },
          data: { stockJuegos: stockNuevo }
        });
        await tx.remachadoMovimiento.create({
          data: {
            tipo: 'AJUSTE',
            medidaId: trabajo.medidaId,
            usuarioId: actorId || venta.usuarioId,
            stockAnterior: medida.stockJuegos,
            stockNuevo,
            cantidad: trabajo.cantidadJuegos,
            notas: `Venta anulada - Motivo: ${motivo}`
          }
        });
      }

      if (trabajo.remacheId) {
        const remache = await tx.remachadoRemache.findUnique({ where: { id: trabajo.remacheId } });
        if (remache) {
          const stockNuevo = remache.stock + trabajo.cantidadRemaches;
          await tx.remachadoRemache.update({
            where: { id: trabajo.remacheId },
            data: { stock: stockNuevo }
          });
          await tx.remachadoMovimiento.create({
            data: {
              tipo: 'AJUSTE',
              remacheId: trabajo.remacheId,
              usuarioId: actorId || venta.usuarioId,
              stockAnterior: remache.stock,
              stockNuevo,
              cantidad: trabajo.cantidadRemaches,
              notas: `Venta anulada - Motivo: ${motivo}`
            }
          });
        }
      }
    }

    await tx.remachadoMovimiento.updateMany({
      where: { trabajo: { ventaId: id } },
      data: { trabajoId: null }
    });
    await tx.remachadoTrabajo.deleteMany({
      where: { ventaId: id }
    });
    await tx.venta.delete({
      where: { id }
    });

    return { success: true };
  }

  async closeCashRegister(data: CloseCashRegisterInput) {
    const summary = await this.getDailySummary(data);
    if (summary.cierre && summary.cierre.estado !== CashClosingStatus.OBSERVADO) {
      throw Object.assign(new Error('La caja ya fue enviada o aprobada'), { status: 409 });
    }

    const diferencia = data.montoDeclarado - summary.netos.totalEfectivo;
    const snapshot = {
      totals: summary.totals,
      cobrosCredito: summary.cobrosCredito.totals,
      gastos: summary.gastos.totals,
      netos: summary.netos,
    } as Prisma.InputJsonValue;
    const closingData = {
        fecha: new Date(summary.desde),
        usuarioId: data.usuarioId,
        sucursalId: data.sucursalId,
        cantidadVentas: summary.totals.cantidadVentas,
        totalVentas: summary.totals.totalVentas,
        totalEfectivo: summary.totals.totalEfectivo,
        totalTransferencia: summary.totals.totalTransferencia,
        totalQr: summary.totals.totalQr,
        totalTarjeta: summary.totals.totalTarjeta,
        totalCredito: summary.totals.totalCredito,
        totalCobrosCredito: summary.cobrosCredito.totals.totalCobrosCredito,
        cobroCreditoEfectivo: summary.cobrosCredito.totals.totalEfectivo,
        cobroCreditoTransferencia: summary.cobrosCredito.totals.totalTransferencia,
        cobroCreditoQr: summary.cobrosCredito.totals.totalQr,
        cobroCreditoTarjeta: summary.cobrosCredito.totals.totalTarjeta,
        gastoEfectivo: summary.gastos.totals.totalEfectivo,
        gastoQr: summary.gastos.totals.totalQr,
        totalGastos: summary.gastos.totals.totalGastos,
        netoEfectivo: summary.netos.totalEfectivo,
        netoQr: summary.netos.totalQr,
        montoDeclarado: data.montoDeclarado,
        diferencia,
        notas: data.notas || null,
        estado: CashClosingStatus.PENDIENTE,
        motivoObservacion: null,
        notaAdministrador: null,
        administradorId: null,
        revisadoAt: null,
        enviadoAt: new Date(),
        depositadoBanco: Boolean(data.depositadoBanco),
        montoDepositado: data.depositadoBanco ? data.montoDepositado : null,
        fechaDeposito: data.depositadoBanco ? new Date() : null,
        referenciaDeposito: data.depositadoBanco ? data.referenciaDeposito?.trim() || null : null,
      } satisfies Prisma.CierreCajaUncheckedCreateInput;

    return prisma.$transaction(async (tx) => {
      const previous = await tx.cierreCaja.findUnique({
        where: {
          fecha_usuarioId_sucursalId: {
            fecha: new Date(summary.desde),
            usuarioId: data.usuarioId,
            sucursalId: data.sucursalId,
          },
        },
      });
      if (previous && previous.estado !== CashClosingStatus.OBSERVADO) {
        throw Object.assign(new Error('La caja ya fue enviada o aprobada'), { status: 409 });
      }

      let closing;
      if (previous) {
        const transition = await tx.cierreCaja.updateMany({
          where: { id: previous.id, estado: CashClosingStatus.OBSERVADO },
          data: { ...closingData, version: { increment: 1 } },
        });
        if (transition.count !== 1) {
          throw Object.assign(new Error('El cierre ya fue reenviado o procesado en otra sesion'), { status: 409 });
        }
        closing = await tx.cierreCaja.findUniqueOrThrow({ where: { id: previous.id } });
      } else {
        closing = await tx.cierreCaja.create({ data: closingData });
      }

      await tx.historialCierreCaja.create({
        data: {
          cierreId: closing.id,
          accion: previous ? CashClosingAction.REENVIADO : CashClosingAction.ENVIADO,
          actorId: data.usuarioId,
          comentario: data.notas || null,
          montoDeclarado: data.montoDeclarado,
          efectivoEsperado: summary.netos.totalEfectivo,
          diferencia,
          version: closing.version,
          snapshot,
        },
      });

      return tx.cierreCaja.findUnique({
        where: { id: closing.id },
        include: {
          usuario: { select: { id: true, nombre: true, email: true } },
          sucursal: true,
          administrador: { select: { id: true, nombre: true, email: true } },
          historial: { include: { actor: { select: { id: true, nombre: true } } }, orderBy: { createdAt: 'asc' } },
        },
      });
    });
  }

  async getCashClosingsForReview(month?: string) {
    let dateFilter: Prisma.DateTimeFilter | undefined;
    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        throw Object.assign(new Error('Mes de cierres invalido'), { status: 400 });
      }
      const [year, monthNumber] = month.split('-').map(Number);
      if (monthNumber < 1 || monthNumber > 12) {
        throw Object.assign(new Error('Mes de cierres invalido'), { status: 400 });
      }
      dateFilter = {
        gte: new Date(Date.UTC(year, monthNumber - 1, 1, BOLIVIA_UTC_OFFSET_HOURS)),
        lt: new Date(Date.UTC(year, monthNumber, 1, BOLIVIA_UTC_OFFSET_HOURS)),
      };
    }

    return prisma.cierreCaja.findMany({
      where: month
        ? { fecha: dateFilter }
        : { estado: { in: [CashClosingStatus.PENDIENTE, CashClosingStatus.OBSERVADO] } },
      include: {
        usuario: { select: { id: true, nombre: true, email: true } },
        sucursal: true,
        administrador: { select: { id: true, nombre: true, email: true } },
        historial: {
          include: { actor: { select: { id: true, nombre: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ fecha: 'desc' }, { estado: 'asc' }],
    });
  }

  async approveCashClosing(data: ReviewCashClosingInput) {
    return prisma.$transaction(async (tx) => {
      const closing = await tx.cierreCaja.findUnique({ where: { id: data.cierreId } });
      if (!closing) throw Object.assign(new Error('Cierre de caja no encontrado'), { status: 404 });
      const transition = await tx.cierreCaja.updateMany({
        where: { id: closing.id, estado: CashClosingStatus.PENDIENTE },
        data: {
          estado: CashClosingStatus.APROBADO,
          administradorId: data.administradorId,
          notaAdministrador: data.comentario.trim(),
          motivoObservacion: null,
          revisadoAt: new Date(),
        },
      });
      if (transition.count !== 1) {
        throw Object.assign(new Error('El cierre ya fue procesado por otro administrador'), { status: 409 });
      }
      await tx.historialCierreCaja.create({
        data: {
          cierreId: closing.id,
          accion: CashClosingAction.APROBADO,
          actorId: data.administradorId,
          comentario: data.comentario.trim(),
          montoDeclarado: closing.montoDeclarado,
          efectivoEsperado: closing.netoEfectivo,
          diferencia: closing.diferencia,
          version: closing.version,
        },
      });
      return tx.cierreCaja.findUniqueOrThrow({ where: { id: closing.id } });
    });
  }

  async observeCashClosing(data: ReviewCashClosingInput) {
    return prisma.$transaction(async (tx) => {
      const closing = await tx.cierreCaja.findUnique({ where: { id: data.cierreId } });
      if (!closing) throw Object.assign(new Error('Cierre de caja no encontrado'), { status: 404 });
      const transition = await tx.cierreCaja.updateMany({
        where: {
          id: closing.id,
          estado: { in: [CashClosingStatus.PENDIENTE, CashClosingStatus.APROBADO] },
        },
        data: {
          estado: CashClosingStatus.OBSERVADO,
          administradorId: data.administradorId,
          motivoObservacion: data.comentario.trim(),
          notaAdministrador: null,
          revisadoAt: new Date(),
        },
      });
      if (transition.count !== 1) {
        throw Object.assign(new Error('El cierre ya fue observado o procesado por otro administrador'), { status: 409 });
      }
      await tx.historialCierreCaja.create({
        data: {
          cierreId: closing.id,
          accion: CashClosingAction.OBSERVADO,
          actorId: data.administradorId,
          comentario: data.comentario.trim(),
          montoDeclarado: closing.montoDeclarado,
          efectivoEsperado: closing.netoEfectivo,
          diferencia: closing.diferencia,
          version: closing.version,
        },
      });
      return tx.cierreCaja.findUniqueOrThrow({ where: { id: closing.id } });
    });
  }
}
