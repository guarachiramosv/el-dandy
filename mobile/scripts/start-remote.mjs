import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const apiUrl = 'https://sistema-el-dandy.onrender.com/api';
writeFileSync('.env', `EXPO_PUBLIC_API_URL=${apiUrl}\n`);

console.log(`API movil: ${apiUrl}`);
console.log('Iniciando Expo con backend publico...');

const mode = process.argv[2];
const expoArgs = ['start', '--clear'];
if (mode === '--lan' || mode === '--tunnel') {
  expoArgs.push(mode);
}

const expoCommand = process.platform === 'win32'
  ? `node_modules\\.bin\\expo.cmd ${expoArgs.join(' ')}`
  : `npx expo ${expoArgs.join(' ')}`;

const expo = spawn(
  process.platform === 'win32' ? 'cmd.exe' : 'sh',
  process.platform === 'win32'
    ? ['/d', '/s', '/c', expoCommand]
    : ['-c', expoCommand],
  { stdio: 'inherit' },
);

expo.on('exit', (code) => process.exit(code ?? 0));
