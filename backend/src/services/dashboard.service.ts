// src/services/dashboard.service.ts
import { prisma } from '../lib/prisma';

const LOW_STOCK_THRESHOLD = 5;

export class DashboardService {
  async getSummary() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      ventasHoy,
      totalVentasHoy,
      ventasMes,
      totalVentasMes,
      productosStockBajo,
      totalProductos,
      totalUsuarios,
      topProductos,
      ventasPorDia,
      clientesNuevos,
      clientesConDeuda,
      ventasPorCliente,
      comprasRecientes,
      movimientosRecientes,
      productosAgotados,
      productosMasMovidos,
    ] = await Promise.all([
      // Count ventas today
      prisma.venta.count({ where: { createdAt: { gte: startOfDay } } }),
      // Sum total ventas today
      prisma.venta.aggregate({ _sum: { total: true }, where: { createdAt: { gte: startOfDay } } }),
      // Count ventas this month
      prisma.venta.count({ where: { createdAt: { gte: startOfMonth } } }),
      // Sum total ventas this month
      prisma.venta.aggregate({ _sum: { total: true }, where: { createdAt: { gte: startOfMonth } } }),
      // Low stock products
      prisma.producto.findMany({
        where: { stock: { lte: LOW_STOCK_THRESHOLD } },
        include: { categoria: true },
        orderBy: { stock: 'asc' },
        take: 10,
      }),
      // Total products
      prisma.producto.count(),
      // Active users
      prisma.usuario.count({ where: { activo: true } }),
      // Top sold products (last 30 days)
      prisma.detalleVenta.groupBy({
        by: ['productoId'],
        _sum: { cantidad: true },
        orderBy: { _sum: { cantidad: 'desc' } },
        take: 5,
      }),
      // Ventas por día (last 7 days)
      prisma.$queryRaw<{ dia: string; total: number }[]>`
        SELECT DATE("createdAt")::text AS dia, SUM(total)::float AS total
        FROM "Venta"
        WHERE "createdAt" >= NOW() - INTERVAL '7 days'
        GROUP BY DATE("createdAt")
        ORDER BY dia ASC
      `,
      prisma.cliente.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.cuentaCobrar.count({ where: { saldo: { gt: 0 } } }),
      prisma.venta.groupBy({
        by: ['clienteId'],
        where: { clienteId: { not: null } },
        _sum: { total: true },
        _count: { id: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
      prisma.compra.findMany({
        include: { proveedor: true, sucursal: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.movimientoStock.findMany({
        include: { producto: true, usuario: { select: { id: true, nombre: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.producto.findMany({
        where: { stock: 0 },
        include: { categoria: true, sucursal: true },
        take: 10,
      }),
      prisma.movimientoStock.groupBy({
        by: ['productoId'],
        _sum: { cantidad: true },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    // Enrich top products with product details
    const topProductosEnriched = await Promise.all(
      topProductos.map(async (tp) => {
        const producto = await prisma.producto.findUnique({
          where: { id: tp.productoId },
          select: { descripcion: true, codigo: true, imagen: true },
        });
        return { ...producto, vendidos: tp._sum.cantidad };
      })
    );

    const ventasPorClienteEnriched = await Promise.all(
      ventasPorCliente.map(async (vc) => {
        const cliente = vc.clienteId
          ? await prisma.cliente.findUnique({ where: { id: vc.clienteId }, select: { nombre: true, empresa: true } })
          : null;
        return { clienteId: vc.clienteId, cliente, total: vc._sum.total ?? 0, ventas: vc._count.id };
      })
    );

    const clientesFrecuentes = ventasPorClienteEnriched.filter((item) => item.ventas >= 3 || item.total >= 3000);
    const productosMasMovidosEnriched = await Promise.all(
      productosMasMovidos.map(async (pm) => {
        const producto = await prisma.producto.findUnique({ where: { id: pm.productoId }, select: { codigo: true, descripcion: true } });
        return { productoId: pm.productoId, producto, movimientos: pm._count.id, cantidad: pm._sum.cantidad ?? 0 };
      })
    );

    return {
      ventasHoy,
      totalVentasHoy: totalVentasHoy._sum.total ?? 0,
      ventasMes,
      totalVentasMes: totalVentasMes._sum.total ?? 0,
      productosStockBajo,
      totalProductos,
      totalUsuariosActivos: totalUsuarios,
      topProductos: topProductosEnriched,
      ventasPorDia,
      clientesNuevos,
      clientesConDeuda,
      clientesFrecuentes,
      ventasPorCliente: ventasPorClienteEnriched,
      comprasRecientes,
      movimientosRecientes,
      productosAgotados,
      stockCritico: productosStockBajo,
      productosMasMovidos: productosMasMovidosEnriched,
    };
  }
}
