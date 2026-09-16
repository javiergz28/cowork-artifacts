import {createSign} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [outputArg] = process.argv.slice(2);
if (!outputArg) throw new Error('Uso: node tools/fetch-stock-snapshot.mjs <snapshot.json dentro de _local>.');
const outputPath = resolve(repoRoot, outputArg);
const localRoot = resolve(repoRoot, '_local');
const localRelative = relative(localRoot, outputPath);
if (!localRelative || isAbsolute(localRelative) || localRelative === '..' || localRelative.startsWith('..' + sep)) {
  throw new Error('El snapshot sólo puede escribirse dentro de _local.');
}

const spreadsheetId = '1sDn8kLM_ewCPgsYS01n9EQTUpfmNYvZreU1leYxDB6Q';
const scope = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const columnLetter = number => {
  let value = number;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + value % 26) + result;
    value = Math.floor(value / 26);
  }
  return result;
};

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
  if (!response.ok) throw new Error(`No se pudo leer STOCK_MT_FINAL (${response.status}).`);
  return response.json();
}

const credentials = await serviceAccount();
const token = await accessToken(credentials);
const metadata = await googleJson(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties(title,timeZone),sheets(properties(title,gridProperties(rowCount,columnCount)))`, token);
const tabs = new Map((metadata.sheets || []).map(sheet => [sheet.properties?.title, sheet.properties]));
for (const tab of ['Articulos', 'Parametros']) if (!tabs.has(tab)) throw new Error(`Falta la pestaña requerida: ${tab}`);
const rangeFor = title => {
  const grid = tabs.get(title).gridProperties || {};
  if (!grid.rowCount || !grid.columnCount) throw new Error(`No se pudo resolver el rango de ${title}.`);
  return `'${title}'!A1:${columnLetter(grid.columnCount)}${grid.rowCount}`;
};
const query = new URLSearchParams({valueRenderOption: 'UNFORMATTED_VALUE'});
for (const range of ['Articulos', 'Parametros'].map(rangeFor)) query.append('ranges', range);
const values = await googleJson(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${query}`, token);
if (!Array.isArray(values.valueRanges) || values.valueRanges.length !== 2) throw new Error('Google no devolvió ambos rangos requeridos.');
const [articles, parameters] = values.valueRanges.map(item => item.values || []);
if (!articles.length || !parameters.length) throw new Error('Uno de los rangos requeridos está vacío.');

const snapshot = {
  meta: {
    title: metadata.properties?.title || 'STOCK_MT_FINAL',
    spreadsheetId,
    fetchedAtUtc: new Date().toISOString(),
    // El corte del panel se comunica en horario de negocio, no en la zona del
    // archivo fuente, que puede ser diferente.
    timeZone: 'America/Montevideo',
    source: 'Google Sheets API · Articulos + Parametros · solo lectura'
  },
  articles,
  parameters
};
await mkdir(dirname(outputPath), {recursive: true});
await writeFile(outputPath, JSON.stringify(snapshot), 'utf8');
console.log('Snapshot privado de STOCK_MT_FINAL creado.');
