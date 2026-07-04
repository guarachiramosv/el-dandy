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

const BOLIVIA_UTC_OFFSET_HOURS = 4;

function getBusinessDay(dateValue?: string | null) {
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

export class SaleService {
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
      const cierre = await tx.cierreCaja.findUnique({
        where: {
          fecha_usuarioId_sucursalId: {
            fecha: businessDay.start,
            usuarioId: data.usuarioId,
            sucursalId: data.sucursalId,
          },
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

      for (const item of data.items) {
        const producto = productMap.get(item.productoId);
        if (!producto) {
          throw Object.assign(new Error('Producto no encontrado'), { status: 404 });
        }
        const branchStock = producto.stockSucursales.find((stock) => stock.sucursalId === data.sucursalId && stock.estado === 'ACTIVO' && stock.activo);
        const availableStock = branchStock?.stock ?? (producto.sucursalId === data.sucursalId ? producto.stock : 0);
        if (!branchStock && producto.sucursalId !== data.sucursalId) {
          throw Object.assign(
            new Error(`${producto.codigo} - ${producto.descripcion} no tiene stock registrado en esta sucursal.`),
            { status: 400 }
          );
        }
        if (availableStock < item.cantidad) {
          throw Object.assign(
            new Error(`Stock insuficiente para ${producto.descripcion}. Disponible: ${availableStock}`),
            { status: 400 }
          );
        }
      }

      const detalles = data.items.map((item) => {
        const producto = productMap.get(item.productoId)!;
        const lineSubtotal = producto.precioVenta * item.cantidad - item.descuentoItem;
        return {
          productoId: item.productoId,
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
        const branchStock = producto.stockSucursales.find((stock) => stock.sucursalId === data.sucursalId && stock.estado === 'ACTIVO' && stock.activo);
        const stockAnterior = branchStock?.stock ?? producto.stock;
        const stockNuevo = stockAnterior - item.cantidad;
        await tx.productoStockSucursal.upsert({
          where: { productoId_sucursalId: { productoId: item.productoId, sucursalId: data.sucursalId } },
          update: { stock: stockNuevo },
          create: {
            productoId: item.productoId,
            sucursalId: data.sucursalId,
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
            sucursalId: data.sucursalId,
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
    const where = {
      usuarioId: params.usuarioId,
      sucursalId: params.sucursalId,
      createdAt: { gte: businessDay.start, lt: businessDay.end },
    };

    const [ventas, cierre] = await Promise.all([
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
      prisma.cierreCaja.findUnique({
        where: {
          fecha_usuarioId_sucursalId: {
            fecha: businessDay.start,
            usuarioId: params.usuarioId,
            sucursalId: params.sucursalId,
          },
        },
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

    return {
      fecha: businessDay.label,
      desde: businessDay.start,
      hasta: businessDay.end,
      cerrado: Boolean(cierre),
      cierre,
      totals,
      ventas,
    };
  }

  async closeCashRegister(data: CloseCashRegisterInput) {
    const summary = await this.getDailySummary(data);
    if (summary.cierre) {
      throw Object.assign(new Error('La caja de hoy ya fue cerrada'), { status: 409 });
    }

    const diferencia = data.montoDeclarado - summary.totals.totalEfectivo;
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
