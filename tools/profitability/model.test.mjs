import test from 'node:test';
import assert from 'node:assert/strict';
import { buildModel } from './model.mjs';

const headers = ['ITEM COD', 'NAME', 'CATEGORY', 'STOCK', 'Costo final UYU', 'Precio Web', 'Precio ML', 'Multiplicador', 'Notas', 'Online WEB', 'Estado ML', 'Margen web $', 'Margen web %', 'Margen ML $', 'Margen ML %'];
function snapshot(overrides = {}, params = {}) {
  const row = {'ITEM COD': 'TEST-1', NAME: 'Producto de prueba', CATEGORY: 'Pruebas', STOCK: 4, 'Costo final UYU': 60, 'Precio Web': 120, 'Precio ML': 150, Multiplicador: 2, 'Online WEB': 'Publicado', 'Estado ML': 'Activa', ...overrides};
  return {
    meta: {title: 'Pruebas', fetchedAtUtc: '2026-01-01T00:00:00Z', timeZone: 'America/Montevideo'},
    articles: [headers, headers.map(h => row[h] ?? '')],
    parameters: [['Parametro', 'Valor'], ['Tipo de cambio USD/UYU', 40], ['Coef. aranceles / importacion', 1.5], ['Coef. impuestos', 1.2], ['Comision ML %', params.ml ?? 0.2], ['Envio', 'A cargo del comprador'], ['Comision pasarela web %', params.web ?? 0.05]]
  };
}

test('descuenta la comisión propia de cada canal y toma los parámetros del snapshot', () => {
  const product = buildModel(snapshot({}, {web: 0.1, ml: 0.3})).products[0];
  assert.equal(product.web.margin, 48);
  assert.equal(product.web.pct, 0.4);
  assert.equal(product.ml.margin, 45);
  assert.equal(product.ml.pct, 0.3);
});

test('resuelve columnas por encabezado aunque cambie su orden', () => {
  const data = snapshot();
  data.articles = data.articles.map(row => [...row].reverse());
  const product = buildModel(data).products[0];
  assert.equal(product.sku, 'TEST-1');
  assert.equal(product.stock, 4);
  assert.equal(product.web.margin, 54);
});

test('sin costo no inventa margen ni un precio sugerido', () => {
  const product = buildModel(snapshot({'Costo final UYU': ''})).products[0];
  assert.equal(product.web.margin, null);
  assert.equal(product.ml.referencePrice, null);
  assert.equal(product.priority, 'high');
  assert.ok(product.actions.some(action => action.code === 'missing-cost'));
});

test('una nota de packs pendientes bloquea recomendaciones de precio aunque haya margen positivo', () => {
  const product = buildModel(snapshot({Notas: 'PACK X2. Stock equivale a piezas: VERIFICAR.'})).products[0];
  assert.equal(product.basisUnverified, true);
  assert.equal(product.web.referencePrice, null);
  assert.equal(product.priority, 'urgent');
  assert.equal(product.actions[0].code, 'verify-unit');
  assert.ok(!product.actions.some(action => ['negative-margin', 'target-gap'].includes(action.code)));
});

test('un precio faltante en un canal no publicado no se llama pérdida', () => {
  const product = buildModel(snapshot({'Precio Web': '', 'Online WEB': 'Pendiente'})).products[0];
  assert.equal(product.web.margin, null);
  assert.ok(!product.actions.some(action => action.code === 'negative-margin'));
  assert.ok(!product.actions.some(action => action.code === 'missing-price'));
});

test('el multiplicador mide recargo sobre costo y no se presenta como margen real', () => {
  const product = buildModel(snapshot()).products[0];
  assert.equal(product.theoreticalMargin, 0.5);
  assert.equal(product.ml.referencePrice, 150);
  assert.equal(product.ml.pct, 0.4);
});

test('un SKU de catálogo no dispara una alerta por su sufijo', () => {
  const product = buildModel(snapshot({'ITEM COD': 'TEST-B'})).products[0];
  assert.ok(!product.actions.some(action => /sku|catalog|duplic/i.test(action.code)));
});

test('rechaza comisiones inválidas y SKU duplicados en vez de calcular con supuestos', () => {
  assert.throws(() => buildModel(snapshot({}, {web: 487})), /comisión|comision/i);
  const duplicate = snapshot();
  duplicate.articles.push([...duplicate.articles[1]]);
  assert.throws(() => buildModel(duplicate), /duplicado/i);
});

test('datos no numéricos no se convierten en cero ni en costos imaginados', () => {
  const product = buildModel(snapshot({'Costo final UYU': '60,00', STOCK: 'pendiente'})).products[0];
  assert.equal(product.cost, null);
  assert.equal(product.stock, null);
  assert.equal(product.web.margin, null);
  assert.equal(product.priority, 'high');
  assert.ok(product.actions.some(action => action.code === 'invalid-stock'));
});

test('una pérdida con stock es urgente; sin stock queda para revisión media', () => {
  const stocked = buildModel(snapshot({'Precio Web': 50})).products[0];
  const empty = buildModel(snapshot({'Precio Web': 50, STOCK: 0})).products[0];
  assert.equal(stocked.priority, 'urgent');
  assert.equal(empty.priority, 'medium');
});
