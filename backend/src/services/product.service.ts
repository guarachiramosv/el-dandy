// src/services/product.service.ts
import { prisma } from '../lib/prisma';
import { Prisma, ProductStatus } from '@prisma/client';
import { StockService } from './stock.service';

const stockService = new StockService();
const DEFAULT_PRODUCT_BRAND = 'Sin marca';

const productInclude = {
  categoria: true,
  sucursal: true,
  proveedor: true,
  stockSucursales: {
    include: { sucursal: true },
    orderBy: { createdAt: 'asc' as const },
  },
  imagenes: { orderBy: { orden: 'asc' as const } },
};

export class ProductService {
  private formatSequentialCode(value: number) {
    return String(value).padStart(4, '0');
  }

  private async nextSequentialCode(tx: Pick<typeof prisma, 'producto'> = prisma) {
    const products = await tx.producto.findMany({
      select: { codigo: true },
    });
    const maxCode = products.reduce((max, product) => {
      if (!/^\d+$/.test(product.codigo)) return max;
      return Math.max(max, Number(product.codigo));
    }, -1);
    return this.formatSequentialCode(maxCode + 1);
  }

  private async ensureUniqueCode(codigo: string, productId?: string) {
    const existing = await prisma.producto.findFirst({
      where: {
        codigo,
        id: productId ? { not: productId } : undefined,
      },
      select: { codigo: true, descripcion: true },
    });

    if (existing) {
      throw Object.assign(
        new Error(`Ya existe el codigo ${codigo} como ${existing.descripcion}. Usa el boton Agregar stock para cargarlo en otra sucursal.`),
        { status: 409 }
      );
    }
  }

  private async syncProductTotalStock(tx: any, productoId: string) {
    const result = await tx.productoStockSucursal.aggregate({
      where: { productoId, estado: 'ACTIVO', activo: true },
      _sum: { stock: true },
    });
    const stock = result._sum.stock ?? 0;
    const activeBranches = await tx.productoStockSucursal.count({
      where: { productoId, estado: 'ACTIVO', activo: true },
    });
    await tx.producto.update({
      where: { id: productoId },
      data: { stock, activo: activeBranches > 0, estado: activeBranches > 0 ? 'ACTIVO' : 'INACTIVO' },
    });
    return stock;
  }

  private applySucursalStock(product: any, sucursalId?: string) {
    if (!sucursalId) return product;
    const branchStock = product.stockSucursales?.find((item: any) => item.sucursalId === sucursalId && item.estado === 'ACTIVO' && item.activo);
    if (!branchStock) return product;
    return {
      ...product,
      stock: branchStock.stock,
      sucursalId,
      sucursal: branchStock.sucursal || product.sucursal,
    };
  }

