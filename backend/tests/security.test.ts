import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import express from 'express';
import { once } from 'node:events';
import { prisma } from '../src/lib/prisma';
import { requireAuth, requireAdmin, requireCustomer } from '../src/middlewares/auth';
import { getJwtSecret } from '../src/lib/jwt-secret';
import { authRateLimit } from '../src/middlewares/authRateLimit';
import categoryRoutes from '../src/routes/category.routes';
import providerRoutes from '../src/routes/provider.routes';
import sucursalRoutes from '../src/routes/sucursal.routes';
import uploadRoutes from '../src/routes/upload.routes';
import reportRoutes from '../src/routes/report.routes';
import { errorHandler } from '../src/middlewares/errorHandler';

process.env.JWT_SECRET = 'isolated-test-secret-never-used-in-production';
const userId = '11111111-1111-4111-8111-111111111111';
const token = (role = 'SELLER', options: jwt.SignOptions = {}) => jwt.sign({ id: userId, role, sucursalId: 'old-branch' }, getJwtSecret(), { expiresIn: '1h', ...options });

async function withServer(app: express.Express, run: (base: string) => Promise<void>) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${(server.address() as any).port}`); }
  finally { await new Promise<void>((resolve, reject) => { server.close(e => e ? reject(e) : resolve()); server.closeAllConnections(); }); }
}

test('internal access rejects missing, expired, wrong algorithm, customer and disabled sessions; uses current permissions', async () => {
  const original = prisma.usuario.findUnique;
  let active = true;
  (prisma.usuario as any).findUnique = async () => ({ id: userId, role: 'SELLER', sucursalId: 'current-branch', activo: active });
  const app = express();
  app.get('/internal', requireAuth, (req, res) => res.json(req.user));
  app.get('/admin', requireAuth, requireAdmin, (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  try { await withServer(app, async base => {
    assert.equal((await fetch(`${base}/internal`)).status, 401);
    for (const bad of [token('SELLER', { expiresIn: -1 }), token('SELLER', { algorithm: 'HS384' }), 'invalid']) {
      assert.equal((await fetch(`${base}/internal`, { headers: { Authorization: `Bearer ${bad}` } })).status, 401);
    }
    assert.equal((await fetch(`${base}/internal`, { headers: { Authorization: `Bearer ${token('CUSTOMER')}` } })).status, 403);
    const response = await fetch(`${base}/internal`, { headers: { Authorization: `Bearer ${token('ADMIN')}` } });
    assert.deepEqual(await response.json(), { id: userId, role: 'SELLER', sucursalId: 'current-branch' });
    assert.equal((await fetch(`${base}/admin`, { headers: { Authorization: `Bearer ${token('ADMIN')}` } })).status, 403);
    active = false;
    assert.equal((await fetch(`${base}/internal`, { headers: { Authorization: `Bearer ${token()}` } })).status, 401);
  }); } finally { prisma.usuario.findUnique = original; }
});

test('seller cannot change catalogs, branches, upload product images or read admin reports', async () => {
  const original = prisma.usuario.findUnique;
  (prisma.usuario as any).findUnique = async () => ({ id: userId, role: 'SELLER', sucursalId: 'branch', activo: true });
  const app = express();
  app.use('/categories', requireAuth, categoryRoutes);
  app.use('/providers', requireAuth, providerRoutes);
  app.use('/branches', requireAuth, sucursalRoutes);
  app.use('/uploads', requireAuth, uploadRoutes);
  app.use('/reports', requireAuth, requireAdmin, reportRoutes);
  try { await withServer(app, async base => {
    for (const [method, path] of [['POST','/categories'],['PUT','/categories/id'],['DELETE','/categories/id'],['POST','/providers'],['PUT','/providers/id'],['DELETE','/providers/id'],['POST','/branches'],['PUT','/branches/id'],['DELETE','/branches/id'],['POST','/uploads/products/id/image'],['POST','/uploads/products/id/images'],['GET','/reports/sales-history']]) {
      assert.equal((await fetch(base + path, { method, headers: { Authorization: `Bearer ${token()}` } })).status, 403, `${method} ${path}`);
    }
  }); } finally { prisma.usuario.findUnique = original; }
});

test('inactive customer cannot reuse a valid session', async () => {
  const original = prisma.cliente.findUnique;
  (prisma.cliente as any).findUnique = async () => ({ id: userId, activo: false });
  const app = express(); app.get('/', requireCustomer, (_req, res) => res.json({ ok: true }));
  try { await withServer(app, async base => {
    assert.equal((await fetch(base, { headers: { Authorization: `Bearer ${token('CUSTOMER')}` } })).status, 401);
  }); } finally { prisma.cliente.findUnique = original; }
});

test('login attempts are limited without calling account services', async () => {
  const app = express(); app.post('/login', authRateLimit, (_req, res) => res.status(401).json({ success: false }));
  await withServer(app, async base => {
    for (let i = 0; i < 30; i++) assert.equal((await fetch(`${base}/login`, { method: 'POST' })).status, 401);
    const denied = await fetch(`${base}/login`, { method: 'POST' });
    assert.equal(denied.status, 429);
    assert.ok(denied.headers.get('retry-after'));
  });
});

test('missing or public default JWT secret fails closed', () => {
  const original = process.env.JWT_SECRET;
  try {
    delete process.env.JWT_SECRET;
    assert.throws(getJwtSecret);
    process.env.JWT_SECRET = 'dev-secret-change-me';
    assert.throws(getJwtSecret);
  } finally { process.env.JWT_SECRET = original; }
});
