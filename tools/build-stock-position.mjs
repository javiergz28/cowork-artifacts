import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildStockPosition} from './stock-position/model.mjs';
import {buildExpenseControl} from './expense-control/model.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [stockInputArg, expensesInputArg, outputArg] = process.argv.slice(2);
if (!stockInputArg || !expensesInputArg || !outputArg) throw new Error('Uso: node tools/build-stock-position.mjs <stock-snapshot.json> <gastos-snapshot.json> <directorio de salida dentro de _local>.');

const outputDir = resolve(repoRoot, outputArg);
const localRoot = join(repoRoot, '_local');
const localRelative = relative(localRoot, outputDir);
if (!localRelative || isAbsolute(localRelative) || localRelative === '..' || localRelative.startsWith('..' + sep) || resolve(localRoot, localRelative) !== outputDir) {
  throw new Error('La salida debe estar dentro de _local: nunca se generan datos comerciales sin cifrar en el árbol público.');
}
const templateDir = join(repoRoot, 'tools', 'stock-position');
const [stockSnapshot, expensesSnapshot] = await Promise.all([
  readFile(resolve(repoRoot, stockInputArg), 'utf8').then(JSON.parse),
  readFile(resolve(repoRoot, expensesInputArg), 'utf8').then(JSON.parse)
]);
const model = {...buildStockPosition(stockSnapshot), expenses: buildExpenseControl(expensesSnapshot)};
const [template, css, refreshCss, js] = await Promise.all(['index.template.html', 'stock-position.css', 'stock-position-refresh.css', 'stock-position.js'].map(file => readFile(join(templateDir, file), 'utf8')));
if (!['__STOCK_POSITION_DATA__', '__STOCK_POSITION_CSS__', '__STOCK_POSITION_JS__'].every(marker => template.includes(marker))) {
  throw new Error('La plantilla no contiene todos los puntos de inserción requeridos.');
}
const safeData = JSON.stringify(model).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
const safeCss = `${css}\n${refreshCss}`.replaceAll('</style', '<\\/style');
const safeJs = js.replaceAll('</script', '<\\/script');
const html = template
  .replace('__STOCK_POSITION_DATA__', safeData)
  .replace('__STOCK_POSITION_CSS__', safeCss)
  .replace('__STOCK_POSITION_JS__', safeJs);
await mkdir(outputDir, {recursive: true});
await writeFile(join(outputDir, 'index.html'), html, 'utf8');
console.log(`Página privada generada: ${relative(repoRoot, join(outputDir, 'index.html'))}`);
console.log('Modelo validado sin emitir cifras comerciales en el log.');
