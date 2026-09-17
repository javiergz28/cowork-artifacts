import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localRoot = join(repoRoot, '_local', 'ciclos');
const cycle = process.argv[2];
const checkOnly = process.argv.includes('--check');

function safeCycle(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('Indicá el ciclo como AAAA-MM-DD.');
  return value;
}

function inside(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  if (!rel || rel === '..' || rel.startsWith('..' + sep)) throw new Error(`Ruta insegura: ${child}`);
}

const cycleName = safeCycle(cycle);
const source = join(localRoot, cycleName, 'protegido', 'index.html');
const target = join(repoRoot, 'multitrend-dashboard', 'ciclos', cycleName, 'index.html');
inside(localRoot, source);
inside(join(repoRoot, 'multitrend-dashboard', 'ciclos'), target);

const output = await readFile(source, 'utf8');
if (!output.includes('staticryptEncryptedMsgUniqueVariableName') || output.includes('data-cycle-private="true"')) {
  throw new Error('La salida no está cifrada o contiene la marca de fuente privada.');
}

if (checkOnly) {
  console.log(`Ciclo ${cycleName}: salida cifrada verificada. Sin cambios.`);
  process.exit(0);
}

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
console.log(`Ciclo ${cycleName}: únicamente el HTML cifrado fue preparado para publicar.`);
