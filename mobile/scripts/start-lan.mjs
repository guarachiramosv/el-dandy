import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const privateIpv4 = Object.values(networkInterfaces())
  .flat()
  .filter(Boolean)
  .find((address) => {
    if (address.family !== 'IPv4' || address.internal) return false;
    return (
      address.address.startsWith('10.') ||
      address.address.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(address.address)
    );
  });

if (!privateIpv4) {
  console.error('No se encontró una conexión de red local activa.');
  process.exit(1);
}

const apiUrl = `http://${privateIpv4.address}:4000/api`;
writeFileSync('.env', `EXPO_PUBLIC_API_URL=${apiUrl}\n`);

console.log(`API móvil: ${apiUrl}`);
console.log('Iniciando Expo por red local...');

const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const expo = spawn(executable, ['expo', 'start', '--lan', '--clear'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

expo.on('exit', (code) => process.exit(code ?? 0));
