import test from 'node:test';
import assert from 'node:assert/strict';
import {buildExpenseControl} from './model.mjs';

const summaryHeader = ['Mes', 'Ingresos', 'Gastos', 'Inversiones', 'Balance', 'Estado'];
const movementHeader = ['Fecha devengado', 'Tipo', 'Frecuencia', 'Origen/Proveedor', 'Descripción', 'Categoría', 'Monto devengado', 'Estado devengado', 'Mes devengado', 'Nota contable', '#Mes'];
const month = (label, expenses, state = 'CERRADO') => [label, 0, expenses, 0, -expenses, state];
const expense = (name, category, amount, monthName, monthNumber) => [0, 'Gasto', 'Mensual', name, name, category, amount, 'Conciliado', monthName, '', monthNumber];
const stockInvestment = (monthName, monthNumber) => [0, 'Inversión', 'Eventual', 'Proveedor', 'Pedido de stock', 'Stock / Inversión', 99999, 'Conciliado', monthName, '', monthNumber];

function snapshot(overrides = {}) {
  return {
    meta: {title: 'Control Financiero', spreadsheetId: 'test', fetchedAtUtc: '2026-09-16T12:00:00Z', timeZone: 'America/Montevideo'},
    summary: [summaryHeader, month('Mayo 2026', 10), month('Junio 2026', 100), month('Julio 2026', 120), month('Agosto 2026', 160), month('Septiembre 2026', 0, 'Sin cerrar')],
    movements: [movementHeader,
      expense('Servicio junio', 'Servicios', 40, 'Junio', 6), expense('Ads junio', 'Marketing', 60, 'Junio', 6), stockInvestment('Junio', 6),
      expense('Servicio julio', 'Servicios', 50, 'Julio', 7), expense('Ads julio', 'Marketing', 70, 'Julio', 7), stockInvestment('Julio', 7),
      expense('Servicio agosto', 'Servicios', 50, 'Agosto', 8), expense('Ads agosto', 'Marketing', 110, 'Agosto', 8), stockInvestment('Agosto', 8)
    ],
    ...overrides
  };
}

test('usa los últimos tres cierres, agrupa gastos y excluye inversión de stock', () => {
  const control = buildExpenseControl(snapshot());
  assert.deepEqual(control.months.map(month => month.label), ['Junio 2026', 'Julio 2026', 'Agosto 2026']);
  assert.deepEqual(control.months.map(month => month.expenses), [100, 120, 160]);
  assert.deepEqual(control.categories.find(category => category.label === 'Marketing').values, [60, 70, 110]);
  assert.equal(control.categories.some(category => category.label === 'Stock / Inversión'), false);
  assert.equal(control.months[2].change, (160 - 120) / 120);
});

test('no publica una lectura que no concilia contra Resumen Mensual', () => {
  assert.throws(() => buildExpenseControl(snapshot({summary: [summaryHeader, month('Junio 2026', 100), month('Julio 2026', 120), month('Agosto 2026', 170)]})), /no concilian/i);
});

test('exige tres meses cerrados antes de construir el bloque', () => {
  assert.throws(() => buildExpenseControl(snapshot({summary: [summaryHeader, month('Julio 2026', 120), month('Agosto 2026', 160)]})), /tres meses cerrados/i);
});
