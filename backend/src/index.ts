import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma';
import categoryRoutes from './routes/category.routes';
import productRoutes from './routes/product.routes';
import userRoutes from './routes/user.routes';
import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import sucursalRoutes from './routes/sucursal.routes';
import saleRoutes from './routes/sale.routes';
import customerRoutes from './routes/customer.routes';
import providerRoutes from './routes/provider.routes';
import purchaseRoutes from './routes/purchase.routes';
import inventoryRoutes from './routes/inventory.routes';
import uploadRoutes from './routes/upload.routes';
import reportRoutes from './routes/report.routes';
import remachadoRoutes from './routes/remachado.routes';
import { errorHandler } from './middlewares/errorHandler';
import { requireAuth, requireAdmin } from './middlewares/auth';

dotenv.config();

const app = express();

app.use(cors({ origin: '*' }));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// ─── Health ─────────────────────────────────────────────
app.get('/api/health', async (_req: Request, res: Response) => {
  let dbConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
  } catch (e) {
    console.error('DB connection error:', e);
  }
  res.json({ status: 'OK', databaseConnected: dbConnected, timestamp: new Date().toISOString() });
});

app.get('/', (_req: Request, res: Response) => {
  res.send('<h1>🚀 Backend El Dandy ERP is running</h1>');
});

// ─── API Routes ──────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/categories', requireAuth, categoryRoutes);
app.use('/api/products', requireAuth, productRoutes);
app.use('/api/users', requireAuth, requireAdmin, userRoutes);
app.use('/api/sucursales', requireAuth, sucursalRoutes);
app.use('/api/sales', requireAuth, saleRoutes);
app.use('/api/customers', requireAuth, customerRoutes);
app.use('/api/providers', requireAuth, providerRoutes);
app.use('/api/purchases', requireAuth, purchaseRoutes);
app.use('/api/inventory', requireAuth, inventoryRoutes);
app.use('/api/remachado', requireAuth, remachadoRoutes);
app.use('/api/upload', requireAuth, uploadRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/reports', requireAuth, requireAdmin, reportRoutes);

// ─── Global Error Handler ────────────────────────────────
app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────
const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => console.log(`🚀 Backend El Dandy → http://localhost:${PORT}`));

// ─── Graceful Shutdown ───────────────────────────────────
process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });
