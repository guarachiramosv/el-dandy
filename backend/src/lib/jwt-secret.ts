export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'dev-secret-change-me') {
    throw new Error('JWT_SECRET debe estar configurado con una clave privada segura');
  }
  return secret;
}
