import {copyFile, mkdir, readFile, readdir} from 'node:fs/promises';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localRoot = join(repoRoot, '_local');
const outputRoot = join(localRoot, 'stock-position', 'protected', 'multitrend-dashboard');
const publicRoot = join(repoRoot, 'multitrend-dashboard');
const required = [
  ['rentabilidad/index.html', 'rentabilidad/index.html']
];

function assertInside(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  if (!rel || rel === '..' || rel.startsWith('..' + sep)) throw new Error(`Ruta insegura: ${child}`);
}
for (const [from, to] of required) {
  const source = join(outputRoot, from);
  const target = join(publicRoot, to);
  assertInside(localRoot, source); assertInside(repoRoot, target);
  if (from.endsWith('.html')) {
    const html = await readFile(source, 'utf8');
    if (!html.includes('staticryptEncryptedMsgUniqueVariableName') || html.includes('stock-position-data')) throw new Error('El HTML de salida no está cifrado.');
  }
  await mkdir(dirname(target), {recursive: true});
  await copyFile(source, target);
}
const outputEntries = await readdir(outputRoot, {recursive: true});
if (outputEntries.some(entry => entry.endsWith('.json'))) throw new Error('La salida protegida contiene JSON público.');
console.log('Salida protegida preparada para GitHub Pages.');
