import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sharedStaticryptSalt, staticryptSaltFrom } from './shared-staticrypt.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicMode = process.argv.includes('--public');
const entries = publicMode
  ? [
      ['portada', join(repoRoot, 'multitrend-dashboard', 'index.html'), 'data-home-private="true"'],
      ['ciclo activo', join(repoRoot, 'multitrend-dashboard', 'ciclos', '2026-09-15', 'index.html'), 'data-cycle-private="true"'],
      ['stock y costos', join(repoRoot, 'multitrend-dashboard', 'rentabilidad', 'index.html'), 'stock-position-data']
    ]
  : [
      ['portada', join(repoRoot, '_local', 'portada', 'protegido', 'index.html'), 'data-home-private="true"'],
      ['ciclo activo', join(repoRoot, '_local', 'ciclos', '2026-09-15', 'protegido', 'index.html'), 'data-cycle-private="true"'],
      ['stock y costos', join(repoRoot, '_local', 'stock-position', 'protected', 'multitrend-dashboard', 'rentabilidad', 'index.html'), 'stock-position-data']
    ];
const salt = await sharedStaticryptSalt(repoRoot);

for (const [label, path, privateMarker] of entries) {
  const html = await readFile(path, 'utf8');
  if (!html.includes('staticryptEncryptedMsgUniqueVariableName')) throw new Error(`${label} no está cifrado.`);
  if (html.includes(privateMarker)) throw new Error(`${label} contiene una marca de fuente privada.`);
  if (staticryptSaltFrom(html, label) !== salt) throw new Error(`${label} no pertenece a la sesión compartida.`);
}

console.log(`Sesión compartida verificada en ${publicMode ? 'la salida pública' : 'la salida privada'}.`);
