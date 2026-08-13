import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ProductAuditService } from './productAudit.service';

const productAuditService = new ProductAuditService();

export type ReportPeriod = 'day' | 'month' | 'year' | 'all';

const BOLIVIA_UTC_OFFSET_HOURS = 4;

function parsePeriod(period: ReportPeriod, value?: string | null) {
  if (period === 'all') {
    return {
      start: new Date(Date.UTC(2000, 0, 1, BOLIVIA_UTC_OFFSET_HOURS, 0, 0, 0)),
      end: new Date(Date.UTC(2100, 0, 1, BOLIVIA_UTC_OFFSET_HOURS, 0, 0, 0)),
      label: 'Todo el inventario',
    };
  }

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
    totalCobrosCredito: 0,
    cobroCreditoEfectivo: 0,
    cobroCreditoTransferencia: 0,
    cobroCreditoQr: 0,
    cobroCreditoTarjeta: 0,
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
    totalCobrosCredito: 0,
    cobroCreditoEfectivo: 0,
    cobroCreditoTransferencia: 0,
    cobroCreditoQr: 0,
    cobroCreditoTarjeta: 0,
    gastoEfectivo: 0,
    gastoQr: 0,
    totalGastos: 0,
    netoEfectivo: 0,
    netoQr: 0,
    totalDisponible: 0,
  };
}

const formatDateForReport = (date: Date) => date.toISOString();

const sumMovementQuantity = (movements: Array<{ cantidad: number }>) =>
  movements.reduce((sum, movement) => sum + movement.cantidad, 0);

