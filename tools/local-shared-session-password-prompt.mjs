import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || 4185);
const require = createRequire(import.meta.url);
const cryptoEngine = require('staticrypt/lib/cryptoEngine.js');
const { decode } = require('staticrypt/lib/codec.js').init(cryptoEngine);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Puerto local inválido.');

const page = (message = '') => `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Multitrend · Unificar acceso</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f7f4;color:#0c0c0c;font:16px/1.5 Inter,system-ui,sans-serif}.box{width:min(460px,calc(100% - 40px);padding:30px;background:#fff;border:1px solid #dce5dd;border-radius:18px;box-shadow:0 18px 45px #0c0c0c16}.brand{font-size:13px;font-weight:900;letter-spacing:.1em}.brand i{color:#147d35;font-style:normal}h1{margin:10px 0;font-size:28px;letter-spacing:-.05em}p{color:#536057;font-size:14px}label{display:grid;gap:7px;font-size:12px;font-weight:800}input{padding:12px;border:1px solid #9bac9d;border-radius:9px;font:inherit}button{width:100%;margin-top:17px;padding:12px;border:0;border-radius:9px;background:#2bea60;color:#0c0c0c;font:inherit;font-weight:900;cursor:pointer}.note{margin-top:15px;padding:10px;background:#eaf9ed;border-radius:9px;color:#155c2d;font-size:12px}.error{background:#fff0ee;color:#8d2720}</style><main class="box"><div class="brand">MULTI<i>TREND</i></div><h1>Unificar acceso protegido</h1><p>Ingresá la contraseña actual una sola vez. Se usa únicamente en esta computadora para regenerar portada, ciclo activo y stock/costos con una misma sesión; no se guarda ni sale de localhost.</p>${message}<form method="post"><label>Contraseña actual<input type="password" name="password" autocomplete="current-password" autofocus required></label><button type="submit">Generar acceso único</button></form></main></html>`;

let handled = false;
const server = createServer(async (req, res) => {
  const isLocal = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '');
  if (!isLocal) { res.writeHead(403); res.end('Solo disponible en localhost.'); return; }
  if (req.method === 'GET') { res.writeHead(200, {'content-type':'text/html; charset=utf-8','cache-control':'no-store'}); res.end(page()); return; }
  if (req.method !== 'POST' || handled) { res.writeHead(405); res.end('Esta ventana ya no acepta otra generación.'); return; }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const password = new URLSearchParams(Buffer.concat(chunks).toString('utf8')).get('password') || '';
  if (!password) { res.writeHead(400, {'content-type':'text/html; charset=utf-8'}); res.end(page('<p class="note error">Ingresá la contraseña para continuar.</p>')); return; }
  const currentEntry = await readFile(join(repoRoot, 'multitrend-dashboard', 'index.html'), 'utf8');
  const cipher = currentEntry.match(/"staticryptEncryptedMsgUniqueVariableName":\s*"([^"]+)"/);
  const salt = currentEntry.match(/"staticryptSaltUniqueVariableName":\s*"([^"]+)"/);
  if (!cipher || !salt) throw new Error('No se pudo verificar la protección actual del panel.');
  const key = await cryptoEngine.hashPassword(password, salt[1]);
  const verified = await decode(cipher[1], key, salt[1]);
  if (!verified.success) { res.writeHead(401, {'content-type':'text/html; charset=utf-8','cache-control':'no-store'}); res.end(page('<p class="note error">Esa contraseña no abre el panel actual. No se publicó nada.</p>')); return; }
  handled = true;
  const child = spawn(process.execPath, [join(repoRoot, 'tools', 'build-protected-shared-session.mjs')], {cwd:repoRoot,env:{...process.env,STATICRYPT_PASSWORD:password},stdio:'ignore'});
  child.once('error', () => { res.writeHead(500, {'content-type':'text/html; charset=utf-8'}); res.end(page('<p class="note error">No se pudo iniciar la generación. No se publicó nada.</p>')); server.close(); });
  child.once('exit', code => { const ok = code === 0; res.writeHead(ok ? 200 : 422, {'content-type':'text/html; charset=utf-8','cache-control':'no-store'}); res.end(page(ok ? '<p class="note"><strong>Listo.</strong> La sesión compartida se generó localmente. La publicación segura continúa ahora.</p>' : '<p class="note error">No se generó una salida válida. No se publicó nada.</p>')); server.close(); });
});
server.listen(port, '127.0.0.1', () => console.log(`Solicitud local lista en http://127.0.0.1:${port}`));
