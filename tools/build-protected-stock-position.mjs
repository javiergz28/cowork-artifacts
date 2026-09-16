import {cp, mkdir, readFile, rm} from 'node:fs/promises';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localRoot = join(repoRoot, '_local');
const sourceRoot = join(localRoot, 'stock-position', 'source', 'multitrend-dashboard');
const sourceDir = join(sourceRoot, 'rentabilidad');
const stagingRoot = join(localRoot, 'stock-position', 'staging');
const outputRoot = join(localRoot, 'stock-position', 'protected', 'multitrend-dashboard');
const outputDir = join(outputRoot, 'rentabilidad');
const staticryptCli = join(repoRoot, 'node_modules', 'staticrypt', 'cli', 'index.js');

function assertLocal(path) {
  const rel = relative(localRoot, path);
  if (!rel || rel === '..' || rel.startsWith('..' + sep)) throw new Error(`Ruta de trabajo insegura: ${path}`);
}
if (!process.env.STATICRYPT_PASSWORD) throw new Error('Falta STATICRYPT_PASSWORD.');
for (const path of [sourceRoot, sourceDir, stagingRoot, outputRoot, outputDir]) assertLocal(path);
if (!(await readFile(join(sourceDir, 'index.html'), 'utf8')).includes('stock-position-data')) throw new Error('La fuente privada de stock no parece válida.');

await rm(stagingRoot, {recursive: true, force: true});
await rm(outputRoot, {recursive: true, force: true});
await mkdir(stagingRoot, {recursive: true});
await mkdir(outputDir, {recursive: true});
await cp(sourceDir, join(stagingRoot, 'rentabilidad'), {recursive: true});

const result = spawnSync(process.execPath, [staticryptCli, join(stagingRoot, 'rentabilidad', 'index.html'), '--directory', outputDir, '--config', 'false', '--salt', randomBytes(16).toString('hex'), '--short', '--remember', '30', '--template-title', 'Multitrend · Stock y costos', '--template-instructions', 'Ingresá la contraseña compartida para abrir el panel.', '--template-button', 'Abrir panel', '--template-placeholder', 'Contraseña', '--template-remember', 'Recordarme durante 30 días', '--template-error', 'La contraseña no es correcta.'], {cwd: repoRoot, env: process.env, stdio: 'inherit'});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const protectedIndex = await readFile(join(outputDir, 'index.html'), 'utf8');
if (!protectedIndex.includes('staticryptEncryptedMsgUniqueVariableName') || protectedIndex.includes('stock-position-data')) {
  throw new Error('La salida no quedó cifrada correctamente.');
}
await rm(stagingRoot, {recursive: true, force: true});
console.log('Panel de stock protegido generado en _local.');