const isInitialStockMovement = (movement: { tipoMovimiento: string; referenciaTipo?: string | null }) =>
  movement.tipoMovimiento === 'AJUSTE' && movement.referenciaTipo === 'ALTA_PRODUCTO';

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
    const cierresWhere: Prisma.CierreCajaWhereInput = {
      fecha: { gte: range.start, lt: range.end },
    };
    if (params.sucursalId) {
      where.usuario = { sucursalId: params.sucursalId };
      gastosWhere.usuario = { sucursalId: params.sucursalId };
      cierresWhere.usuario = { sucursalId: params.sucursalId };
    }

    const [ventas, gastos, cierres] = await Promise.all([
      prisma.venta.findMany({
        where,
        include: {
          usuario: { select: { id: true, nombre: true, email: true, sucursal: true } },
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
          usuario: { select: { id: true, nombre: true, email: true, sucursal: true } },
          sucursal: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.cierreCaja.findMany({
        where: cierresWhere,
        include: {
          usuario: { select: { id: true, nombre: true, email: true, sucursal: true } },
          sucursal: true,
        },
        orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
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
    const cierreTotals = cierres.reduce((acc, cierre) => {
      acc.cantidadCierres += 1;
      acc.montoDeclarado += cierre.montoDeclarado;
      acc.diferencia += cierre.diferencia;
      acc.totalCierreVentas += cierre.totalVentas;
      acc.cierreEfectivo += cierre.netoEfectivo;
      acc.cierreQr += cierre.netoQr;
      acc.totalCobrosCredito += cierre.totalCobrosCredito;
      acc.cobroCreditoEfectivo += cierre.cobroCreditoEfectivo;
      acc.cobroCreditoTransferencia += cierre.cobroCreditoTransferencia;
      acc.cobroCreditoQr += cierre.cobroCreditoQr;
      acc.cobroCreditoTarjeta += cierre.cobroCreditoTarjeta;
      return acc;
    }, {
      cantidadCierres: 0,
      montoDeclarado: 0,
      diferencia: 0,
      totalCierreVentas: 0,
      cierreEfectivo: 0,
      cierreQr: 0,
      totalCobrosCredito: 0,
      cobroCreditoEfectivo: 0,
      cobroCreditoTransferencia: 0,
      cobroCreditoQr: 0,
      cobroCreditoTarjeta: 0,
    });
    Object.assign(totals, cierreTotals);
    totals.netoEfectivo = Math.max(totals.totalEfectivo + totals.cobroCreditoEfectivo - totals.gastoEfectivo, 0);
    totals.netoQr = Math.max(totals.totalQr + totals.cobroCreditoQr - totals.gastoQr, 0);
    totals.totalDisponible =
      totals.netoEfectivo +
      totals.totalTransferencia +
      totals.cobroCreditoTransferencia +
      totals.netoQr +
      totals.totalTarjeta +
      totals.cobroCreditoTarjeta;

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
      const reportSucursalName = venta.usuario?.sucursal?.nombre || venta.sucursal?.nombre || 'Sucursal';
      venta.detalles.forEach((detalle) => {
        const product = detalle.producto;
        const productKey = detalle.productoId || detalle.descripcion || detalle.id;
        const current = productMap.get(productKey) || {
          productoId: productKey,
          codigo: product?.codigo || detalle.tipoLinea || '',
          descripcion: product?.descripcion || detalle.descripcion || 'Detalle',
          marca: product?.marca || '',
          categoria: product?.categoria?.nombre || 'Sin categoria',
          sucursal: reportSucursalName,
          cantidad: 0,
          total: 0,
        };
        current.cantidad += detalle.cantidad;
        current.total += detalle.subtotal;
        productMap.set(productKey, current);
      });
    });

    const productosVendidos = Array.from(productMap.values()).sort((a, b) => b.cantidad - a.cantidad);
    const ventasReporte = ventas.map((venta) => ({
      ...venta,
      sucursal: venta.usuario?.sucursal || venta.sucursal,
    }));
    const gastosReporte = gastos.map((gasto) => ({
      ...gasto,
      sucursal: gasto.usuario?.sucursal || gasto.sucursal,
    }));
    const cierresReporte = cierres.map((cierre) => ({
      ...cierre,
      sucursal: cierre.usuario?.sucursal || cierre.sucursal,
    }));

    return {
      period: params.period,
      label: range.label,
      desde: range.start,
      hasta: range.end,
      totals,
      ventas: ventasReporte,
      gastos: gastosReporte,
      cierres: cierresReporte,
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
      acc.totalCobrosCredito += cierre.totalCobrosCredito;
      acc.cobroCreditoEfectivo += cierre.cobroCreditoEfectivo;
      acc.cobroCreditoTransferencia += cierre.cobroCreditoTransferencia;
      acc.cobroCreditoQr += cierre.cobroCreditoQr;
      acc.cobroCreditoTarjeta += cierre.cobroCreditoTarjeta;
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
    const productWhere: Prisma.ProductoWhereInput = {
      createdAt: { lt: range.end },
    };
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
      include: {
        categoria: true,
        sucursal: true,
        stockSucursales: {
          include: { sucursal: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ codigo: 'asc' }, { sucursal: { nombre: 'asc' } }],
    });

    const productIds = products.map((product) => product.id);
    const movementWhere: Prisma.MovimientoStockWhereInput = {
      productoId: { in: productIds },
    };
    if (params.sucursalId) movementWhere.sucursalId = params.sucursalId;
    const [periodMovements, movementsSinceStart, saleDetails] = productIds.length
      ? await Promise.all([
          prisma.movimientoStock.findMany({
            where: {
              ...movementWhere,
              createdAt: { gte: range.start, lt: range.end },
            },
            include: {
              usuario: { select: { id: true, nombre: true } },
            },
            orderBy: [{ productoId: 'asc' }, { createdAt: 'asc' }],
          }),
          prisma.movimientoStock.findMany({
            where: {
              ...movementWhere,
              createdAt: { gte: range.start },
            },
            orderBy: [{ productoId: 'asc' }, { createdAt: 'asc' }],
          }),
          prisma.detalleVenta.findMany({
            where: {
              productoId: { in: productIds },
              venta: { createdAt: { gte: range.start, lt: range.end } },
            },
            select: {
              productoId: true,
              cantidad: true,
            },
          }),
        ])
      : [[], [], []];

    const movementMap = new Map<string, typeof periodMovements>();
    periodMovements.forEach((movement) => {
      const list = movementMap.get(movement.productoId) || [];
      list.push(movement);
      movementMap.set(movement.productoId, list);
    });
    const movementSinceStartMap = new Map<string, typeof movementsSinceStart>();
    movementsSinceStart.forEach((movement) => {
      const list = movementSinceStartMap.get(movement.productoId) || [];
      list.push(movement);
      movementSinceStartMap.set(movement.productoId, list);
    });
    const soldByProductMap = new Map<string, number>();
    saleDetails.forEach((detail) => {
      if (!detail.productoId) return;
      soldByProductMap.set(detail.productoId, (soldByProductMap.get(detail.productoId) || 0) + detail.cantidad);
    });

    const items = products.map((product) => {
      const productMovements = movementMap.get(product.id) || [];
      const futureMovements = movementSinceStartMap.get(product.id) || [];
      const initialStockMovement = futureMovements.find(isInitialStockMovement);
      const firstKnownMovement = futureMovements[0];
      const getMovementSucursal = (sucursalId: string) =>
        product.stockSucursales.find((stock) => stock.sucursalId === sucursalId)?.sucursal?.nombre ||
        (product.sucursalId === sucursalId ? product.sucursal?.nombre : null) ||
        'Sucursal';
      const createdInPeriod = product.createdAt >= range.start && product.createdAt < range.end;
      const stockInicial = params.period === 'all'
        ? initialStockMovement?.stockNuevo ?? firstKnownMovement?.stockAnterior ?? product.stock
        : createdInPeriod ? 0 : product.stock - sumMovementQuantity(futureMovements);
      const ventasDetalle = productMovements.filter((movement) => movement.tipoMovimiento === 'VENTA');
      const ingresosDetalle = productMovements.filter(
        (movement) =>
          movement.tipoMovimiento !== 'VENTA' &&
          movement.cantidad > 0 &&
          (params.period !== 'all' || !isInitialStockMovement(movement)) &&
          !(movement.tipoMovimiento === 'AJUSTE' && movement.referenciaTipo === 'EDICION_STOCK_ADMIN')
      );
      const edicionesDetalle = productMovements.filter(
        (movement) => movement.tipoMovimiento === 'AJUSTE' && movement.referenciaTipo === 'EDICION_STOCK_ADMIN'
      );
      const otrosDetalle = productMovements.filter(
        (movement) =>
          movement.tipoMovimiento !== 'VENTA' &&
          (params.period !== 'all' || !isInitialStockMovement(movement)) &&
          !ingresosDetalle.some((ingreso) => ingreso.id === movement.id) &&
          !edicionesDetalle.some((edicion) => edicion.id === movement.id)
      );
      const vendidos = soldByProductMap.get(product.id) ?? ventasDetalle.reduce((sum, movement) => sum + Math.abs(movement.cantidad), 0);
      const ingresados = ingresosDetalle.reduce((sum, movement) => sum + movement.cantidad, 0);
      const editados = edicionesDetalle.reduce((sum, movement) => sum + movement.cantidad, 0);
      const otrosMovimientos = otrosDetalle.reduce((sum, movement) => sum + movement.cantidad, 0);

      return {
        productoId: product.id,
        codigo: product.codigo,
        codigoRepuesto: product.codigoRepuesto,
        descripcion: product.descripcion,
        marca: product.marca,
        condicion: product.condicion,
        categoria: product.categoria?.nombre || 'Sin categoria',
        sucursal: product.sucursal?.nombre || 'Sin sucursal',
        sucursalId: product.sucursalId,
        ubicacion: product.ubicacion,
        precioVenta: product.precioVenta,
        fechaAgregado: formatDateForReport(product.createdAt),
        agregadoEnPeriodo: createdInPeriod,
        stockAlAgregar: createdInPeriod
          ? product.stock - sumMovementQuantity(futureMovements.filter((movement) => movement.createdAt >= product.createdAt))
          : null,
        stockInicial,
        ingresados,
        vendidos,
        editados,
        otrosMovimientos,
        stockActual: product.stock,
        stockMinimo: product.stockMinimo,
        stockSucursales: product.stockSucursales.map((stock) => ({
          sucursalId: stock.sucursalId,
          sucursal: stock.sucursal?.nombre || 'Sucursal',
          stock: stock.stock,
          fechaAgregado: formatDateForReport(stock.createdAt),
        })),
        movimientos: productMovements.map((movement) => ({
          id: movement.id,
          fecha: formatDateForReport(movement.createdAt),
          tipo: movement.tipoMovimiento,
          sucursal: getMovementSucursal(movement.sucursalId),
          stockAnterior: movement.stockAnterior,
          stockNuevo: movement.stockNuevo,
          cantidad: movement.cantidad,
          usuario: movement.usuario?.nombre || null,
          referenciaTipo: movement.referenciaTipo,
          notas: movement.notas,
        })),
      };
    });

    const totals = items.reduce(
      (acc, item) => {
        acc.stockInicial += item.stockInicial;
        acc.ingresados += item.ingresados;
        acc.vendidos += item.vendidos;
        acc.editados += item.editados;
        acc.otrosMovimientos += item.otrosMovimientos;
        acc.stockActual += item.stockActual;
        return acc;
      },
      { productos: items.length, stockInicial: 0, ingresados: 0, vendidos: 0, editados: 0, otrosMovimientos: 0, stockActual: 0 }
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

  async getProductAuditReport(params: {
    period: ReportPeriod;
    value?: string | null;
    sucursalId?: string | null;
    usuarioId?: string | null;
    productoId?: string | null;
  }) {
    const range = parsePeriod(params.period, params.value);
    const auditRows = await productAuditService.list({
      from: range.start,
      to: range.end,
      sucursalId: params.sucursalId,
      usuarioId: params.usuarioId,
      productoId: params.productoId,
    });

    const totals = auditRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.accion] = (acc[row.accion] || 0) + 1;
      return acc;
    }, {});

    return {
      period: params.period,
      label: params.period === 'all' ? 'Todo el historial de cambios' : range.label,
      desde: range.start,
      hasta: range.end,
      totals: {
        registros: auditRows.length,
        acciones: totals,
      },
      items: auditRows.map((row) => ({
        id: row.id,
        accion: row.accion,
        fecha: formatDateForReport(row.createdAt),
        productoId: row.productoId,
        codigo: row.producto?.codigo || row.codigo || '',
        codigoRepuesto: row.producto?.codigoRepuesto || null,
        descripcion: row.producto?.descripcion || row.descripcion || 'Producto',
        marca: row.producto?.marca || null,
        ubicacion: row.producto?.ubicacion || null,
        sucursal: row.sucursal?.nombre || 'Sin sucursal',
        sucursalId: row.sucursalId,
        usuario: row.usuario?.nombre || 'Usuario no registrado',
        usuarioEmail: row.usuario?.email || null,
        usuarioId: row.usuarioId,
        stockAnterior: row.stockAnterior,
        stockNuevo: row.stockNuevo,
        cantidad: row.cantidad,
        estadoAnterior: row.estadoAnterior,
        estadoNuevo: row.estadoNuevo,
        detalle: row.detalle,
        cambios: row.cambios,
      })),
    };
  }
}
