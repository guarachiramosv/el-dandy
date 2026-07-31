// src/services/product.service.ts
import { prisma } from '../lib/prisma';
import { Prisma, ProductStatus } from '@prisma/client';
import { StockService } from './stock.service';
import { ProductAuditService } from './productAudit.service';
import { filterAndSortBySearch, getSearchTerms } from '../utils/fuzzySearch';

const stockService = new StockService();
const productAuditService = new ProductAuditService();
const DEFAULT_PRODUCT_BRAND = 'Sin marca';
const SEARCH_CANDIDATE_LIMIT = 1000;

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

const productSearchFields = (product: any) => [
  { value: product.codigo, weight: 2 },
  { value: product.codigoRepuesto, weight: 1.9 },
  { value: product.descripcion, weight: 1.5 },
  { value: product.descripcionDetallada, weight: 0.8 },
  { value: product.ubicacion, weight: 1.25 },
  { value: product.marca, weight: 1 },
  { value: product.categoria?.nombre, weight: 0.9 },
  { value: product.sucursal?.nombre, weight: 0.7 },
];

const trackedProductFields: Record<string, string> = {
  codigo: 'Codigo',
  codigoRepuesto: 'Codigo repuesto',
  descripcion: 'Descripcion',
  descripcionDetallada: 'Descripcion detallada',
  marca: 'Marca',
  condicion: 'Condicion',
  unidadVenta: 'Unidad de venta',
  stockMinimo: 'Stock minimo',
  ubicacion: 'Estante',
  activo: 'Activo',
  estado: 'Estado',
  precioCompra: 'Precio compra',
  precioVenta: 'Precio venta',
  imagen: 'Imagen principal',
  proveedorId: 'Proveedor',
  categoriaId: 'Categoria',
  sucursalId: 'Sucursal',
};

const valuesAreEqual = (before: unknown, after: unknown) => {
  if (before === after) return true;
  if (before === null || before === undefined) return after === null || after === undefined || after === '';
  if (after === null || after === undefined) return before === null || before === undefined || before === '';
  return String(before) === String(after);
};

const buildProductChanges = (before: Record<string, unknown>, after: Record<string, unknown>) =>
  Object.entries(trackedProductFields).flatMap(([field, label]) => {
    if (!(field in after)) return [];
    const previousValue = before[field] ?? null;
    const nextValue = after[field] ?? null;
    if (valuesAreEqual(previousValue, nextValue)) return [];
    return [{ campo: field, etiqueta: label, anterior: previousValue, nuevo: nextValue }];
  });

export class ProductService {
  private buildSearchFilter(search: string): Prisma.ProductoWhereInput {
    const terms = getSearchTerms(search).slice(0, 6);
    if (terms.length === 0) return {};

    return {
      AND: terms.map((term) => ({
        OR: [
          { codigo: { contains: term, mode: 'insensitive' as const } },
          { codigoRepuesto: { contains: term, mode: 'insensitive' as const } },
          { descripcion: { contains: term, mode: 'insensitive' as const } },
          { descripcionDetallada: { contains: term, mode: 'insensitive' as const } },
          { ubicacion: { contains: term, mode: 'insensitive' as const } },
          { marca: { contains: term, mode: 'insensitive' as const } },
          { categoria: { nombre: { contains: term, mode: 'insensitive' as const } } },
          { sucursal: { nombre: { contains: term, mode: 'insensitive' as const } } },
        ],
      })),
    };
  }

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
      ubicacion: branchStock.ubicacion || product.ubicacion,
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
    const search = typeof params.search === 'string' ? params.search.trim() : '';
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
    const baseWhere: Prisma.ProductoWhereInput = {
      ...where,
      ...(and.length > 0 ? { AND: [...and] } : {}),
    };
    if (search) and.push(this.buildSearchFilter(search));
    if (and.length > 0) where.AND = and;

