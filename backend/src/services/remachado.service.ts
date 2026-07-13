import { PaymentMethod, Prisma, RemachadoTrabajoTipo, SaleType } from '@prisma/client';
import { prisma } from '../lib/prisma';

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
  return { start };
}

function trabajoConfig(tipoTrabajo: RemachadoTrabajoTipo) {
  if (tipoTrabajo === 'MEDIO_JUEGO') {
    return { cantidadJuegos: 0.5, cantidadBalatas: 2, resortes: 2, gomas: 4, seguros: 1 };
  }
  return { cantidadJuegos: 1, cantidadBalatas: 4, resortes: 4, gomas: 8, seguros: 2 };
}

type ProductWithBranchStock = Prisma.ProductoGetPayload<{
  include: { stockSucursales: true };
}>;

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

const trabajoInclude = {
  medida: true,
  remache: true,
  resorteProducto: true,
  gomaProducto: true,
  seguroProducto: true,
  usuario: { select: { id: true, nombre: true, email: true } },
  sucursal: true,
  venta: { include: { detalles: true, cliente: true } },
} satisfies Prisma.RemachadoTrabajoInclude;

export class RemachadoService {
  async summary() {
    const [medidas, remaches, trabajos] = await Promise.all([
      prisma.remachadoMedida.findMany({ orderBy: { medida: 'asc' } }),
      prisma.remachadoRemache.findMany({ orderBy: { codigo: 'asc' } }),
      prisma.remachadoTrabajo.findMany({
        include: trabajoInclude,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    return { medidas, remaches, trabajos };
  }

  async createMedida(data: {
    medida: string;
    descripcion?: string | null;
    stockJuegos?: number;
    stockMinimoJuegos?: number;
    precioJuego: number;
    precioMedioJuego: number;
    remachesPorJuego?: number;
    remachesPorMedioJuego?: number;
    activo?: boolean;
  }) {
    return prisma.remachadoMedida.create({
      data: {
        medida: data.medida.trim(),
        descripcion: data.descripcion?.trim() || null,
        stockJuegos: data.stockJuegos ?? 0,
        stockMinimoJuegos: data.stockMinimoJuegos ?? 1,
        precioJuego: data.precioJuego,
        precioMedioJuego: data.precioMedioJuego,
        remachesPorJuego: data.remachesPorJuego ?? 8,
        remachesPorMedioJuego: data.remachesPorMedioJuego ?? 4,
        activo: data.activo ?? true,
      },
    });
  }

  async updateMedida(id: string, data: Partial<{
    medida: string;
    descripcion: string | null;
    stockJuegos: number;
    stockMinimoJuegos: number;
    precioJuego: number;
    precioMedioJuego: number;
    remachesPorJuego: number;
    remachesPorMedioJuego: number;
    activo: boolean;
  }>) {
    return prisma.remachadoMedida.update({
      where: { id },
      data: {
        ...data,
        medida: data.medida?.trim(),
        descripcion: data.descripcion?.trim() || data.descripcion,
      },
    });
  }

  async adjustMedidaStock(id: string, data: { cantidadJuegos: number; usuarioId?: string | null; notas?: string | null }) {
    return prisma.$transaction(async (tx) => {
      const medida = await tx.remachadoMedida.findUnique({ where: { id } });
      if (!medida) throw Object.assign(new Error('Medida no encontrada'), { status: 404 });

      const stockAnterior = medida.stockJuegos;
      const stockNuevo = Math.max(stockAnterior + data.cantidadJuegos, 0);
      await tx.remachadoMedida.update({ where: { id }, data: { stockJuegos: stockNuevo } });
      await tx.remachadoMovimiento.create({
        data: {
          tipo: data.cantidadJuegos > 0 ? 'INGRESO' : 'AJUSTE',
          medidaId: id,
          usuarioId: data.usuarioId || null,
          stockAnterior,
          stockNuevo,
          cantidad: stockNuevo - stockAnterior,
          notas: data.notas || null,
        },
      });
      return tx.remachadoMedida.findUnique({ where: { id } });
    });
  }

  async createRemache(data: {
    codigo: string;
    nombre: string;
    medida?: string | null;
    stock?: number;
    stockMinimo?: number;
    activo?: boolean;
  }) {
    return prisma.remachadoRemache.create({
      data: {
        codigo: data.codigo.trim(),
        nombre: data.nombre.trim(),
        medida: data.medida?.trim() || null,
        stock: data.stock ?? 0,
        stockMinimo: data.stockMinimo ?? 20,
        activo: data.activo ?? true,
      },
    });
  }

  async updateRemache(id: string, data: Partial<{
    codigo: string;
    nombre: string;
    medida: string | null;
    stock: number;
    stockMinimo: number;
    activo: boolean;
  }>) {
    return prisma.remachadoRemache.update({
      where: { id },
      data: {
        ...data,
        codigo: data.codigo?.trim(),
        nombre: data.nombre?.trim(),
        medida: data.medida?.trim() || data.medida,
      },
    });
  }

  async adjustRemacheStock(id: string, data: { cantidad: number; usuarioId?: string | null; notas?: string | null }) {
    return prisma.$transaction(async (tx) => {
      const remache = await tx.remachadoRemache.findUnique({ where: { id } });
      if (!remache) throw Object.assign(new Error('Remache no encontrado'), { status: 404 });

      const stockAnterior = remache.stock;
      const stockNuevo = Math.max(stockAnterior + data.cantidad, 0);
      await tx.remachadoRemache.update({ where: { id }, data: { stock: stockNuevo } });
      await tx.remachadoMovimiento.create({
        data: {
          tipo: data.cantidad > 0 ? 'INGRESO' : 'AJUSTE',
          remacheId: id,
          usuarioId: data.usuarioId || null,
          stockAnterior,
          stockNuevo,
          cantidad: stockNuevo - stockAnterior,
          notas: data.notas || null,
        },
      });
      return tx.remachadoRemache.findUnique({ where: { id } });
    });
  }

  async createTrabajo(data: {
    medidaId: string;
    remacheId?: string | null;
    usuarioId: string;
    sucursalId: string;
    clienteId?: string | null;
    metodoPago: PaymentMethod;
    tipoVenta: SaleType;
    fechaVencimiento?: string | null;
    tipoTrabajo: RemachadoTrabajoTipo;
    cantidadRemaches?: number;
    resorteProductoId?: string | null;
    cantidadResortes?: number;
    gomaProductoId?: string | null;
    cantidadGomas?: number;
    seguroProductoId?: string | null;
    cantidadSeguros?: number;
    accesorios?: Array<{ productoId: string; cantidad: number; precioUnitario?: number }>;
    notas?: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
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
        throw Object.assign(new Error('La caja de hoy ya fue cerrada. No se pueden registrar remachados.'), { status: 409 });
      }

      const medida = await tx.remachadoMedida.findUnique({ where: { id: data.medidaId } });
      if (!medida || !medida.activo) throw Object.assign(new Error('Medida de balata no disponible'), { status: 404 });

      const config = trabajoConfig(data.tipoTrabajo);
      if (medida.stockJuegos < config.cantidadJuegos) {
        throw Object.assign(new Error(`Stock insuficiente de balata ${medida.medida}. Disponible: ${medida.stockJuegos} juegos`), { status: 400 });
      }

      const remache = data.remacheId ? await tx.remachadoRemache.findUnique({ where: { id: data.remacheId } }) : null;
      const cantidadRemaches = data.tipoTrabajo === 'MEDIO_JUEGO'
        ? medida.remachesPorMedioJuego
        : medida.remachesPorJuego;
      if (remache && remache.stock < cantidadRemaches) {
        throw Object.assign(new Error(`Stock insuficiente de remaches ${remache.codigo}. Disponible: ${remache.stock}`), { status: 400 });
      }

      const accessoryInputs = [
        { role: 'resorte', productoId: data.resorteProductoId || null, cantidad: data.cantidadResortes ?? config.resortes, precioUnitario: 0 },
        { role: 'goma', productoId: data.gomaProductoId || null, cantidad: data.cantidadGomas ?? config.gomas, precioUnitario: 0 },
        { role: 'seguro', productoId: data.seguroProductoId || null, cantidad: data.cantidadSeguros ?? config.seguros, precioUnitario: 0 },
        ...(data.accesorios || []).map((item) => ({
          role: 'producto',
          productoId: item.productoId,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario ?? 0,
        })),
      ].filter((item) => item.productoId && item.cantidad > 0) as Array<{ role: string; productoId: string; cantidad: number; precioUnitario: number }>;
      const accessoryTotals = Array.from(accessoryInputs.reduce((map, item) => {
        const current = map.get(item.productoId) || { productoId: item.productoId, cantidad: 0, roles: [] as string[] };
        current.cantidad += item.cantidad;
        current.roles.push(item.role);
        map.set(item.productoId, current);
        return map;
      }, new Map<string, { productoId: string; cantidad: number; roles: string[] }>()).values());

      const accessoryProducts = accessoryInputs.length
        ? await tx.producto.findMany({
            where: { id: { in: accessoryInputs.map((item) => item.productoId) } },
            include: { stockSucursales: true },
          })
        : [];
      const accessoryProductMap = new Map(accessoryProducts.map((producto) => [producto.id, producto]));
      const accessoryStockMap = new Map<string, { sucursalId: string; availableStock: number }>();

      for (const accessory of accessoryTotals) {
        const producto = accessoryProductMap.get(accessory.productoId);
        if (!producto) {
          throw Object.assign(new Error(`Producto de accesorio no encontrado`), { status: 404 });
        }
        if (producto.unidadVenta !== 'UNIDAD') {
          throw Object.assign(new Error(`El accesorio ${producto.descripcion} debe venderse por unidad.`), { status: 400 });
        }
        const saleStock = resolveSaleStock(producto, data.sucursalId);
        accessoryStockMap.set(accessory.productoId, saleStock);
        if (saleStock.availableStock < accessory.cantidad) {
          throw Object.assign(
            new Error(`Stock insuficiente para ${producto.descripcion}. Disponible: ${saleStock.availableStock}`),
            { status: 400 }
          );
        }
      }

      const precioUnitario = data.tipoTrabajo === 'MEDIO_JUEGO' ? medida.precioMedioJuego : medida.precioJuego;
      const accesoriosTotal = accessoryInputs.reduce((sum, item) => sum + item.cantidad * item.precioUnitario, 0);
      const total = precioUnitario + accesoriosTotal;
      const descripcion = `Remachado ${medida.medida} - ${data.tipoTrabajo === 'MEDIO_JUEGO' ? '1/2 juego' : '1 juego'}`;

      const trabajo = await tx.remachadoTrabajo.create({
        data: {
          medidaId: data.medidaId,
          remacheId: data.remacheId || null,
          usuarioId: data.usuarioId,
          sucursalId: data.sucursalId,
          tipoTrabajo: data.tipoTrabajo,
          cantidadJuegos: config.cantidadJuegos,
          cantidadBalatas: config.cantidadBalatas,
          cantidadRemaches,
          resorteProductoId: data.resorteProductoId || null,
          cantidadResortes: data.resorteProductoId ? (data.cantidadResortes ?? config.resortes) : 0,
          gomaProductoId: data.gomaProductoId || null,
          cantidadGomas: data.gomaProductoId ? (data.cantidadGomas ?? config.gomas) : 0,
          seguroProductoId: data.seguroProductoId || null,
          cantidadSeguros: data.seguroProductoId ? (data.cantidadSeguros ?? config.seguros) : 0,
          precioUnitario,
          total,
          notas: data.notas || null,
        },
      });

      const accessoryDetailLines = accessoryInputs.map((accessory) => {
        const producto = accessoryProductMap.get(accessory.productoId)!;
        return {
          tipoLinea: 'PRODUCTO' as const,
          productoId: producto.id,
          descripcion: `${accessory.role}: ${producto.descripcion}`,
          unidadVenta: producto.unidadVenta,
          cantidad: accessory.cantidad,
          precioUnitario: accessory.precioUnitario,
          subtotal: accessory.cantidad * accessory.precioUnitario,
        };
      });

      const venta = await tx.venta.create({
        data: {
          usuarioId: data.usuarioId,
          sucursalId: data.sucursalId,
          clienteId: data.clienteId || null,
          metodoPago: data.metodoPago,
          tipoVenta: data.tipoVenta,
          subtotal: total,
          descuento: 0,
          total,
          detalles: {
            create: [
              {
                tipoLinea: 'REMACHADO',
                descripcion,
                unidadVenta: data.tipoTrabajo,
                cantidad: config.cantidadJuegos,
                precioUnitario,
                subtotal: precioUnitario,
                remachadoTrabajoId: trabajo.id,
              },
              ...accessoryDetailLines,
            ],
          },
        },
      });

      await tx.remachadoTrabajo.update({ where: { id: trabajo.id }, data: { ventaId: venta.id } });

      const stockBalataNuevo = medida.stockJuegos - config.cantidadJuegos;
      await tx.remachadoMedida.update({ where: { id: medida.id }, data: { stockJuegos: stockBalataNuevo } });
      await tx.remachadoMovimiento.create({
        data: {
          tipo: 'TRABAJO',
          medidaId: medida.id,
          trabajoId: trabajo.id,
          usuarioId: data.usuarioId,
          stockAnterior: medida.stockJuegos,
          stockNuevo: stockBalataNuevo,
          cantidad: -config.cantidadJuegos,
          notas: descripcion,
        },
      });

      if (remache) {
        const stockRemacheNuevo = remache.stock - cantidadRemaches;
        await tx.remachadoRemache.update({ where: { id: remache.id }, data: { stock: stockRemacheNuevo } });
        await tx.remachadoMovimiento.create({
          data: {
            tipo: 'TRABAJO',
            remacheId: remache.id,
            trabajoId: trabajo.id,
            usuarioId: data.usuarioId,
            stockAnterior: remache.stock,
            stockNuevo: stockRemacheNuevo,
            cantidad: -cantidadRemaches,
            notas: descripcion,
          },
        });
      }

      for (const accessory of accessoryTotals) {
        const producto = accessoryProductMap.get(accessory.productoId)!;
        const saleStock = accessoryStockMap.get(accessory.productoId)!;
        const stockAnterior = saleStock.availableStock;
        const stockNuevo = stockAnterior - accessory.cantidad;
        await tx.productoStockSucursal.upsert({
          where: { productoId_sucursalId: { productoId: producto.id, sucursalId: saleStock.sucursalId } },
          update: { stock: stockNuevo },
          create: {
            productoId: producto.id,
            sucursalId: saleStock.sucursalId,
            stock: stockNuevo,
          },
        });
        await tx.producto.update({
          where: { id: producto.id },
          data: { stock: { decrement: accessory.cantidad } },
        });
        await tx.movimientoStock.create({
          data: {
            tipoMovimiento: 'VENTA',
            productoId: producto.id,
            sucursalId: saleStock.sucursalId,
            stockAnterior,
            stockNuevo,
            cantidad: -accessory.cantidad,
            usuarioId: data.usuarioId,
            referenciaId: venta.id,
            referenciaTipo: 'REMACHADO',
            notas: `${descripcion} - ${accessory.roles.join(', ')}`,
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

      return tx.remachadoTrabajo.findUnique({
        where: { id: trabajo.id },
        include: trabajoInclude,
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10000,
      timeout: 20000,
    });
  }
}
