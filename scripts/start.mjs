import { cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const standalone = join(root, '.next', 'standalone');
const server = join(standalone, 'server.js');

if (!existsSync(server)) {
  console.error('Production build not found. Run `npm run build` before `npm start`.');
  process.exit(1);
}

if (existsSync(join(root, 'public'))) {
  cpSync(join(root, 'public'), join(standalone, 'public'), { recursive: true });
}
if (existsSync(join(root, '.next', 'static'))) {
  cpSync(join(root, '.next', 'static'), join(standalone, '.next', 'static'), { recursive: true });
}

const child = spawn(process.execPath, [server], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: process.env.PORT ?? '3000',
    HOSTNAME: process.env.HOSTNAME ?? '0.0.0.0',
  },
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
