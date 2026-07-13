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
  console.error('No se encontro una conexion de red local activa.');
  process.exit(1);
}

const apiUrl = `http://${privateIpv4.address}:4000/api`;
writeFileSync('.env', `EXPO_PUBLIC_API_URL=${apiUrl}\n`);

console.log(`API movil: ${apiUrl}`);
console.log('Iniciando Expo por red local...');

const expoCommand = process.platform === 'win32'
  ? 'node_modules\\.bin\\expo.cmd start --lan --clear'
  : 'npx expo start --lan --clear';
const expo = spawn(
  process.platform === 'win32' ? 'cmd.exe' : 'sh',
  process.platform === 'win32'
    ? ['/d', '/s', '/c', expoCommand]
    : ['-c', expoCommand],
  {
  stdio: 'inherit',
  },
);

expo.on('exit', (code) => process.exit(code ?? 0));
