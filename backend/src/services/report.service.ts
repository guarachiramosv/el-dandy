import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export type ReportPeriod = 'day' | 'month' | 'year';

const BOLIVIA_UTC_OFFSET_HOURS = 4;

function parsePeriod(period: ReportPeriod, value?: string | null) {
  const now = new Date();
  const fallbackYear = now.getFullYear();
  const fallbackMonth = now.getMonth() + 1;
  const fallbackDay = now.getDate();

  let year = fallbackYear;
  let month = fallbackMonth;
  let day = fallbackDay;

  if (value) {
    const parts = value.split('-').map(Number);
    if (period === 'year') {
      year = parts[0];
    } else if (period === 'month') {
      year = parts[0];
      month = parts[1];
    } else {
      year = parts[0];
      month = parts[1];
      day = parts[2];
    }
  }

  if (!Number.isFinite(year) || year < 2000) throw Object.assign(new Error('Anio invalido'), { status: 400 });
  if ((period === 'day' || period === 'month') && (!Number.isFinite(month) || month < 1 || month > 12)) {
    throw Object.assign(new Error('Mes invalido'), { status: 400 });
  }
  if (period === 'day' && (!Number.isFinite(day) || day < 1 || day > 31)) {
    throw Object.assign(new Error('Dia invalido'), { status: 400 });
  }

  const start =
    period === 'year'
      ? new Date(Date.UTC(year, 0, 1, BOLIVIA_UTC_OFFSET_HOURS, 0, 0, 0))
      : period === 'month'
        ? new Date(Date.UTC(year, month - 1, 1, BOLIVIA_UTC_OFFSET_HOURS, 0, 0, 0))
        : new Date(Date.UTC(year, month - 1, day, BOLIVIA_UTC_OFFSET_HOURS, 0, 0, 0));

  const end =
    period === 'year'
      ? new Date(Date.UTC(year + 1, 0, 1, BOLIVIA_UTC_OFFSET_HOURS, 0, 0, 0))
      : period === 'month'
        ? new Date(Date.UTC(year, month, 1, BOLIVIA_UTC_OFFSET_HOURS, 0, 0, 0))
        : new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const label =
    period === 'year'
      ? String(year)
      : period === 'month'
        ? `${year}-${String(month).padStart(2, '0')}`
        : `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return { start, end, label };
}

function emptyClosingTotals() {
  return {
    cantidadCierres: 0,
    cantidadVentas: 0,
    totalVentas: 0,
    totalEfectivo: 0,
    totalTransferencia: 0,
    totalQr: 0,
    totalTarjeta: 0,
    totalCredito: 0,
    gastoEfectivo: 0,
    gastoQr: 0,
    totalGastos: 0,
    netoEfectivo: 0,
    netoQr: 0,
    montoDeclarado: 0,
    diferencia: 0,
  };
}

function emptySalesTotals() {
  return {
    cantidadVentas: 0,
    cantidadItems: 0,
    unidadesVendidas: 0,
    subtotal: 0,
    descuento: 0,
    totalVentas: 0,
    totalEfectivo: 0,
    totalTransferencia: 0,
    totalQr: 0,
    totalTarjeta: 0,
    totalCredito: 0,
    gastoEfectivo: 0,
    gastoQr: 0,
    totalGastos: 0,
    netoEfectivo: 0,
    netoQr: 0,
    totalDisponible: 0,
  };
}

export class ReportService {
  async getSalesHistoryReport(params: {
    period: ReportPeriod;
    value?: string | null;
    sucursalId?: string | null;
  }) {
    const range = parsePeriod(params.period, params.value);
    const where: Prisma.VentaWhereInput = {
      createdAt: { gte: range.start, lt: range.end },
    };
    const gastosWhere: Prisma.GastoCajaWhereInput = {
      createdAt: { gte: range.start, lt: range.end },
    };
    if (params.sucursalId) where.sucursalId = params.sucursalId;
    if (params.sucursalId) gastosWhere.sucursalId = params.sucursalId;

    const [ventas, gastos] = await Promise.all([
      prisma.venta.findMany({
        where,
        include: {
          usuario: { select: { id: true, nombre: true, email: true } },
          sucursal: true,
          cliente: true,
          detalles: {
            include: {
              producto: { include: { categoria: true, sucursal: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.gastoCaja.findMany({
        where: gastosWhere,
        include: {
          usuario: { select: { id: true, nombre: true, email: true } },
          sucursal: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const totals = ventas.reduce((acc, venta) => {
      acc.cantidadVentas += 1;
      acc.subtotal += venta.subtotal;
      acc.descuento += venta.descuento;
      acc.totalVentas += venta.total;
      if (venta.tipoVenta === 'CREDITO') acc.totalCredito += venta.total;
      else if (venta.metodoPago === 'EFECTIVO') acc.totalEfectivo += venta.total;
      else if (venta.metodoPago === 'TRANSFERENCIA') acc.totalTransferencia += venta.total;
      else if (venta.metodoPago === 'QR') acc.totalQr += venta.total;
      else if (venta.metodoPago === 'TARJETA') acc.totalTarjeta += venta.total;

      venta.detalles.forEach((detalle) => {
        acc.cantidadItems += 1;
        acc.unidadesVendidas += detalle.cantidad;
      });
      return acc;
    }, emptySalesTotals());

    gastos.forEach((gasto) => {
      totals.totalGastos += gasto.monto;
      if (gasto.metodoPago === 'EFECTIVO') totals.gastoEfectivo += gasto.monto;
      else if (gasto.metodoPago === 'QR') totals.gastoQr += gasto.monto;
    });
    totals.netoEfectivo = Math.max(totals.totalEfectivo - totals.gastoEfectivo, 0);
    totals.netoQr = Math.max(totals.totalQr - totals.gastoQr, 0);
    totals.totalDisponible =
      totals.netoEfectivo +
      totals.totalTransferencia +
      totals.netoQr +
      totals.totalTarjeta;

    const productMap = new Map<string, {
      productoId: string;
      codigo: string;
      descripcion: string;
      marca: string;
      categoria: string;
      sucursal: string;
      cantidad: number;
      total: number;
    }>();

    ventas.forEach((venta) => {
      venta.detalles.forEach((detalle) => {
        const product = detalle.producto;
        const productKey = detalle.productoId || detalle.descripcion || detalle.id;
        const current = productMap.get(productKey) || {
          productoId: productKey,
          codigo: product?.codigo || detalle.tipoLinea || '',
          descripcion: product?.descripcion || detalle.descripcion || 'Detalle',
          marca: product?.marca || '',
          categoria: product?.categoria?.nombre || 'Sin categoria',
          sucursal: product?.sucursal?.nombre || venta.sucursal?.nombre || 'Sucursal',
          cantidad: 0,
          total: 0,
        };
        current.cantidad += detalle.cantidad;
        current.total += detalle.subtotal;
        productMap.set(productKey, current);
      });
    });

    const productosVendidos = Array.from(productMap.values()).sort((a, b) => b.cantidad - a.cantidad);

    return {
      period: params.period,
      label: range.label,
      desde: range.start,
      hasta: range.end,
      totals,
      ventas,
      gastos,
      productosVendidos,
    };
  }

  async getCashClosingReport(params: {
    period: ReportPeriod;
    value?: string | null;
    sucursalId?: string | null;
    usuarioId?: string | null;
  }) {
    const range = parsePeriod(params.period, params.value);
    const where: Prisma.CierreCajaWhereInput = {
      fecha: { gte: range.start, lt: range.end },
    };
    if (params.sucursalId) where.sucursalId = params.sucursalId;
    if (params.usuarioId) where.usuarioId = params.usuarioId;

    const cierres = await prisma.cierreCaja.findMany({
      where,
      include: {
        usuario: { select: { id: true, nombre: true, email: true } },
        sucursal: true,
      },
      orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
    });

    const totals = cierres.reduce((acc, cierre) => {
      acc.cantidadCierres += 1;
      acc.cantidadVentas += cierre.cantidadVentas;
      acc.totalVentas += cierre.totalVentas;
      acc.totalEfectivo += cierre.totalEfectivo;
      acc.totalTransferencia += cierre.totalTransferencia;
      acc.totalQr += cierre.totalQr;
      acc.totalTarjeta += cierre.totalTarjeta;
      acc.totalCredito += cierre.totalCredito;
      acc.gastoEfectivo += cierre.gastoEfectivo;
      acc.gastoQr += cierre.gastoQr;
      acc.totalGastos += cierre.totalGastos;
      acc.netoEfectivo += cierre.netoEfectivo;
      acc.netoQr += cierre.netoQr;
      acc.montoDeclarado += cierre.montoDeclarado;
      acc.diferencia += cierre.diferencia;
      return acc;
    }, emptyClosingTotals());

    return {
      period: params.period,
      label: range.label,
      desde: range.start,
      hasta: range.end,
      totals,
      cierres,
    };
  }

  async getProductInventoryReport(params: {
    period: ReportPeriod;
    value?: string | null;
    sucursalId?: string | null;
    search?: string | null;
  }) {
    const range = parsePeriod(params.period, params.value);
    const productWhere: Prisma.ProductoWhereInput = {};
    if (params.sucursalId) productWhere.sucursalId = params.sucursalId;
    if (params.search) {
      productWhere.OR = [
        { codigo: { contains: params.search, mode: 'insensitive' } },
        { descripcion: { contains: params.search, mode: 'insensitive' } },
        { marca: { contains: params.search, mode: 'insensitive' } },
        { ubicacion: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.producto.findMany({
      where: productWhere,
      include: { categoria: true, sucursal: true },
      orderBy: [{ sucursal: { nombre: 'asc' } }, { codigo: 'asc' }],
    });

    const productIds = products.map((product) => product.id);
    const movements = productIds.length
      ? await prisma.movimientoStock.findMany({
          where: {
            productoId: { in: productIds },
            createdAt: { gte: range.start, lt: range.end },
          },
          orderBy: [{ productoId: 'asc' }, { createdAt: 'asc' }],
        })
      : [];

    const movementMap = new Map<string, typeof movements>();
    movements.forEach((movement) => {
      const list = movementMap.get(movement.productoId) || [];
      list.push(movement);
      movementMap.set(movement.productoId, list);
    });

    const items = products.map((product) => {
      const productMovements = movementMap.get(product.id) || [];
      const firstMovement = productMovements[0];
      const stockInicial = firstMovement?.stockAnterior ?? product.stock;
      const vendidos = productMovements
        .filter((movement) => movement.tipoMovimiento === 'VENTA')
        .reduce((sum, movement) => sum + Math.abs(movement.cantidad), 0);
      const otrosMovimientos = productMovements
        .filter((movement) => movement.tipoMovimiento !== 'VENTA')
        .reduce((sum, movement) => sum + movement.cantidad, 0);

      return {
        productoId: product.id,
        codigo: product.codigo,
        descripcion: product.descripcion,
        marca: product.marca,
        categoria: product.categoria?.nombre || 'Sin categoria',
        sucursal: product.sucursal?.nombre || 'Sin sucursal',
        sucursalId: product.sucursalId,
        ubicacion: product.ubicacion,
        stockInicial,
        vendidos,
        otrosMovimientos,
        stockActual: product.stock,
        stockMinimo: product.stockMinimo,
      };
    });

    const totals = items.reduce(
      (acc, item) => {
        acc.stockInicial += item.stockInicial;
        acc.vendidos += item.vendidos;
        acc.otrosMovimientos += item.otrosMovimientos;
        acc.stockActual += item.stockActual;
        return acc;
      },
      { productos: items.length, stockInicial: 0, vendidos: 0, otrosMovimientos: 0, stockActual: 0 }
    );

    return {
      period: params.period,
      label: range.label,
      desde: range.start,
      hasta: range.end,
      totals,
      items,
    };
  }
}
