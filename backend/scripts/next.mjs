// Starts Next.js on the PORT defined in .env / .env.local (Next's CLI reads the port before it loads .env files).
// Usage: node scripts/next.mjs dev|start
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_PORT = '4000';

for (const file of ['.env', '.env.local']) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || m[1] in process.env) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const mode = process.argv[2] === 'start' ? 'start' : 'dev';
const port = process.env.PORT || DEFAULT_PORT;
const bin = path.resolve('node_modules', 'next', 'dist', 'bin', 'next');
console.log(`> next ${mode} on port ${port}`);
const child = spawn(process.execPath, [bin, mode, '-p', port], { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 0));