    if (search) {
      const candidateLimit = Math.min(Math.max(page * limit * 4, 200), SEARCH_CANDIDATE_LIMIT);
      let candidates = await prisma.producto.findMany({
        where,
        include: productInclude,
        take: candidateLimit,
        orderBy: { codigo: 'asc' },
      });
      if (candidates.length === 0) {
        candidates = await prisma.producto.findMany({
          where: baseWhere,
          include: productInclude,
          take: candidateLimit,
          orderBy: { codigo: 'asc' },
        });
      }
      const matchedItems = filterAndSortBySearch(
        candidates.map((item) => this.applySucursalStock(item, params.sucursalId)),
        search,
        productSearchFields,
        (product) => product.descripcion,
      );
      const total = matchedItems.length;
      const start = (page - 1) * limit;
      const items = matchedItems.slice(start, start + limit);
      return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    const [items, total] = await Promise.all([
      prisma.producto.findMany({
        where,
        include: productInclude,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { codigo: 'asc' },
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
    const baseWhere: Prisma.ProductoWhereInput = { estado: 'ACTIVO', activo: true };
    const where: Prisma.ProductoWhereInput = { ...baseWhere };
    const search = typeof params.search === 'string' ? params.search.trim() : '';
    if (search) where.AND = [this.buildSearchFilter(search)];

    let products = await prisma.producto.findMany({
      where,
      select: {
        id: true,
        codigo: true,
        codigoRepuesto: true,
        descripcion: true,
        descripcionDetallada: true,
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
          select: { id: true, sucursalId: true, stock: true, ubicacion: true, activo: true, estado: true, sucursal: { select: { id: true, nombre: true, whatsapp: true } } },
          orderBy: { createdAt: 'asc' },
        },
        createdAt: true,
        categoria: { select: { id: true, nombre: true } },
        sucursal: { select: { id: true, nombre: true, whatsapp: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: search ? SEARCH_CANDIDATE_LIMIT : 100,
    });
    if (search && products.length === 0) {
      products = await prisma.producto.findMany({
        where: baseWhere,
        select: {
          id: true,
          codigo: true,
          codigoRepuesto: true,
          descripcion: true,
          descripcionDetallada: true,
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
            select: { id: true, sucursalId: true, stock: true, ubicacion: true, activo: true, estado: true, sucursal: { select: { id: true, nombre: true, whatsapp: true } } },
            orderBy: { createdAt: 'asc' },
          },
          createdAt: true,
          categoria: { select: { id: true, nombre: true } },
          sucursal: { select: { id: true, nombre: true, whatsapp: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: SEARCH_CANDIDATE_LIMIT,
      });
    }
    const items = search
      ? filterAndSortBySearch(products, search, productSearchFields, (product) => product.descripcion)
      : products;
    return items.slice(0, 100);
  }

  async create(data: Prisma.ProductoUncheckedCreateInput & { deletedImageUrls?: string[] }, usuarioId?: string | null) {
    if (typeof data.codigoRepuesto === 'string') {
      data.codigoRepuesto = data.codigoRepuesto.trim() || null;
    }
    if (typeof data.descripcionDetallada === 'string') {
      data.descripcionDetallada = data.descripcionDetallada.trim() || null;
    }
    data.marca = typeof data.marca === 'string' && data.marca.trim()
      ? data.marca.trim()
      : DEFAULT_PRODUCT_BRAND;
    const initialStock = typeof data.stock === 'number' ? data.stock : 0;
    
    // Remove deletedImageUrls so it's not passed to Prisma during creation
    const { deletedImageUrls, ...createData } = data as any;

    return prisma.$transaction(async (tx) => {
      createData.codigo = await this.nextSequentialCode(tx);
      const product = await tx.producto.create({
        data: { ...createData, stock: initialStock },
        include: productInclude,
      });
      await tx.productoStockSucursal.create({
        data: {
          productoId: product.id,
          sucursalId: data.sucursalId,
          stock: initialStock,
          ubicacion: product.ubicacion,
        },
      });
      if (initialStock > 0) {
        await stockService.recordMovement(tx, {
          tipoMovimiento: 'AJUSTE',
          productoId: product.id,
          sucursalId: data.sucursalId,
          stockAnterior: 0,
          stockNuevo: initialStock,
          cantidad: initialStock,
          usuarioId,
          referenciaTipo: 'ALTA_PRODUCTO',
          notas: 'Stock inicial al crear producto',
        });
      }
      await productAuditService.record(tx, {
        accion: 'CREADO',
        productoId: product.id,
        codigo: product.codigo,
        descripcion: product.descripcion,
        sucursalId: data.sucursalId,
        usuarioId,
        stockAnterior: 0,
        stockNuevo: initialStock,
        cantidad: initialStock,
        estadoNuevo: product.estado,
        detalle: 'Producto creado en inventario',
        cambios: {
          codigo: product.codigo,
          codigoRepuesto: product.codigoRepuesto,
          descripcion: product.descripcion,
          marca: product.marca,
          condicion: product.condicion,
          unidadVenta: product.unidadVenta,
          stockInicial: initialStock,
          stockMinimo: product.stockMinimo,
          ubicacion: product.ubicacion,
          precioCompra: product.precioCompra,
          precioVenta: product.precioVenta,
          categoriaId: product.categoriaId,
          proveedorId: product.proveedorId,
        },
      });
      return tx.producto.findUnique({
        where: { id: product.id },
        include: productInclude,
      });
    });
  }

  async update(id: string, data: Prisma.ProductoUncheckedUpdateInput & { deletedImageUrls?: string[] }, usuarioId?: string | null) {
    const current = await prisma.producto.findUnique({
      where: { id },
      select: {
        codigo: true,
        codigoRepuesto: true,
        descripcion: true,
        descripcionDetallada: true,
        marca: true,
        condicion: true,
        unidadVenta: true,
        stockMinimo: true,
        ubicacion: true,
        activo: true,
        estado: true,
        precioCompra: true,
        precioVenta: true,
        imagen: true,
        proveedorId: true,
        categoriaId: true,
        sucursalId: true,
      },
    });
    if (!current) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });

    const nextCodigo = typeof data.codigo === 'string' ? data.codigo.trim() : current.codigo;
    const nextSucursalId = typeof data.sucursalId === 'string' ? data.sucursalId : current.sucursalId;
    const nextStock = typeof data.stock === 'number' ? data.stock : undefined;

    if (typeof data.codigo === 'string') data.codigo = nextCodigo;
    if (typeof data.codigoRepuesto === 'string') data.codigoRepuesto = data.codigoRepuesto.trim() || null;
    if (typeof data.descripcionDetallada === 'string') data.descripcionDetallada = data.descripcionDetallada.trim() || null;
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
        if (
          (current.imagen && data.deletedImageUrls.includes(current.imagen)) ||
          (updateData.imagen && data.deletedImageUrls.includes(updateData.imagen))
        ) {
          const remainingImages = await tx.productoImagen.findMany({
            where: { productoId: id },
            orderBy: { orden: 'asc' },
          });
          updateData.imagen = remainingImages.length > 0 ? remainingImages[0].url : null;
        }
      }

      const updatedBase = await tx.producto.update({
        where: { id },
        data: updateData,
      });

      const changes = buildProductChanges(current as any, updatedBase as any);
      const deletedImages = data.deletedImageUrls?.length ? [...data.deletedImageUrls] : [];
      if (changes.length > 0 || deletedImages.length > 0) {
        await productAuditService.record(tx, {
          accion: 'EDITADO',
          productoId: id,
          codigo: updatedBase.codigo,
          descripcion: updatedBase.descripcion,
          sucursalId: nextSucursalId,
          usuarioId,
          estadoAnterior: current.estado,
          estadoNuevo: updatedBase.estado,
          detalle: [
            changes.length > 0 ? `Campos editados: ${changes.map((change) => change.etiqueta).join(', ')}` : null,
            deletedImages.length > 0 ? `${deletedImages.length} imagen(es) eliminada(s)` : null,
          ].filter(Boolean).join('. '),
          cambios: { campos: changes, imagenesEliminadas: deletedImages },
        });
      }

      if (nextStock !== undefined || nextSucursalId !== current.sucursalId) {
        const existingStock = await tx.productoStockSucursal.findUnique({
          where: { productoId_sucursalId: { productoId: id, sucursalId: nextSucursalId } },
        });
        const stockAnterior = existingStock?.stock ?? 0;
        const stockNuevo = nextStock ?? stockAnterior;
        await tx.productoStockSucursal.upsert({
          where: { productoId_sucursalId: { productoId: id, sucursalId: nextSucursalId } },
          update: { stock: stockNuevo },
          create: {
            productoId: id,
            sucursalId: nextSucursalId,
            stock: stockNuevo,
          },
        });
        await this.syncProductTotalStock(tx, id);

        if (nextStock !== undefined && stockNuevo !== stockAnterior) {
          await stockService.recordMovement(tx, {
            tipoMovimiento: 'AJUSTE',
            productoId: id,
            sucursalId: nextSucursalId,
            stockAnterior,
            stockNuevo,
            cantidad: stockNuevo - stockAnterior,
            usuarioId,
            referenciaTipo: 'EDICION_STOCK_ADMIN',
            notas: 'Ajuste manual desde edicion de producto',
          });
          await productAuditService.record(tx, {
            accion: 'STOCK_AJUSTADO',
            productoId: id,
            codigo: updatedBase.codigo,
            descripcion: updatedBase.descripcion,
            sucursalId: nextSucursalId,
            usuarioId,
            stockAnterior,
            stockNuevo,
            cantidad: stockNuevo - stockAnterior,
            detalle: 'Stock ajustado desde edicion de producto',
          });
        }
      }

      return tx.producto.findUnique({
        where: { id },
        include: productInclude,
      });
    });
  }

  async addStock(id: string, data: { sucursalId: string; cantidad: number; ubicacion?: string | null; usuarioId?: string | null; notas?: string | null }) {
    const product = await prisma.$transaction(async (tx) => {
      const current = await tx.producto.findUnique({
        where: { id },
        include: { stockSucursales: true },
      });
      if (!current) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });

      const branchStock = current.stockSucursales.find((item) => item.sucursalId === data.sucursalId);
      const stockAnterior = branchStock?.stock ?? 0;
      const stockNuevo = stockAnterior + data.cantidad;
      const fallbackUbicacion = current.sucursalId === data.sucursalId ? current.ubicacion : null;
      const ubicacion = typeof data.ubicacion === 'string'
        ? data.ubicacion.trim() || fallbackUbicacion
        : branchStock?.ubicacion || fallbackUbicacion;

      await tx.productoStockSucursal.upsert({
        where: { productoId_sucursalId: { productoId: id, sucursalId: data.sucursalId } },
        update: { stock: stockNuevo, ubicacion },
        create: {
          productoId: id,
          sucursalId: data.sucursalId,
          stock: stockNuevo,
          ubicacion,
          activo: true,
          estado: 'ACTIVO',
        },
      });
      await this.syncProductTotalStock(tx, id);

      if (data.cantidad > 0) {
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
      }
      await productAuditService.record(tx, {
        accion: 'STOCK_AGREGADO',
        productoId: id,
        codigo: current.codigo,
        descripcion: current.descripcion,
        sucursalId: data.sucursalId,
        usuarioId: data.usuarioId,
        stockAnterior,
        stockNuevo,
        cantidad: data.cantidad,
        detalle: data.notas || (data.cantidad > 0 ? 'Stock agregado manualmente' : 'Sucursal preparada con stock cero'),
      });

      return tx.producto.findUnique({
        where: { id },
        include: productInclude,
      });
    });

    return product;
  }

  async updateBranchStatus(id: string, sucursalId: string, estado: ProductStatus, usuarioId?: string | null) {
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

      await productAuditService.record(tx, {
        accion: 'ESTADO_CAMBIADO',
        productoId: id,
        codigo: current.codigo,
        descripcion: current.descripcion,
        sucursalId,
        usuarioId,
        stockAnterior: branch.stock,
        stockNuevo: branch.stock,
        estadoAnterior: branch.estado,
        estadoNuevo: estado,
        detalle: `Estado de sucursal cambiado a ${estado}`,
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

  async addImages(id: string, images: Array<{ url: string; publicId?: string; orden?: number }>, usuarioId?: string | null) {
    if (images.length === 0) return this.getById(id);

    return prisma.$transaction(async (tx) => {
      const product = await tx.producto.findUnique({
        where: { id },
        select: { id: true, codigo: true, descripcion: true, sucursalId: true, imagen: true },
      });
      if (!product) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });

      const currentCount = await tx.productoImagen.count({ where: { productoId: id } });
      await tx.productoImagen.createMany({
        data: images.map((image, index) => ({
          productoId: id,
          url: image.url,
          publicId: image.publicId,
          orden: image.orden ?? currentCount + index,
        })),
      });

      if (!product.imagen && images[0]?.url) {
        await tx.producto.update({ where: { id }, data: { imagen: images[0].url } });
      }

      await productAuditService.record(tx, {
        accion: 'EDITADO',
        productoId: id,
        codigo: product.codigo,
        descripcion: product.descripcion,
        sucursalId: product.sucursalId,
        usuarioId,
        detalle: images.length === 1 ? 'Imagen agregada al producto' : `${images.length} imagenes agregadas al producto`,
        cambios: {
          imagenesAgregadas: images.map((image) => ({
            url: image.url,
            publicId: image.publicId || null,
          })),
        },
      });

      return tx.producto.findUnique({ where: { id }, include: productInclude });
    });
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
        await productAuditService.record(tx, {
          accion: 'ELIMINADO',
          productoId: id,
          codigo: current.codigo,
          descripcion: current.descripcion,
          sucursalId: branch.sucursalId,
          usuarioId: data.usuarioId || null,
          stockAnterior: branch.stock,
          stockNuevo: 0,
          cantidad: -branch.stock,
          estadoAnterior: branch.estado,
          estadoNuevo: 'INACTIVO',
          detalle: data.motivo.trim(),
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

  async restore(id: string, usuarioId?: string | null) {
    const current = await prisma.producto.findUnique({
      where: { id },
      select: { codigo: true, descripcion: true, sucursalId: true, stock: true, estado: true },
    });
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
      const restored = await tx.producto.findUnique({ where: { id }, select: { stock: true, estado: true } });
      await productAuditService.record(tx, {
        accion: 'RESTAURADO',
        productoId: id,
        codigo: current.codigo,
        descripcion: current.descripcion,
        sucursalId: current.sucursalId,
        usuarioId,
        stockAnterior: current.stock,
        stockNuevo: restored?.stock ?? current.stock,
        estadoAnterior: current.estado,
        estadoNuevo: restored?.estado ?? 'ACTIVO',
        detalle: 'Producto restaurado al inventario activo',
      });
      return tx.producto.findUnique({ where: { id }, include: productInclude });
    });
  }

  async discontinue(id: string, usuarioId?: string | null) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.producto.findUnique({
        where: { id },
        select: { codigo: true, descripcion: true, sucursalId: true, stock: true, estado: true },
      });
      if (!current) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });
      await tx.productoStockSucursal.updateMany({
        where: { productoId: id },
        data: { activo: false, estado: 'DESCONTINUADO' },
      });
      await tx.producto.update({
        where: { id },
        data: { activo: false, estado: 'DESCONTINUADO', stock: 0 },
      });
      await productAuditService.record(tx, {
        accion: 'DESCONTINUADO',
        productoId: id,
        codigo: current.codigo,
        descripcion: current.descripcion,
        sucursalId: current.sucursalId,
        usuarioId,
        stockAnterior: current.stock,
        stockNuevo: 0,
        cantidad: -current.stock,
        estadoAnterior: current.estado,
        estadoNuevo: 'DESCONTINUADO',
        detalle: 'Producto marcado como descontinuado',
      });
      return tx.producto.findUnique({ where: { id }, include: productInclude });
    });
  }
}
