const MONTH_NUMBERS = Object.freeze({
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
});

const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const numeric = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const sum = values => values.reduce((total, value) => total + value, 0);
const closeEnough = (left, right) => Math.abs(left - right) <= 0.02;
const displayCategory = value => normalize(value) === 'inversion' ? 'Inversión (gasto)' : value;

function record(header, row) {
  return Object.fromEntries(header.map((name, index) => [name, row[index] ?? '']));
}

function parsePeriod(value) {
  const match = String(value ?? '').trim().match(/^([^\d]+?)\s+(\d{4})$/);
  if (!match) return null;
  const month = match[1].trim();
  const number = MONTH_NUMBERS[normalize(month)];
  const year = Number(match[2]);
  return number && Number.isInteger(year) ? {label: `${month} ${year}`, month, monthNumber: number, year} : null;
}

function closedMonths(summaryRows) {
  const headerIndex = summaryRows.findIndex(row => ['Mes', 'Ingresos', 'Gastos', 'Inversiones', 'Balance', 'Estado'].every(name => row.includes(name)));
  if (headerIndex < 0) throw new Error('No se encontró el bloque de Resumen Mensual con estado de cierre.');
  const header = summaryRows[headerIndex];
  const required = ['Mes', 'Gastos', 'Estado'];
  for (const name of required) if (!header.includes(name)) throw new Error(`Falta el encabezado ${name} en Resumen Mensual.`);

  const monthRows = [];
  for (const row of summaryRows.slice(headerIndex + 1)) {
    if (!row.some(value => String(value ?? '').trim())) break;
    const current = record(header, row);
    const period = parsePeriod(current.Mes);
    const expenses = numeric(current.Gastos);
    if (!period || expenses === null || normalize(current.Estado) !== 'cerrado') continue;
    monthRows.push({...period, expenses, state: String(current.Estado)});
  }
  if (monthRows.length < 3) throw new Error('Se necesitan al menos tres meses cerrados en Resumen Mensual.');
  return monthRows.slice(-3);
}

function groupedExpenses(movementRows, month) {
  const [header, ...rows] = movementRows;
  const required = ['Tipo', 'Categoría', 'Monto devengado', 'Mes devengado', '#Mes'];
  if (!Array.isArray(header) || !header.length) throw new Error('Movimientos 2026 no tiene encabezados.');
  for (const name of required) if (!header.includes(name)) throw new Error(`Falta el encabezado ${name} en Movimientos 2026.`);

  const groups = new Map();
  for (const row of rows) {
    const current = record(header, row);
    if (normalize(current.Tipo) !== 'gasto') continue;
    if (Number(current['#Mes']) !== month.monthNumber || normalize(current['Mes devengado']) !== normalize(month.month)) continue;
    const amount = numeric(current['Monto devengado']);
    if (amount === null) throw new Error(`Hay un gasto sin monto numérico en ${month.label}.`);
    const category = String(current.Categoría ?? '').trim() || 'Sin categoría';
    groups.set(category, (groups.get(category) || 0) + amount);
  }
  if (!groups.size) throw new Error(`No se encontraron gastos devengados para ${month.label}.`);
  return groups;
}

function monthComment(month, previous) {
  const main = month.categories.slice().sort((left, right) => right.amount - left.amount)[0];
  const share = main.amount / month.expenses;
  const mainText = `${main.label} fue la categoría principal: ${Math.round(share * 100)}% del gasto del mes.`;
  if (!previous || previous.expenses === 0) return mainText;
  const change = (month.expenses - previous.expenses) / previous.expenses;
  if (Math.abs(change) < 0.005) return `${mainText} El total se mantuvo prácticamente igual que en ${previous.month}.`;
  return `${mainText} El total ${change > 0 ? 'subió' : 'bajó'} ${Math.round(Math.abs(change) * 100)}% frente a ${previous.month}.`;
}

/**
 * Construye una lectura compacta de gastos devengados a partir de las dos
 * pestañas de Control Financiero. Las compras de stock (Tipo = Inversión)
 * quedan fuera por diseño: no son gasto operativo del mes.
 */
export function buildExpenseControl(snapshot) {
  if (!snapshot?.meta?.fetchedAtUtc || !Array.isArray(snapshot.summary) || !Array.isArray(snapshot.movements)) {
    throw new Error('Snapshot financiero incompleto: se requieren meta, summary y movements.');
  }
  const selected = closedMonths(snapshot.summary);
  const byMonth = selected.map(month => {
    const groups = groupedExpenses(snapshot.movements, month);
    const groupedTotal = sum([...groups.values()]);
    if (!closeEnough(groupedTotal, month.expenses)) {
      throw new Error(`Los gastos agrupados de ${month.label} no concilian con Resumen Mensual.`);
    }
    const categories = [...groups.entries()]
      .map(([label, amount]) => ({label: displayCategory(label), amount, share: amount / month.expenses}))
      .sort((left, right) => right.amount - left.amount || left.label.localeCompare(right.label, 'es'));
    return {...month, categories};
  });

  const categories = [...new Set(byMonth.flatMap(month => month.categories.map(category => category.label)))]
    .map(label => ({
      label,
      values: byMonth.map(month => month.categories.find(category => category.label === label)?.amount ?? 0)
    }))
    .map(category => ({...category, latest: category.values.at(-1), total: sum(category.values)}))
    .sort((left, right) => right.latest - left.latest || right.total - left.total || left.label.localeCompare(right.label, 'es'));

  const months = byMonth.map((month, index) => {
    const previous = byMonth[index - 1];
    const change = previous && previous.expenses !== 0 ? (month.expenses - previous.expenses) / previous.expenses : null;
    return {
      label: month.label,
      month: month.month,
      state: month.state,
      expenses: month.expenses,
      change,
      categories: month.categories,
      comment: monthComment(month, previous)
    };
  });

  return {
    meta: {
      title: snapshot.meta.title || 'Control Financiero',
      spreadsheetId: snapshot.meta.spreadsheetId || null,
      fetchedAtUtc: snapshot.meta.fetchedAtUtc,
      timeZone: snapshot.meta.timeZone || 'America/Montevideo',
      source: 'Google Sheets API · Resumen Mensual + Movimientos 2026 · solo lectura'
    },
    months,
    categories,
    methodology: 'Gastos devengados por mes económico. “Inversión (gasto)” conserva esa categoría de la fuente; las compras de stock con Tipo Inversión no se suman a estos gastos.',
    nextStep: 'La próxima capa puede vincular documentación y caja del mismo cierre, sin duplicar el gasto devengado.'
  };
}
