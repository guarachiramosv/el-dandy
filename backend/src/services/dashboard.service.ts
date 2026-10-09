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
        where: { productoId: { not: null } },
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

    // Fetch related records in two batches. The previous implementation issued one
    // query per row (up to 15 extra round trips on every dashboard load).
    const productIds = Array.from(new Set([
      ...topProductos.map((item) => item.productoId).filter((id): id is string => Boolean(id)),
      ...productosMasMovidos.map((item) => item.productoId),
    ]));
    const customerIds = ventasPorCliente.map((item) => item.clienteId).filter((id): id is string => Boolean(id));
    const [relatedProducts, relatedCustomers] = await Promise.all([
      prisma.producto.findMany({
        where: { id: { in: productIds } },
        select: { id: true, descripcion: true, codigo: true, imagen: true },
      }),
      prisma.cliente.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, nombre: true, empresa: true },
      }),
    ]);
    const productsById = new Map(relatedProducts.map((product) => [product.id, product]));
    const customersById = new Map(relatedCustomers.map((customer) => [customer.id, customer]));

    const topProductosEnriched = topProductos.map((item) => {
      const producto = item.productoId ? productsById.get(item.productoId) : null;
      return { ...producto, vendidos: item._sum.cantidad };
    });

    const ventasPorClienteEnriched = ventasPorCliente.map((item) => ({
      clienteId: item.clienteId,
      cliente: item.clienteId ? customersById.get(item.clienteId) ?? null : null,
      total: item._sum.total ?? 0,
      ventas: item._count.id,
    }));

    const clientesFrecuentes = ventasPorClienteEnriched.filter((item) => item.ventas >= 3 || item.total >= 3000);
    const productosMasMovidosEnriched = productosMasMovidos.map((item) => {
      const producto = productsById.get(item.productoId);
      return {
        productoId: item.productoId,
        producto: producto ? { codigo: producto.codigo, descripcion: producto.descripcion } : null,
        movimientos: item._count.id,
        cantidad: item._sum.cantidad ?? 0,
      };
    });

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
