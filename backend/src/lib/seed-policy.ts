export function seedCredentials(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === 'production' || env.RENDER) throw new Error('La carga de usuarios de prueba esta deshabilitada en produccion.');
  const admin = env.SEED_ADMIN_PASSWORD;
  const seller = env.SEED_SELLER_PASSWORD;
  if (!admin || !seller || admin.length < 12 || seller.length < 12) {
    throw new Error('Configura SEED_ADMIN_PASSWORD y SEED_SELLER_PASSWORD con al menos 12 caracteres para una base de desarrollo.');
  }
  return { admin, seller };
}
