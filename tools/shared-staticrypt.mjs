import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const SALT_PATTERN = /"staticryptSaltUniqueVariableName":\s*"([a-f0-9]{32})"/i;

export function staticryptSaltFrom(html, label = 'el HTML') {
  const match = html.match(SALT_PATTERN);
  if (!match) throw new Error(`No se encontró una sal de Staticrypt válida en ${label}.`);
  return match[1].toLowerCase();
}

export async function sharedStaticryptSalt(repoRoot) {
  // "ultimo" pertenece a la serie histórica que ya comparte una sola sesión.
  // Es la referencia estable para que los paneles nuevos no creen puertas separadas.
  const canonicalEntry = join(repoRoot, 'multitrend-dashboard', 'ultimo', 'index.html');
  return staticryptSaltFrom(await readFile(canonicalEntry, 'utf8'), 'la entrada histórica canónica');
}
