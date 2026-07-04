import bcrypt from 'bcryptjs';
import { DebtStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

type CustomerInput = {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  empresa?: string | null;
  ciudad?: string | null;
  nit?: string | null;
  direccion?: string | null;
  notas?: string | null;
  activo?: boolean;
};

type CustomerRegisterInput = {
  nombre: string;
  email: string;
  password: string;
  telefono?: string | null;
  ciudad?: string | null;
  nit?: string | null;
  direccion?: string | null;
};

const SALT_ROUNDS = 10;

export class CustomerService {
  private includeSummary = {
    ventas: {
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        detalles: { include: { producto: true } },
      },
    },
    cuentas: {
      orderBy: { createdAt: 'desc' },
      include: { pagos: true },
    },
  } satisfies Prisma.ClienteInclude;

  async getAll(params: { search?: string; activo?: boolean }) {
    const where: Prisma.ClienteWhereInput = {};
    if (params.activo !== undefined) where.activo = params.activo;
    if (params.search) {
      where.OR = [
        { nombre: { contains: params.search, mode: 'insensitive' } },
        { telefono: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { empresa: { contains: params.search, mode: 'insensitive' } },
        { ciudad: { contains: params.search, mode: 'insensitive' } },
        { nit: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const clientes = await prisma.cliente.findMany({
      where,
      include: this.includeSummary,
      orderBy: { createdAt: 'desc' },
    });

    return clientes.map((cliente) => this.toSummary(cliente));
  }

  async getById(id: string) {
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        ventas: {
          orderBy: { createdAt: 'desc' },
          include: {
            usuario: { select: { id: true, nombre: true } },
            sucursal: true,
            detalles: { include: { producto: true } },
            cuenta: { include: { pagos: true } },
          },
        },
        cuentas: {
          orderBy: { createdAt: 'desc' },
          include: { pagos: true, venta: true },
        },
      },
    });
    return cliente ? this.toSummary(cliente) : null;
  }

  async create(data: CustomerInput) {
    return prisma.cliente.create({
      data: this.clean(data),
      include: this.includeSummary,
    }).then((cliente) => this.toSummary(cliente));
  }

  async register(data: CustomerRegisterInput) {
    const email = data.email.trim().toLowerCase();
    const existing = await prisma.cliente.findUnique({ where: { email } });
    if (existing) {
      throw Object.assign(new Error('Ya existe un cliente registrado con ese email'), { status: 409 });
    }

    const password = await bcrypt.hash(data.password, SALT_ROUNDS);
    return prisma.cliente.create({
      data: this.clean({
        nombre: data.nombre.trim(),
        email,
        password,
        telefono: data.telefono,
        ciudad: data.ciudad,
        nit: data.nit,
        direccion: data.direccion,
        activo: true,
      }),
      include: this.includeSummary,
    }).then((cliente) => this.toSummary(cliente));
  }

  async verifyLogin(email: string, password: string) {
    const cliente = await prisma.cliente.findUnique({ where: { email } });
    if (!cliente || !cliente.activo || !cliente.password) return null;
    const valid = await bcrypt.compare(password, cliente.password);
    return valid ? this.toSummary(cliente) : null;
  }

  async getPurchaseHistory(clienteId: string) {
    return prisma.venta.findMany({
      where: { clienteId },
      include: {
        sucursal: { select: { id: true, nombre: true } },
        cuenta: { include: { pagos: true } },
        detalles: {
          include: {
            producto: {
              select: {
                id: true,
                codigo: true,
                descripcion: true,
                marca: true,
                condicion: true,
                imagen: true,
                precioVenta: true,
                categoria: { select: { id: true, nombre: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: Partial<CustomerInput>) {
    return prisma.cliente.update({
      where: { id },
      data: this.clean(data),
      include: this.includeSummary,
    }).then((cliente) => this.toSummary(cliente));
  }

  async delete(id: string) {
    return prisma.cliente.update({
      where: { id },
      data: { activo: false },
    });
  }

  async addPayment(cuentaId: string, data: { monto: number; metodoPago: any; usuarioId: string; notas?: string | null }) {
    return prisma.$transaction(async (tx) => {
      const cuenta = await tx.cuentaCobrar.findUnique({ where: { id: cuentaId } });
      if (!cuenta) throw Object.assign(new Error('Cuenta por cobrar no encontrada'), { status: 404 });
      if (data.monto > cuenta.saldo) {
        throw Object.assign(new Error(`El pago excede el saldo pendiente de Bs ${cuenta.saldo}`), { status: 400 });
      }

      const montoPagado = cuenta.montoPagado + data.monto;
      const saldo = Math.max(cuenta.saldo - data.monto, 0);
      const estado: DebtStatus = saldo === 0 ? 'PAGADA' : 'PARCIAL';

      await tx.pagoCredito.create({
        data: {
          cuentaId,
          monto: data.monto,
          metodoPago: data.metodoPago,
          usuarioId: data.usuarioId,
          notas: data.notas,
        },
      });

      return tx.cuentaCobrar.update({
        where: { id: cuentaId },
        data: { montoPagado, saldo, estado },
        include: { pagos: true, cliente: true, venta: true },
      });
    });
  }

  private clean<T extends Partial<CustomerInput & { password: string }>>(data: T) {
    return {
      ...data,
      email: data.email === '' ? null : data.email,
    };
  }

  private toSummary(cliente: any) {
    const { password: _password, ...safeCliente } = cliente;
    const ventas = cliente.ventas ?? [];
    const cuentas = cliente.cuentas ?? [];
    const totalGastado = ventas.reduce((sum: number, venta: any) => sum + venta.total, 0);
    const saldoPendiente = cuentas.reduce((sum: number, cuenta: any) => sum + cuenta.saldo, 0);
    return {
      ...safeCliente,
      totalGastado,
      saldoPendiente,
      cantidadCompras: ventas.length,
      clienteFrecuente: ventas.length >= 3 || totalGastado >= 3000,
      ultimosPedidos: ventas.slice(0, 5),
    };
  }
}
