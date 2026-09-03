import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildModel} from './profitability/model.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  throw new Error('Uso: node tools/build-profitability.mjs <snapshot.json> <directorio de salida dentro de _local>. El snapshot debe incluir meta, articles y parameters.');
}
const outputDir = resolve(repoRoot, outputArg);
const localRoot = join(repoRoot, '_local');
const localRelative = relative(localRoot, outputDir);
if (!localRelative || isAbsolute(localRelative) || localRelative === '..' || localRelative.startsWith('..' + sep) || resolve(localRoot, localRelative) !== outputDir) {
  throw new Error('La salida debe estar dentro de _local: los datos de rentabilidad no se publican sin cifrar.');
}
const assetDir = join(dirname(outputDir), 'assets');
const assetRelative = relative(localRoot, assetDir);
if (!assetRelative || isAbsolute(assetRelative) || assetRelative === '..' || assetRelative.startsWith('..' + sep)) throw new Error('La carpeta de assets debe estar dentro de _local.');
const templateDir = join(repoRoot, 'tools', 'profitability');
const snapshot = JSON.parse(await readFile(resolve(repoRoot, inputArg), 'utf8'));
const model = buildModel(snapshot);
const [template, css, js] = await Promise.all(['index.template.html', 'profitability.css', 'profitability.js'].map(file => readFile(join(templateDir, file), 'utf8')));
if (!template.includes('__PROFITABILITY_DATA__')) throw new Error('La plantilla no contiene el punto de inserción de datos.');
const version = createHash('sha256').update(css).update(js).digest('hex').slice(0, 12);
const safeData = JSON.stringify(model).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
const html = template.replace('__PROFITABILITY_DATA__', safeData).replace('profitability.css"', `profitability.css?v=${version}"`).replace('profitability.js"', `profitability.js?v=${version}"`);
await mkdir(outputDir, {recursive: true});
await mkdir(assetDir, {recursive: true});
await writeFile(join(outputDir, 'index.html'), html, 'utf8');
await copyFile(join(templateDir, 'profitability.css'), join(assetDir, 'profitability.css'));
await copyFile(join(templateDir, 'profitability.js'), join(assetDir, 'profitability.js'));
console.log(`Página privada generada: ${relative(repoRoot, join(outputDir, 'index.html'))}`);
console.log(JSON.stringify({readAt: model.meta.fetchedAtUtc, ...model.summary}, null, 2));
