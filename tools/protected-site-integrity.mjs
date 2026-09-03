import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

// El recibo vive fuera de la carpeta publicable y no contiene datos ni claves.
export async function hashTree(root) {
  const hashes = {};
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      const full = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('No se admiten enlaces simbólicos en la generación.');
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile()) {
        hashes[relative(root, full).replaceAll('\\', '/')] = createHash('sha256').update(await readFile(full)).digest('hex');
      }
    }
  }
  await visit(root);
  return hashes;
}

export function sameTree(a, b) {
  return Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([path, hash]) => b[path] === hash);
}
