import { mkdir, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sharedStaticryptSalt, staticryptSaltFrom } from './shared-staticrypt.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localRoot = join(repoRoot, '_local', 'portada');
const source = join(localRoot, 'fuente', 'index.html');
const output = join(localRoot, 'protegido');
const staticryptCli = join(repoRoot, 'node_modules', 'staticrypt', 'cli', 'index.js');

function inside(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  if (!rel || rel === '..' || rel.startsWith('..' + sep)) throw new Error(`Ruta de trabajo insegura: ${child}`);
}

if (!process.env.STATICRYPT_PASSWORD) {
  throw new Error('Falta la contraseña temporal de generación. No se creó ninguna salida.');
}

inside(localRoot, source);
inside(localRoot, output);
const sourceHtml = await readFile(source, 'utf8');
if (!sourceHtml.includes('data-home-private="true"')) {
  throw new Error('La portada no tiene la marca privada esperada; se canceló la generación.');
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const salt = await sharedStaticryptSalt(repoRoot);
const result = spawnSync(process.execPath, [
  staticryptCli, source, '--directory', output, '--config', 'false',
  '--salt', salt, '--short', '--remember', '30',
  '--template-title', 'Multitrend · Panel privado',
  '--template-instructions', 'Ingresá la contraseña compartida para abrir Multitrend.',
  '--template-button', 'Abrir Multitrend', '--template-placeholder', 'Contraseña',
  '--template-remember', 'Recordarme durante 30 días',
  '--template-error', 'La contraseña no es correcta.'
], { cwd: repoRoot, env: process.env, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const protectedHtml = await readFile(join(output, 'index.html'), 'utf8');
if (!protectedHtml.includes('staticryptEncryptedMsgUniqueVariableName') || protectedHtml.includes('data-home-private="true"')) {
  throw new Error('La salida no quedó cifrada correctamente.');
}
if (staticryptSaltFrom(protectedHtml, 'la portada generada') !== salt) {
  throw new Error('La portada no usa la sesión compartida; se canceló la salida.');
}
console.log('Portada cifrada en un directorio privado.');
