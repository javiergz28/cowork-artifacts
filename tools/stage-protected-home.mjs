import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localRoot = join(repoRoot, '_local', 'portada');
const source = join(localRoot, 'protegido', 'index.html');
const target = join(repoRoot, 'multitrend-dashboard', 'index.html');
const checkOnly = process.argv.includes('--check');

function inside(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  if (!rel || rel === '..' || rel.startsWith('..' + sep)) throw new Error(`Ruta insegura: ${child}`);
}

inside(localRoot, source);
inside(join(repoRoot, 'multitrend-dashboard'), target);
const output = await readFile(source, 'utf8');
if (!output.includes('staticryptEncryptedMsgUniqueVariableName') || output.includes('data-home-private="true"')) {
  throw new Error('La salida no está cifrada o contiene la marca de fuente privada.');
}
if (checkOnly) {
  console.log('Portada: salida cifrada verificada. Sin cambios.');
  process.exit(0);
}
await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
console.log('Portada: únicamente el HTML cifrado fue preparado para publicar.');
