import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { hashTree } from './protected-site-integrity.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(repoRoot, '_local', 'multitrend-source', 'multitrend-dashboard');
const localRoot = join(repoRoot, '_local', 'multitrend-protected');
const stagingRoot = join(localRoot, 'staging');
const stagingDir = join(stagingRoot, 'multitrend-dashboard');
const outputRoot = join(localRoot, 'site');
const outputDir = join(outputRoot, 'multitrend-dashboard');
const configPath = join(localRoot, '.staticrypt.json');
const cliPath = join(repoRoot, 'node_modules', 'staticrypt', 'cli', 'index.js');

if (!process.env.STATICRYPT_PASSWORD) {
  throw new Error('Falta la contraseña temporal de generación. Usá el comando npm run build:multitrend-protected.');
}

// Conservar el acceso existente: una clave equivocada no debe reemplazar el sitio.
const require = createRequire(import.meta.url);
const cryptoEngine = require('staticrypt/lib/cryptoEngine.js');
const { decode } = require('staticrypt/lib/codec.js').init(cryptoEngine);
const currentEntry = await readFile(join(repoRoot, 'multitrend-dashboard', 'index.html'), 'utf8');
const cipher = currentEntry.match(/"staticryptEncryptedMsgUniqueVariableName":\s*"([^"]+)"/);
const salt = currentEntry.match(/"staticryptSaltUniqueVariableName":\s*"([^"]+)"/);
if (!cipher || !salt) throw new Error('No se pudo verificar la protección de la portada actual.');
const key = await cryptoEngine.hashPassword(process.env.STATICRYPT_PASSWORD, salt[1]);
const verified = await decode(cipher[1], key, salt[1]);
if (!verified.success) throw new Error('La clave ingresada no corresponde al sitio actual. No se modificó la salida.');
const savedConfig = JSON.parse(await readFile(configPath, 'utf8'));
if (savedConfig.salt !== salt[1]) throw new Error('La configuración local de cifrado no coincide con el sitio actual.');

function assertInside(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  if (!rel || rel === '..' || rel.startsWith('..' + sep)) {
    throw new Error(`Ruta de trabajo insegura: ${child}`);
  }
}

async function listHtml(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await listHtml(full));
    else if (/\.html?$/i.test(entry.name)) result.push(full);
  }
  return result;
}

assertInside(join(repoRoot, '_local'), stagingRoot);
assertInside(join(repoRoot, '_local'), outputRoot);

const sourceHashes = await hashTree(sourceDir);

await rm(stagingRoot, { recursive: true, force: true });
await rm(outputRoot, { recursive: true, force: true });
await mkdir(stagingRoot, { recursive: true });
await mkdir(outputRoot, { recursive: true });
await cp(sourceDir, stagingDir, { recursive: true });

const ciclosPath = join(stagingDir, 'data', 'ciclos.json');
const ciclos = JSON.parse(await readFile(ciclosPath, 'utf8'));
const datosSeguros = JSON.stringify(ciclos).replaceAll('<', '\\u003c');
const bloqueDatos = `\n<script id="mt-ciclos-data" type="application/json">${datosSeguros}</script>\n`;

for (const htmlPath of await listHtml(stagingDir)) {
  const original = await readFile(htmlPath, 'utf8');
  if (!original.includes('</head>')) throw new Error(`No se encontró </head> en ${htmlPath}`);
  await writeFile(htmlPath, original.replace('</head>', `${bloqueDatos}</head>`), 'utf8');
}

await unlink(ciclosPath);
await rm(join(stagingDir, 'COMO_AGREGAR_UN_CICLO.md'), { force: true });

const args = [
  cliPath,
  stagingDir,
  '--recursive',
  '--directory', outputRoot,
  '--config', relative(repoRoot, configPath),
  // Ya se comprobó que es la clave existente; no pedir una segunda entrada oculta.
  '--short',
  '--remember', '30',
  '--template-title', 'Multitrend · Panel privado',
  '--template-instructions', 'Ingresá la contraseña compartida para abrir los reportes.',
  '--template-button', 'Abrir panel',
  '--template-placeholder', 'Contraseña',
  '--template-remember', 'Recordarme durante 30 días',
  '--template-error', 'La contraseña no es correcta.',
  '--template-toggle-show', 'Mostrar contraseña',
  '--template-toggle-hide', 'Ocultar contraseña',
  '--template-color-primary', '#16A34A',
  '--template-color-secondary', '#0C0C0C'
];

const result = spawnSync(process.execPath, args, {
  cwd: repoRoot,
  env: process.env,
  stdio: 'inherit'
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

await rm(stagingRoot, { recursive: true, force: true });

await writeFile(join(localRoot, 'build-receipt.json'), JSON.stringify({
  version: 1, generatedAt: new Date().toISOString(), source: sourceHashes, output: await hashTree(outputDir)
}, null, 2), 'utf8');

console.log('\nPanel protegido generado en:');
console.log(outputDir);
console.log('\nLa fuente privada local no fue reemplazada y la contraseña no se guardó.');
