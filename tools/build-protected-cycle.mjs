import { mkdir, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sharedStaticryptSalt, staticryptSaltFrom } from './shared-staticrypt.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localRoot = join(repoRoot, '_local', 'ciclos');
const staticryptCli = join(repoRoot, 'node_modules', 'staticrypt', 'cli', 'index.js');
const cycle = process.argv[2];

function safeCycle(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    throw new Error('Indicá el ciclo como AAAA-MM-DD.');
  }
  return value;
}

function inside(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  if (!rel || rel === '..' || rel.startsWith('..' + sep)) throw new Error(`Ruta de trabajo insegura: ${child}`);
}

if (!process.env.STATICRYPT_PASSWORD) {
  throw new Error('Falta la contraseña temporal de generación. No se creó ninguna salida.');
}

const cycleName = safeCycle(cycle);
const cycleRoot = join(localRoot, cycleName);
const source = join(cycleRoot, 'fuente', 'index.html');
const output = join(cycleRoot, 'protegido');
inside(localRoot, source);
inside(localRoot, output);

const sourceHtml = await readFile(source, 'utf8');
if (!sourceHtml.includes('data-cycle-private="true"')) {
  throw new Error('La fuente no tiene la marca privada esperada; se canceló la generación.');
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const salt = await sharedStaticryptSalt(repoRoot);

const result = spawnSync(process.execPath, [
  staticryptCli,
  source,
  '--directory', output,
  '--config', 'false',
  '--salt', salt,
  '--short',
  '--remember', '30',
  '--template-title', 'Multitrend · Ciclo privado',
  '--template-instructions', 'Ingresá la contraseña compartida para abrir este ciclo.',
  '--template-button', 'Abrir ciclo',
  '--template-placeholder', 'Contraseña',
  '--template-remember', 'Recordarme durante 30 días',
  '--template-error', 'La contraseña no es correcta.'
], { cwd: repoRoot, env: process.env, stdio: 'inherit' });

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const protectedHtml = await readFile(join(output, 'index.html'), 'utf8');
if (!protectedHtml.includes('staticryptEncryptedMsgUniqueVariableName') || protectedHtml.includes('data-cycle-private="true"')) {
  throw new Error('La salida no quedó cifrada correctamente.');
}
if (staticryptSaltFrom(protectedHtml, `el ciclo ${cycleName} generado`) !== salt) {
  throw new Error('El ciclo no usa la sesión compartida; se canceló la salida.');
}

console.log(`Ciclo ${cycleName} cifrado en un directorio privado.`);
