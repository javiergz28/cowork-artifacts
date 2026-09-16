import {createSign} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [outputArg] = process.argv.slice(2);
if (!outputArg) throw new Error('Uso: node tools/fetch-expense-snapshot.mjs <snapshot.json dentro de _local>.');
const outputPath = resolve(repoRoot, outputArg);
const localRoot = resolve(repoRoot, '_local');
const localRelative = relative(localRoot, outputPath);
if (!localRelative || isAbsolute(localRelative) || localRelative === '..' || localRelative.startsWith('..' + sep)) {
  throw new Error('El snapshot financiero sólo puede escribirse dentro de _local.');
}

const spreadsheetId = '1wrqNtIfu2vrI4_mtZpW_RNQoGi2C4HNOnnhm7ml4Y5Y';
const scope = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const requiredTabs = ['Resumen Mensual', 'Movimientos 2026'];
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');

function columnLetter(number) {
  let value = number;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + value % 26) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

async function serviceAccount() {
  const source = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || (process.env.GOOGLE_SERVICE_ACCOUNT_FILE && await readFile(process.env.GOOGLE_SERVICE_ACCOUNT_FILE, 'utf8'));
  if (!source) throw new Error('Falta GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_SERVICE_ACCOUNT_FILE.');
  let credentials;
  try { credentials = JSON.parse(source); } catch { throw new Error('Las credenciales de Google no son JSON válido.'); }
  if (!credentials.client_email || !credentials.private_key) throw new Error('Las credenciales de Google no incluyen client_email o private_key.');
  return credentials;
}

async function accessToken(credentials) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = encode({alg: 'RS256', typ: 'JWT'});
  const claims = encode({iss: credentials.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: issuedAt, exp: issuedAt + 3600});
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  signer.end();
  const assertion = `${header}.${claims}.${signer.sign(credentials.private_key).toString('base64url')}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion})});
  if (!response.ok) throw new Error(`Google rechazó la autenticación (${response.status}).`);
  const body = await response.json();
  if (!body.access_token) throw new Error('Google no devolvió un token de acceso.');
  return body.access_token;
}

async function googleJson(url, token) {
  const response = await fetch(url, {headers: {authorization: `Bearer ${token}`}});
  if (!response.ok) throw new Error(`No se pudo leer Control Financiero (${response.status}).`);
  return response.json();
}

const credentials = await serviceAccount();
const token = await accessToken(credentials);
const metadata = await googleJson(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties(title,timeZone),sheets(properties(title,gridProperties(rowCount,columnCount)))`, token);
const tabs = new Map((metadata.sheets || []).map(sheet => [sheet.properties?.title, sheet.properties]));
for (const title of requiredTabs) if (!tabs.has(title)) throw new Error(`Falta la pestaña requerida: ${title}`);
const ranges = requiredTabs.map(title => {
  const grid = tabs.get(title).gridProperties || {};
  if (!grid.rowCount || !grid.columnCount) throw new Error(`No se pudo resolver el rango de ${title}.`);
  return `'${title}'!A1:${columnLetter(grid.columnCount)}${grid.rowCount}`;
});
const query = new URLSearchParams({valueRenderOption: 'UNFORMATTED_VALUE'});
for (const range of ranges) query.append('ranges', range);
const values = await googleJson(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${query}`, token);
if (!Array.isArray(values.valueRanges) || values.valueRanges.length !== requiredTabs.length) throw new Error('Google no devolvió los rangos financieros requeridos.');
const [summary, movements] = values.valueRanges.map(item => item.values || []);
if (!summary.length || !movements.length) throw new Error('Uno de los rangos financieros requeridos está vacío.');

const snapshot = {
  meta: {
    title: metadata.properties?.title || 'Control Financiero',
    spreadsheetId,
    fetchedAtUtc: new Date().toISOString(),
    timeZone: 'America/Montevideo',
    source: 'Google Sheets API · Resumen Mensual + Movimientos 2026 · solo lectura'
  },
  summary,
  movements
};
await mkdir(dirname(outputPath), {recursive: true});
await writeFile(outputPath, JSON.stringify(snapshot), 'utf8');
console.log('Snapshot privado del Control Financiero creado.');
