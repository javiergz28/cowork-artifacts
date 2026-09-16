import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStockPosition} from './model.mjs';

const headers = ['ITEM COD', 'NAME', 'CATEGORY', 'STOCK', 'Compra', 'Moneda', 'Costo base UYU', 'Recargo import. est.', 'IVA import. est.', 'Costo final UYU', 'Precio Web', 'Precio ML', 'Online WEB', 'Estado ML', 'Margen web $', 'Margen web %', 'Comisión ML $', 'Margen ML $', 'Margen ML %', 'Notas'];
function snapshot(overrides = {}, parameters = {}) {
  const row = {
    'ITEM COD': 'TEST-1', NAME: 'Producto de prueba', CATEGORY: 'Pruebas', STOCK: 4,
    Compra: 10, Moneda: 'USD', 'Costo base UYU': 400, 'Recargo import. est.': 200,
    'IVA import. est.': 120, 'Costo final UYU': 720,
    'Precio Web': 1200, 'Precio ML': 1500, 'Online WEB': 'Publicado', 'Estado ML': 'Activa',
    'Margen web $': 420, 'Margen web %': 0.35, 'Comisión ML $': 300, 'Margen ML $': 480, 'Margen ML %': 0.32,
    Notas: '', ...overrides
  };
  return {
    meta: {title: 'Pruebas', fetchedAtUtc: '2026-09-16T12:00:00Z', timeZone: 'America/Montevideo'},
    articles: [headers, headers.map(header => row[header] ?? '')],
    parameters: [['Parametro', 'Valor'], ['Tipo de cambio USD/UYU', parameters.exchange ?? 40], ['Coef. aranceles / importacion', parameters.importFactor ?? 1.5], ['Coef. impuestos', parameters.taxFactor ?? 1.2], ['Comision ML %', parameters.ml ?? 0.2], ['Comision pasarela web %', parameters.web ?? 0.05]]
  };
}

test('incluye precio y margen unitario estimado por canal sin confundirlos con resultado financiero', () => {
  const product = buildStockPosition(snapshot()).products[0];
  assert.equal(product.stockValue, 2880);
  assert.equal(product.web.margin, 420);
  assert.equal(product.ml.margin, 480);
  assert.equal(product.web.pct, 0.35);
  assert.equal(product.ml.pct, 0.32);
});

test('resuelve campos por encabezado, aunque cambie el orden', () => {
  const data = snapshot();
  data.articles = data.articles.map(row => [...row].reverse());
  const product = buildStockPosition(data).products[0];
  assert.equal(product.sku, 'TEST-1');
  assert.equal(product.finalCost, 720);
});

test('stock con costo faltante genera una alerta actual y no inventa valuación', () => {
  const product = buildStockPosition(snapshot({'Costo final UYU': ''})).products[0];
  assert.equal(product.stockValue, null);
  assert.equal(product.priority, 'high');
  assert.ok(product.actions.some(action => action.code === 'missing-cost'));
});

test('una nota explícita de pack bloquea la valuación hasta validarla', () => {
  const product = buildStockPosition(snapshot({Notas: 'PACK X2. Stock equivale a piezas: VERIFICAR.'})).products[0];
  assert.equal(product.stockValue, null);
  assert.equal(product.priority, 'urgent');
  assert.ok(product.actions.some(action => action.code === 'verify-unit'));
});

test('detecta diferencias con el recálculo de los parámetros de la misma foto', () => {
  const product = buildStockPosition(snapshot({'Costo final UYU': 710})).products[0];
  assert.equal(product.priority, 'high');
  assert.ok(product.actions.some(action => action.code === 'formula-difference'));
});

test('una pérdida actual con stock es urgente y un margen bajo es una alerta alta', () => {
  const negative = buildStockPosition(snapshot({'Precio Web': 700, 'Margen web $': -55, 'Margen web %': -0.08})).products[0];
  assert.equal(negative.priority, 'urgent');
  assert.ok(negative.actions.some(action => action.code === 'negative-margin-web'));
  const low = buildStockPosition(snapshot({'Precio Web': 800, 'Margen web $': 40, 'Margen web %': 0.05})).products[0];
  assert.equal(low.priority, 'high');
  assert.ok(low.actions.some(action => action.code === 'low-margin-web'));
});

test('un precio faltante sólo alerta cuando el canal actual figura publicado', () => {
  const published = buildStockPosition(snapshot({'Precio Web': '', 'Margen web $': '', 'Margen web %': ''})).products[0];
  assert.ok(published.actions.some(action => action.code === 'missing-price-web'));
  const pending = buildStockPosition(snapshot({'Precio Web': '', 'Margen web $': '', 'Margen web %': '', 'Online WEB': 'Pendiente'})).products[0];
  assert.ok(!pending.actions.some(action => action.code === 'missing-price-web'));
});

test('no convierte texto numérico o stock inválido en un cero ficticio', () => {
  const product = buildStockPosition(snapshot({STOCK: 'pendiente', Compra: '10,00'})).products[0];
  assert.equal(product.stock, null);
  assert.equal(product.purchase, null);
  assert.equal(product.stockValue, null);
  assert.ok(product.actions.some(action => action.code === 'invalid-stock'));
});

test('rechaza SKU duplicados y parámetros incompletos', () => {
  const duplicated = snapshot();
  duplicated.articles.push([...duplicated.articles[1]]);
  assert.throws(() => buildStockPosition(duplicated), /duplicado/i);
  assert.throws(() => buildStockPosition(snapshot({}, {exchange: 0})), /parámetro|parametro/i);
});
