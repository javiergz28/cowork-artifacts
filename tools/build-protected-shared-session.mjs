import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.STATICRYPT_PASSWORD) throw new Error('Falta la contraseña temporal de generación.');

function run(script, args = []) {
  const result = spawnSync(process.execPath, [join(repoRoot, 'tools', script), ...args], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('build-protected-home.mjs');
run('build-protected-cycle.mjs', ['2026-09-15']);
run('build-protected-stock-position.mjs');
run('check-shared-staticrypt-session.mjs');
console.log('Las tres entradas principales usan una única sesión protegida.');
