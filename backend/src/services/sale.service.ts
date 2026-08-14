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
      if (data.tipoVenta === 'CREDITO') {
        if (!data.fechaVencimiento) {
          throw Object.assign(new Error('Indica la fecha de pago para venta a credito'), { status: 400 });
        }
        const clienteCredito = await tx.cliente.findUnique({ where: { id: data.clienteId! } });
        if (!clienteCredito?.telefono?.trim()) {
          throw Object.assign(new Error('Registra el celular del cliente para venta a credito'), { status: 400 });
        }
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

    const [ventas, cierre, gastos, pagosCredito] = await Promise.all([
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
      prisma.pagoCredito.findMany({
        where: {
          usuarioId: params.usuarioId,
          createdAt: { gte: businessDay.start, lt: businessDay.end },
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
      cerrado: Boolean(cierre),
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
      prisma.pagoCredito.findMany({
        where: {
          usuarioId: params.usuarioId,
          createdAt: { lt: today.start },
          cuenta: { sucursalId: params.sucursalId },
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
    pagosCredito.forEach((pago) => {
      const fecha = getBusinessDayLabel(pago.createdAt);
      if (closedDays.has(fecha)) return;
      const current = pendingByDay.get(fecha) || { fecha, cantidadVentas: 0, totalVentas: 0, totalGastos: 0 };
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

      const businessDay = getBusinessDay(gasto.createdAt.toISOString());
      const cierre = await tx.cierreCaja.findFirst({
        where: {
          fecha: businessDay.start,
          ...sellerBusinessDayScope(gasto.usuarioId, gasto.sucursalId),
        },
      });

      if (cierre) {
        throw Object.assign(new Error('No se puede anular el gasto porque la caja de ese dia ya fue cerrada.'), { status: 409 });
      }

      await tx.gastoCaja.delete({ where: { id } });
      return { success: true };
    });
  }

  async deleteSale(id: string, motivo: string = 'Anulación de venta') {
    return prisma.$transaction(async (tx) => {
      const venta = await tx.venta.findUnique({
        where: { id },
        include: { detalles: true, remachadoTrabajos: true }
      });
      if (!venta) throw Object.assign(new Error('Venta no encontrada'), { status: 404 });

      const businessDay = getBusinessDay(venta.createdAt.toISOString());
      const cierre = await tx.cierreCaja.findFirst({
        where: {
          fecha: businessDay.start,
          ...sellerBusinessDayScope(venta.usuarioId, venta.sucursalId),
        }
      });
      if (cierre) {
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
                  usuarioId: venta.usuarioId,
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
              usuarioId: venta.usuarioId,
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
                usuarioId: venta.usuarioId,
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
        notas: data.notas,
      },
      include: {
        usuario: { select: { id: true, nombre: true, email: true } },
        sucursal: true,
      },
    });
  }
}
