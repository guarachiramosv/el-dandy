import { PaymentMethod, Prisma, SaleType } from '@prisma/client';
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
  items: SaleItemInput[];
};

type CloseCashRegisterInput = {
  usuarioId: string;
  sucursalId: string;
  fecha?: string | null;
  montoDeclarado: number;
  notas?: string | null;
};

type CreateCashExpenseInput = {
  usuarioId: string;
  sucursalId: string;
  motivo: string;
  monto: number;
  metodoPago: 'EFECTIVO' | 'QR';
  notas?: string | null;
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

function sellerBusinessDayScope(usuarioId: string, sucursalId: string) {
  return {
    usuarioId,
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

function getNetTotals(
  totals: ReturnType<typeof emptyTotals>,
  gastos: ReturnType<typeof emptyExpenseTotals>
) {
  const netoEfectivo = Math.max(totals.totalEfectivo - gastos.totalEfectivo, 0);
  const netoQr = Math.max(totals.totalQr - gastos.totalQr, 0);
  return {
    totalEfectivo: netoEfectivo,
    totalQr: netoQr,
    totalDisponible:
      netoEfectivo +
      totals.totalTransferencia +
      netoQr +
      totals.totalTarjeta,
  };
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

export class SaleService {
  async updatePaymentMethod(id: string, metodoPago: PaymentMethod) {
    if (metodoPago !== 'EFECTIVO' && metodoPago !== 'QR') {
      throw Object.assign(new Error('Solo se permite cambiar a EFECTIVO o QR'), { status: 400 });
    }
    
    return prisma.venta.update({
      where: { id },
      data: { metodoPago }
    });
  }

  async getAll() {
    return prisma.venta.findMany({
      include: {
        usuario: { select: { id: true, nombre: true, email: true } },
        sucursal: true,
        cliente: true,
        cuenta: { include: { pagos: true } },
        detalles: { include: { producto: true } },
      },
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

      const businessDay = getBusinessDay();
      const cierre = await tx.cierreCaja.findFirst({
        where: {
          fecha: businessDay.start,
          ...sellerBusinessDayScope(data.usuarioId, data.sucursalId),
        },
      });
      if (cierre) {
        throw Object.assign(new Error('La caja de hoy ya fue cerrada. No se pueden registrar mas ventas.'), { status: 409 });
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
        const lineSubtotal = producto.precioVenta * item.cantidad - item.descuentoItem;
        return {
          tipoLinea: 'PRODUCTO' as const,
          productoId: item.productoId,
          descripcion: producto.descripcion,
          unidadVenta: producto.unidadVenta,
          cantidad: item.cantidad,
          precioUnitario: producto.precioVenta,
          subtotal: Math.max(lineSubtotal, 0),
        };
      });

      const subtotal = detalles.reduce((sum, item) => sum + item.subtotal, 0);
      const total = Math.max(subtotal - data.descuento, 0);

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
          detalles: { create: detalles },
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
            fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
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
      include: {
        usuario: { select: { id: true, nombre: true, email: true } },
        sucursal: true,
        cliente: true,
        cuenta: { include: { pagos: true } },
        detalles: { include: { producto: true } },
      },
    });
  }

  async getDailySummary(params: { usuarioId: string; sucursalId: string; fecha?: string | null }) {
    const businessDay = getBusinessDay(params.fecha);
    const where: Prisma.VentaWhereInput = {
      ...sellerBusinessDayScope(params.usuarioId, params.sucursalId),
      createdAt: { gte: businessDay.start, lt: businessDay.end },
    };
    const expenseWhere: Prisma.GastoCajaWhereInput = {
      ...sellerBusinessDayScope(params.usuarioId, params.sucursalId),
      createdAt: { gte: businessDay.start, lt: businessDay.end },
    };
    const closingWhere: Prisma.CierreCajaWhereInput = {
      fecha: businessDay.start,
      ...sellerBusinessDayScope(params.usuarioId, params.sucursalId),
    };

    const [ventas, cierre, gastos] = await Promise.all([
      prisma.venta.findMany({
        where,
        include: {
          usuario: { select: { id: true, nombre: true, email: true } },
          sucursal: true,
          cliente: true,
          cuenta: { include: { pagos: true } },
          detalles: { include: { producto: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.cierreCaja.findFirst({ where: closingWhere }),
      prisma.gastoCaja.findMany({
        where: expenseWhere,
        include: {
          usuario: { select: { id: true, nombre: true, email: true } },
          sucursal: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totals = ventas.reduce((acc, venta) => {
      acc.cantidadVentas += 1;
      acc.totalVentas += venta.total;
      if (venta.tipoVenta === 'CREDITO') acc.totalCredito += venta.total;
      else if (venta.metodoPago === 'EFECTIVO') acc.totalEfectivo += venta.total;
      else if (venta.metodoPago === 'TRANSFERENCIA') acc.totalTransferencia += venta.total;
      else if (venta.metodoPago === 'QR') acc.totalQr += venta.total;
      else if (venta.metodoPago === 'TARJETA') acc.totalTarjeta += venta.total;
      return acc;
    }, emptyTotals());

    const gastosTotals = gastos.reduce((acc, gasto) => {
      acc.totalGastos += gasto.monto;
      if (gasto.metodoPago === 'EFECTIVO') acc.totalEfectivo += gasto.monto;
      else if (gasto.metodoPago === 'QR') acc.totalQr += gasto.monto;
      return acc;
    }, emptyExpenseTotals());

    return {
      fecha: businessDay.label,
      desde: businessDay.start,
      hasta: businessDay.end,
      cerrado: Boolean(cierre),
      cierre,
      totals,
      gastos: {
        totals: gastosTotals,
        items: gastos,
      },
      netos: getNetTotals(totals, gastosTotals),
      ventas,
    };
  }

  async getPendingCashClosings(params: { usuarioId: string; sucursalId: string }) {
    const today = getBusinessDay();
    const scope = sellerBusinessDayScope(params.usuarioId, params.sucursalId);
    const [ventas, gastos, cierres] = await Promise.all([
      prisma.venta.findMany({
        where: {
          ...scope,
          createdAt: { lt: today.start },
        },
        select: { createdAt: true, total: true },
      }),
      prisma.gastoCaja.findMany({
        where: {
          ...scope,
          createdAt: { lt: today.start },
        },
        select: { createdAt: true, monto: true },
      }),
      prisma.cierreCaja.findMany({
        where: {
          ...scope,
          fecha: { lt: today.start },
        },
        select: { fecha: true },
      }),
    ]);

    const closedDays = new Set(cierres.map((cierre) => getBusinessDayLabel(cierre.fecha)));
    const pendingByDay = new Map<string, {
      fecha: string;
      cantidadVentas: number;
      totalVentas: number;
      totalGastos: number;
    }>();

    ventas.forEach((venta) => {
      const fecha = getBusinessDayLabel(venta.createdAt);
      if (closedDays.has(fecha)) return;
      const current = pendingByDay.get(fecha) || { fecha, cantidadVentas: 0, totalVentas: 0, totalGastos: 0 };
      current.cantidadVentas += 1;
      current.totalVentas += venta.total;
      pendingByDay.set(fecha, current);
    });

    gastos.forEach((gasto) => {
      const fecha = getBusinessDayLabel(gasto.createdAt);
      if (closedDays.has(fecha)) return;
      const current = pendingByDay.get(fecha) || { fecha, cantidadVentas: 0, totalVentas: 0, totalGastos: 0 };
      current.totalGastos += gasto.monto;
      pendingByDay.set(fecha, current);
    });

    return Array.from(pendingByDay.values()).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  async createCashExpense(data: CreateCashExpenseInput) {
    const businessDay = getBusinessDay();
    const cierre = await prisma.cierreCaja.findFirst({
      where: {
        fecha: businessDay.start,
        ...sellerBusinessDayScope(data.usuarioId, data.sucursalId),
      },
    });

    if (cierre) {
      throw Object.assign(new Error('La caja de hoy ya fue cerrada. No se pueden registrar mas gastos.'), { status: 409 });
    }

    return prisma.gastoCaja.create({
      data: {
        usuarioId: data.usuarioId,
        sucursalId: data.sucursalId,
        motivo: data.motivo,
        monto: data.monto,
        metodoPago: data.metodoPago,
        notas: data.notas || null,
      },
      include: {
        usuario: { select: { id: true, nombre: true, email: true } },
        sucursal: true,
      },
    });
  }

  async closeCashRegister(data: CloseCashRegisterInput) {
    const summary = await this.getDailySummary(data);
    if (summary.cierre) {
      throw Object.assign(new Error('La caja de hoy ya fue cerrada'), { status: 409 });
    }

    const diferencia = data.montoDeclarado - summary.netos.totalEfectivo;
    return prisma.cierreCaja.create({
      data: {
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
        gastoEfectivo: summary.gastos.totals.totalEfectivo,
        gastoQr: summary.gastos.totals.totalQr,
        totalGastos: summary.gastos.totals.totalGastos,
        netoEfectivo: summary.netos.totalEfectivo,
        netoQr: summary.netos.totalQr,
        montoDeclarado: data.montoDeclarado,
        diferencia,
        notas: data.notas,
      },
      include: {
        usuario: { select: { id: true, nombre: true, email: true } },
        sucursal: true,
      },
    });
  }
}