  async getAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'active' | 'inactive' | 'discontinued' | 'all';
    sucursalId?: string;
  }) {
    const page = Number.isFinite(params.page) && params.page! > 0 ? params.page! : 1;
    const limit = Number.isFinite(params.limit) && params.limit! > 0 ? params.limit! : 10;
    const { search } = params;
    const where: Prisma.ProductoWhereInput = {};
    const and: Prisma.ProductoWhereInput[] = [];
    if (params.sucursalId) {
      and.push({
        OR: [
          { stockSucursales: { some: { sucursalId: params.sucursalId, estado: 'ACTIVO', activo: true } } },
          { sucursalId: params.sucursalId },
        ],
      });
    }
    if (params.status === 'inactive') where.estado = 'INACTIVO';
    else if (params.status === 'discontinued') where.estado = 'DESCONTINUADO';
    else if (params.status !== 'all') where.estado = 'ACTIVO';
    if (search) {
      and.push({ OR: [
        { descripcion: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search, mode: 'insensitive' } },
        { codigoRepuesto: { contains: search, mode: 'insensitive' } },
        { marca: { contains: search, mode: 'insensitive' } },
      ] });
    }
    if (and.length > 0) where.AND = and;
    const [items, total] = await Promise.all([
      prisma.producto.findMany({
        where,
        include: productInclude,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.producto.count({ where }),
    ]);
    return { items: items.map((item) => this.applySucursalStock(item, params.sucursalId)), total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string) {
    return prisma.producto.findUnique({
      where: { id },
      include: productInclude,
    });
  }

  async getCustomerCatalog(params: { search?: string }) {
    const where: Prisma.ProductoWhereInput = { estado: 'ACTIVO', activo: true };
    if (params.search) {
      where.OR = [
        { descripcion: { contains: params.search, mode: 'insensitive' } },
        { codigo: { contains: params.search, mode: 'insensitive' } },
        { codigoRepuesto: { contains: params.search, mode: 'insensitive' } },
        { marca: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    return prisma.producto.findMany({
      where,
      select: {
        id: true,
        codigo: true,
        codigoRepuesto: true,
        descripcion: true,
        marca: true,
        condicion: true,
        unidadVenta: true,
        stock: true,
        stockMinimo: true,
        ubicacion: true,
        precioVenta: true,
        imagen: true,
        imagenes: { select: { id: true, url: true, orden: true }, orderBy: { orden: 'asc' } },
        categoriaId: true,
        sucursalId: true,
        stockSucursales: {
          select: { id: true, sucursalId: true, stock: true, activo: true, estado: true, sucursal: { select: { id: true, nombre: true, whatsapp: true } } },
          orderBy: { createdAt: 'asc' },
        },
        createdAt: true,
        categoria: { select: { id: true, nombre: true } },
        sucursal: { select: { id: true, nombre: true, whatsapp: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async create(data: Prisma.ProductoUncheckedCreateInput) {
    if (typeof data.codigoRepuesto === 'string') {
      data.codigoRepuesto = data.codigoRepuesto.trim() || null;
    }
    data.marca = typeof data.marca === 'string' && data.marca.trim()
      ? data.marca.trim()
      : DEFAULT_PRODUCT_BRAND;
    const initialStock = typeof data.stock === 'number' ? data.stock : 0;
    return prisma.$transaction(async (tx) => {
      data.codigo = await this.nextSequentialCode(tx);
      const product = await tx.producto.create({
        data: { ...data, stock: initialStock },
        include: productInclude,
      });
      await tx.productoStockSucursal.create({
        data: {
          productoId: product.id,
          sucursalId: data.sucursalId,
          stock: initialStock,
        },
      });
      return tx.producto.findUnique({
        where: { id: product.id },
        include: productInclude,
      });
    });
  }

  async update(id: string, data: Prisma.ProductoUncheckedUpdateInput & { deletedImageUrls?: string[] }) {
    const current = await prisma.producto.findUnique({ where: { id }, select: { codigo: true, sucursalId: true, imagen: true } });
    if (!current) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });

    const nextCodigo = typeof data.codigo === 'string' ? data.codigo.trim() : current.codigo;
    const nextSucursalId = typeof data.sucursalId === 'string' ? data.sucursalId : current.sucursalId;
    const nextStock = typeof data.stock === 'number' ? data.stock : undefined;

    if (typeof data.codigo === 'string') data.codigo = nextCodigo;
    if (typeof data.codigoRepuesto === 'string') data.codigoRepuesto = data.codigoRepuesto.trim() || null;
    if (typeof data.marca === 'string') data.marca = data.marca.trim() || DEFAULT_PRODUCT_BRAND;
    else if (data.marca === null) data.marca = DEFAULT_PRODUCT_BRAND;
    if (nextCodigo !== current.codigo) {
      await this.ensureUniqueCode(nextCodigo, id);
    }
    return prisma.$transaction(async (tx) => {
      const updateData: any = { ...data };
      delete updateData.stock;
      delete updateData.deletedImageUrls;

      if (data.deletedImageUrls && data.deletedImageUrls.length > 0) {
        await tx.productoImagen.deleteMany({
          where: { productoId: id, url: { in: data.deletedImageUrls } },
        });
        if (current.imagen && data.deletedImageUrls.includes(current.imagen)) {
          const remainingImages = await tx.productoImagen.findMany({
            where: { productoId: id },
            orderBy: { orden: 'asc' },
          });
          updateData.imagen = remainingImages.length > 0 ? remainingImages[0].url : null;
        }
      }

      await tx.producto.update({
        where: { id },
        data: updateData,
      });

      if (nextStock !== undefined || nextSucursalId !== current.sucursalId) {
        const existingStock = await tx.productoStockSucursal.findUnique({
          where: { productoId_sucursalId: { productoId: id, sucursalId: nextSucursalId } },
        });
        await tx.productoStockSucursal.upsert({
          where: { productoId_sucursalId: { productoId: id, sucursalId: nextSucursalId } },
          update: { stock: nextStock ?? existingStock?.stock ?? 0 },
          create: {
            productoId: id,
            sucursalId: nextSucursalId,
            stock: nextStock ?? 0,
          },
        });
        await this.syncProductTotalStock(tx, id);
      }

      return tx.producto.findUnique({
        where: { id },
        include: productInclude,
      });
    });
  }

  async addStock(id: string, data: { sucursalId: string; cantidad: number; usuarioId?: string | null; notas?: string | null }) {
    const product = await prisma.$transaction(async (tx) => {
      const current = await tx.producto.findUnique({
        where: { id },
        include: { stockSucursales: true },
      });
      if (!current) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });

      const branchStock = current.stockSucursales.find((item) => item.sucursalId === data.sucursalId);
      const stockAnterior = branchStock?.stock ?? 0;
      const stockNuevo = stockAnterior + data.cantidad;

      await tx.productoStockSucursal.upsert({
        where: { productoId_sucursalId: { productoId: id, sucursalId: data.sucursalId } },
        update: { stock: stockNuevo },
        create: {
          productoId: id,
          sucursalId: data.sucursalId,
          stock: stockNuevo,
          activo: true,
          estado: 'ACTIVO',
        },
      });
      await this.syncProductTotalStock(tx, id);

      await stockService.recordMovement(tx, {
        tipoMovimiento: 'AJUSTE',
        productoId: id,
        sucursalId: data.sucursalId,
        stockAnterior,
        stockNuevo,
        cantidad: data.cantidad,
        usuarioId: data.usuarioId,
        referenciaTipo: 'AGREGAR_STOCK',
        notas: data.notas,
      });

      return tx.producto.findUnique({
        where: { id },
        include: productInclude,
      });
    });

    return product;
  }

  async updateBranchStatus(id: string, sucursalId: string, estado: ProductStatus) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.producto.findUnique({ where: { id }, include: { stockSucursales: true } });
      if (!current) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });

      const branch = current.stockSucursales.find((item) => item.sucursalId === sucursalId);
      if (!branch) throw Object.assign(new Error('El producto no tiene stock registrado en esa sucursal'), { status: 404 });

      await tx.productoStockSucursal.update({
        where: { productoId_sucursalId: { productoId: id, sucursalId } },
        data: {
          estado,
          activo: estado === 'ACTIVO',
        },
      });

      await this.syncProductTotalStock(tx, id);

      const activeBranches = await tx.productoStockSucursal.count({
        where: { productoId: id, estado: 'ACTIVO', activo: true },
      });
      const discontinuedBranches = await tx.productoStockSucursal.count({
        where: { productoId: id, estado: 'DESCONTINUADO' },
      });
      if (activeBranches === 0 && estado === 'DESCONTINUADO' && discontinuedBranches > 0) {
        await tx.producto.update({ where: { id }, data: { estado: 'DESCONTINUADO', activo: false, stock: 0 } });
      }

      return tx.producto.findUnique({
        where: { id },
        include: productInclude,
      });
    });
  }

  async deletionHistory() {
    return prisma.productoEliminacionHistorial.findMany({
      include: {
        producto: { select: { id: true, codigo: true, codigoRepuesto: true, descripcion: true, marca: true, ubicacion: true } },
        sucursal: { select: { id: true, nombre: true } },
        usuario: { select: { id: true, nombre: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  async addImages(id: string, images: Array<{ url: string; publicId?: string; orden?: number }>) {
    const currentCount = await prisma.productoImagen.count({ where: { productoId: id } });
    await prisma.productoImagen.createMany({
      data: images.map((image, index) => ({
        productoId: id,
        url: image.url,
        publicId: image.publicId,
        orden: image.orden ?? currentCount + index,
      })),
    });

    const product = await prisma.producto.findUnique({ where: { id }, select: { imagen: true } });
    if (!product?.imagen && images[0]?.url) {
      await prisma.producto.update({ where: { id }, data: { imagen: images[0].url } });
    }

    return this.getById(id);
  }

  async delete(id: string, data: { motivo: string; sucursalId?: string | null; usuarioId?: string | null }) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.producto.findUnique({
        where: { id },
        include: { stockSucursales: true },
      });
      if (!current) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });

      const branches = data.sucursalId
        ? current.stockSucursales.filter((branch) => branch.sucursalId === data.sucursalId)
        : current.stockSucursales;

      if (branches.length === 0) {
        throw Object.assign(new Error('El producto no tiene stock registrado en esa sucursal'), { status: 404 });
      }

      for (const branch of branches) {
        await tx.productoEliminacionHistorial.create({
          data: {
            productoId: id,
            sucursalId: branch.sucursalId,
            usuarioId: data.usuarioId || null,
            motivo: data.motivo.trim(),
            stockAnterior: branch.stock,
            estadoAnterior: branch.estado,
          },
        });
        await tx.productoStockSucursal.update({
          where: { productoId_sucursalId: { productoId: id, sucursalId: branch.sucursalId } },
          data: { activo: false, estado: 'INACTIVO' },
        });
      }

      await this.syncProductTotalStock(tx, id);
      return tx.producto.findUnique({ where: { id }, include: productInclude });
    });
  }

  async restore(id: string) {
    const current = await prisma.producto.findUnique({ where: { id }, select: { codigo: true } });
    if (!current) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });

    const activeDuplicate = await prisma.producto.findFirst({
      where: {
        codigo: current.codigo,
        id: { not: id },
        estado: 'ACTIVO',
      },
      select: { descripcion: true },
    });
    if (activeDuplicate) {
      throw Object.assign(
        new Error(`No se puede restaurar porque ya existe un producto activo con el codigo ${current.codigo}. Agrega stock al producto activo.`),
        { status: 409 }
      );
    }

    return prisma.$transaction(async (tx) => {
      await tx.productoStockSucursal.updateMany({
        where: { productoId: id },
        data: { activo: true, estado: 'ACTIVO' },
      });
      await this.syncProductTotalStock(tx, id);
      return tx.producto.findUnique({ where: { id }, include: productInclude });
    });
  }

  async discontinue(id: string) {
    return prisma.$transaction(async (tx) => {
      await tx.productoStockSucursal.updateMany({
        where: { productoId: id },
        data: { activo: false, estado: 'DESCONTINUADO' },
      });
      await tx.producto.update({
        where: { id },
        data: { activo: false, estado: 'DESCONTINUADO', stock: 0 },
      });
      return tx.producto.findUnique({ where: { id }, include: productInclude });
    });
  }
}
