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
  venta: { include: { detalles: { include: { producto: true } }, cliente: true } },
} satisfies Prisma.RemachadoTrabajoInclude;

export class RemachadoService {
  async summary() {
    const [medidas, remaches, trabajos, movimientos] = await Promise.all([
      prisma.remachadoMedida.findMany({ orderBy: { medida: 'asc' } }),
      prisma.remachadoRemache.findMany({ orderBy: { codigo: 'asc' } }),
      prisma.remachadoTrabajo.findMany({
        include: trabajoInclude,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.remachadoMovimiento.findMany({
        include: { medida: true, remache: true, usuario: { select: { nombre: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    return { medidas, remaches, trabajos, movimientos };
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
    usuarioId: string;
    sucursalId: string;
    clienteId?: string | null;
    metodoPago: PaymentMethod;
    tipoVenta: SaleType;
    fechaVencimiento?: string | null;
    trabajos: Array<{
      medidaId: string;
      remacheId?: string | null;
      tipoTrabajo: RemachadoTrabajoTipo;
      cantidadRemaches?: number;
      resorteProductoId?: string | null;
      cantidadResortes?: number;
      gomaProductoId?: string | null;
      cantidadGomas?: number;
      seguroProductoId?: string | null;
      cantidadSeguros?: number;
      notas?: string | null;
    }>;
    accesorios?: Array<{ productoId: string; cantidad: number; precioUnitario?: number }>;
    notas?: string | null;
    descuento?: number;
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

      const medidaIds = [...new Set(data.trabajos.map(t => t.medidaId))];
      const remacheIds = [...new Set(data.trabajos.map(t => t.remacheId).filter(Boolean) as string[])];

      const [medidasDb, remachesDb] = await Promise.all([
        tx.remachadoMedida.findMany({ where: { id: { in: medidaIds } } }),
        tx.remachadoRemache.findMany({ where: { id: { in: remacheIds } } })
      ]);

      const medidaMap = new Map(medidasDb.map(m => [m.id, m]));
      const remacheMap = new Map(remachesDb.map(r => [r.id, r]));

      for (const t of data.trabajos) {
        const m = medidaMap.get(t.medidaId);
        if (!m || !m.activo) {
          throw Object.assign(new Error('Medida de balata no disponible'), { status: 404 });
        }
      }

      let total = 0;
      const accessoryInputs: Array<{ role: string; productoId: string; cantidad: number; precioUnitario: number }> = [];

      if (data.accesorios) {
        for (const acc of data.accesorios) {
          if (acc.cantidad > 0) {
            accessoryInputs.push({
              role: 'producto',
              productoId: acc.productoId,
              cantidad: acc.cantidad,
              precioUnitario: acc.precioUnitario ?? 0,
            });
            total += acc.cantidad * (acc.precioUnitario ?? 0);
          }
        }
      }

      const processedTrabajos = data.trabajos.map((t) => {
        const config = trabajoConfig(t.tipoTrabajo);
        const medida = medidaMap.get(t.medidaId)!;
        const remache = t.remacheId ? remacheMap.get(t.remacheId) : null;
        const cantidadRemaches = t.tipoTrabajo === 'MEDIO_JUEGO'
          ? medida.remachesPorMedioJuego
          : medida.remachesPorJuego;

        const pUnitario = t.tipoTrabajo === 'MEDIO_JUEGO' ? medida.precioMedioJuego : medida.precioJuego;
        const descripcion = `Remachado ${medida.medida} - ${t.tipoTrabajo === 'MEDIO_JUEGO' ? '1/2 juego' : '1 juego'}`;
        
        const tAccessories = [
          { role: 'resorte', productoId: t.resorteProductoId || null, cantidad: t.cantidadResortes ?? config.resortes, precioUnitario: 0 },
          { role: 'goma', productoId: t.gomaProductoId || null, cantidad: t.cantidadGomas ?? config.gomas, precioUnitario: 0 },
          { role: 'seguro', productoId: t.seguroProductoId || null, cantidad: t.cantidadSeguros ?? config.seguros, precioUnitario: 0 },
        ].filter(item => item.productoId && item.cantidad > 0) as Array<{ role: string; productoId: string; cantidad: number; precioUnitario: number }>;
        
        tAccessories.forEach(a => accessoryInputs.push(a));
        
        total += pUnitario;

        return {
          original: t,
          config,
          medida,
          remache,
          cantidadRemaches,
          precioUnitario: pUnitario,
          descripcion,
          totalTrabajo: pUnitario,
        };
      });

      const medidaDeductions = new Map<string, number>();
      for (const pt of processedTrabajos) {
        medidaDeductions.set(pt.medida.id, (medidaDeductions.get(pt.medida.id) || 0) + pt.config.cantidadJuegos);
      }
      for (const [mId, deduction] of medidaDeductions.entries()) {
        const m = medidaMap.get(mId)!;
        if (m.stockJuegos < deduction) {
          throw Object.assign(new Error(`Stock insuficiente de balata ${m.medida}. Disponible: ${m.stockJuegos}, requerido: ${deduction} juegos`), { status: 400 });
        }
      }

      const remacheDeductions = new Map<string, number>();
      for (const pt of processedTrabajos) {
        if (pt.remache) {
          remacheDeductions.set(pt.remache.id, (remacheDeductions.get(pt.remache.id) || 0) + pt.cantidadRemaches);
        }
      }
      for (const [rId, deduction] of remacheDeductions.entries()) {
        const r = remacheMap.get(rId)!;
        if (r.stock < deduction) {
          throw Object.assign(new Error(`Stock insuficiente de remaches ${r.codigo}. Disponible: ${r.stock}, requerido: ${deduction}`), { status: 400 });
        }
      }

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

      const trabajosCreated = [];
      for (const pt of processedTrabajos) {
        const trabajo = await tx.remachadoTrabajo.create({
          data: {
            medidaId: pt.medida.id,
            remacheId: pt.remache?.id || null,
            usuarioId: data.usuarioId,
            sucursalId: data.sucursalId,
            tipoTrabajo: pt.original.tipoTrabajo,
            cantidadJuegos: pt.config.cantidadJuegos,
            cantidadBalatas: pt.config.cantidadBalatas,
            cantidadRemaches: pt.cantidadRemaches,
            resorteProductoId: pt.original.resorteProductoId || null,
            cantidadResortes: pt.original.resorteProductoId ? (pt.original.cantidadResortes ?? pt.config.resortes) : 0,
            gomaProductoId: pt.original.gomaProductoId || null,
            cantidadGomas: pt.original.gomaProductoId ? (pt.original.cantidadGomas ?? pt.config.gomas) : 0,
            seguroProductoId: pt.original.seguroProductoId || null,
            cantidadSeguros: pt.original.seguroProductoId ? (pt.original.cantidadSeguros ?? pt.config.seguros) : 0,
            precioUnitario: pt.precioUnitario,
            total: pt.totalTrabajo,
            notas: pt.original.notas || null,
          }
        });
        trabajosCreated.push(trabajo);
      }

      const ventaDetalles = [];
      for (let i = 0; i < processedTrabajos.length; i++) {
        const pt = processedTrabajos[i];
        const tb = trabajosCreated[i];
        ventaDetalles.push({
          tipoLinea: 'REMACHADO' as const,
          descripcion: pt.descripcion,
          unidadVenta: pt.original.tipoTrabajo,
          cantidad: pt.config.cantidadJuegos,
          precioUnitario: pt.precioUnitario,
          subtotal: pt.precioUnitario,
          remachadoTrabajoId: tb.id,
        });
      }
      
      const accessoryDetailLines = accessoryInputs.map((accessory) => {
        const producto = accessoryProductMap.get(accessory.productoId)!;
        return {
          tipoLinea: 'PRODUCTO' as const,
          productoId: producto.id,
          descripcion: producto.descripcion,
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
          descuento: data.descuento || 0,
          total: total - (data.descuento || 0),
          detalles: {
            create: [...ventaDetalles, ...accessoryDetailLines]
          },
        },
      });

      await tx.remachadoTrabajo.updateMany({
        where: { id: { in: trabajosCreated.map(t => t.id) } },
        data: { ventaId: venta.id }
      });

      for (const [mId, deduction] of medidaDeductions.entries()) {
        const m = medidaMap.get(mId)!;
        const stockBalataNuevo = m.stockJuegos - deduction;
        await tx.remachadoMedida.update({ where: { id: mId }, data: { stockJuegos: stockBalataNuevo } });
        
        // Registrar el movimiento de stock (apuntando al primer trabajo para referencia)
        const matchedTrabajo = trabajosCreated.find(t => t.medidaId === mId);
        await tx.remachadoMovimiento.create({
          data: {
            tipo: 'TRABAJO',
            medidaId: mId,
            trabajoId: matchedTrabajo?.id,
            usuarioId: data.usuarioId,
            stockAnterior: m.stockJuegos,
            stockNuevo: stockBalataNuevo,
            cantidad: -deduction,
            notas: `Venta de remachado (${deduction} juegos)`,
          },
        });
      }

      for (const [rId, deduction] of remacheDeductions.entries()) {
        const r = remacheMap.get(rId)!;
        const stockRemacheNuevo = r.stock - deduction;
        await tx.remachadoRemache.update({ where: { id: rId }, data: { stock: stockRemacheNuevo } });
        
        const matchedTrabajo = trabajosCreated.find(t => t.remacheId === rId);
        await tx.remachadoMovimiento.create({
          data: {
            tipo: 'TRABAJO',
            remacheId: rId,
            trabajoId: matchedTrabajo?.id,
            usuarioId: data.usuarioId,
            stockAnterior: r.stock,
            stockNuevo: stockRemacheNuevo,
            cantidad: -deduction,
            notas: `Venta de remachado (${deduction} remaches)`,
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
            notas: `Remachado - ${accessory.roles.join(', ')}`,
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
        where: { id: trabajosCreated[0].id },
        include: trabajoInclude,
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10000,
      timeout: 20000,
    });
  }
}
