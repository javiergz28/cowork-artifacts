import { copyFile, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(repoRoot, '_local', 'multitrend-source', 'multitrend-dashboard');
const outputDir = join(repoRoot, '_local', 'multitrend-protected', 'site', 'multitrend-dashboard');
const publishDir = join(repoRoot, 'multitrend-dashboard');

function assertInside(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  if (!rel || rel === '..' || rel.startsWith('..' + sep)) {
    throw new Error(`Ruta insegura: ${child}`);
  }
}

async function listFiles(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await listFiles(full));
    else result.push(full);
  }
  return result;
}

assertInside(repoRoot, publishDir);
assertInside(join(repoRoot, '_local'), sourceDir);
assertInside(join(repoRoot, '_local'), outputDir);

const sourceManifest = join(sourceDir, 'data', 'ciclos.json');
JSON.parse(await readFile(sourceManifest, 'utf8'));

const outputFiles = await listFiles(outputDir);
const htmlFiles = outputFiles.filter((file) => /\.html?$/i.test(file));
if (!htmlFiles.length) throw new Error('La salida protegida no contiene páginas HTML.');
if (outputFiles.some((file) => /\.json$/i.test(file))) {
  throw new Error('La salida protegida contiene un JSON público. Se canceló la preparación.');
}

for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, 'utf8');
  if (!html.includes('staticryptEncryptedMsgUniqueVariableName')) {
    throw new Error(`La página no está cifrada: ${htmlFile}`);
  }
}

for (const sourceFile of outputFiles) {
  const rel = relative(outputDir, sourceFile);
  const targetFile = join(publishDir, rel);
  await mkdir(dirname(targetFile), { recursive: true });
  await copyFile(sourceFile, targetFile);
}

await rm(join(publishDir, 'data', 'ciclos.json'), { force: true });

console.log(`${htmlFiles.length} páginas cifradas preparadas para publicar.`);
console.log('El manifiesto privado quedó solamente en _local/multitrend-source.');
