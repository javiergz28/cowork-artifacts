const MONTH_NUMBERS = Object.freeze({
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
});

const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const numeric = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const sum = values => values.reduce((total, value) => total + value, 0);
const closeEnough = (left, right) => Math.abs(left - right) <= 0.02;

// Esta taxonomía es una capa de lectura del panel: no cambia la categoría
// contable de la Sheet. En particular, separa los cargos de Mercado Libre
// para que no queden mezclados dentro de “Plataforma / Tecnología”.
const EXPENSE_GROUPS = Object.freeze([
  {id: 'ml-selling', section: 'Mercado Libre', label: 'Costos de vender en Mercado Libre', description: 'Cargo por venta, costo fijo, envíos, anulaciones, reembolsos, ajustes y residuales del canal.'},
  {id: 'ml-ads', section: 'Mercado Libre', label: 'Publicidad de Mercado Libre', description: 'Product Ads y Display Ads facturados por Mercado Libre; no son ventas atribuídas.'},
  {id: 'ml-promotions', section: 'Mercado Libre', label: 'Promociones y cupones de Mercado Libre', description: 'Cupones o descuentos identificados en la conciliación del canal.'},
  {id: 'ml-my-page', section: 'Mercado Libre', label: 'Mi Página de Mercado Libre', description: 'Cargo de la tienda o página dentro de Mercado Libre.'},
  {id: 'warehouse', section: 'Operación diaria', label: 'Depósito', description: 'Alquiler y costo de mantener el espacio operativo.'},
  {id: 'fulfilment', section: 'Operación diaria', label: 'Envíos y cadetería propios', description: 'Servicios logísticos fuera de los costos de envío ya cobrados por Mercado Libre.'},
  {id: 'team', section: 'Operación diaria', label: 'Equipo y gestión', description: 'Sueldo operativo y tareas de gestión interna.'},
  {id: 'content', section: 'Operación diaria', label: 'Contenido y publicidad externa', description: 'Contenido de cuentas y publicidad fuera de Mercado Libre, como Meta.'},
  {id: 'web-payments', section: 'Operación diaria', label: 'Web, cobros y tecnología', description: 'Hosting, telefonía y cargos de cobro web o Mercado Pago.'},
  {id: 'services-other', section: 'Operación diaria', label: 'Otros servicios operativos', description: 'Servicios que la fuente todavía no asigna a un bloque más específico.'},
  {id: 'legal', section: 'Obligaciones y financiación', label: 'Obligaciones legales', description: 'Aportes, impuestos y obligaciones registradas en el período.'},
  {id: 'financing', section: 'Obligaciones y financiación', label: 'Préstamo Santander (registrado como gasto)', description: 'La fuente lo registra hoy como gasto dentro de “Inversión”; su clasificación definitiva sigue pendiente.'},
  {id: 'operational-other', section: 'Obligaciones y financiación', label: 'Otros gastos operativos', description: 'Compras o reintegros operativos sin un bloque específico.'},
  {id: 'marketing-other', section: 'Otros / a revisar', label: 'Otros gastos de marketing', description: 'Gastos de marketing que la fuente no identifica como Mercado Libre, Meta o contenido.'},
  {id: 'unclassified', section: 'Otros / a revisar', label: 'Otro gasto registrado', description: 'Movimiento incluido para conciliar el cierre; falta una regla de lectura más específica.'}
]);
const GROUP_BY_ID = new Map(EXPENSE_GROUPS.map(group => [group.id, group]));
const SECTION_ORDER = [...new Set(EXPENSE_GROUPS.map(group => group.section))];

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

function expenseGroup(current) {
  const origin = normalize(current['Origen/Proveedor']);
  const description = normalize(current.Descripción);
  const sourceCategory = normalize(current.Categoría);
  const isMlOrigin = origin === 'mercado libre' || origin.includes('cargos e inversiones ml');

  if (origin === 'mercado libre ads') return 'ml-ads';
  if (isMlOrigin) {
    if (description.includes('mi pagina')) return 'ml-my-page';
    if (description.includes('cupon') || description.includes('descuento')) return 'ml-promotions';
    if (description.includes('publicidad')) return 'ml-ads';
    return 'ml-selling';
  }
  if (origin === 'mercado pago' || origin.includes('hosting') || origin === 'claro') return 'web-payments';
  if (origin.includes('alquiler deposito')) return 'warehouse';
  if (origin === 'logifast') return 'fulfilment';
  if (origin.includes('sueldo javi')) return 'team';
  if (origin.includes('contenido cuentas') || origin.includes('publicidad meta')) return 'content';
  if (origin === 'dgi') return 'legal';
  if (origin.includes('prestamo')) return 'financing';
  if (sourceCategory === 'servicios') return 'services-other';
  if (sourceCategory === 'operativa') return 'operational-other';
  if (sourceCategory === 'marketing') return 'marketing-other';
  return 'unclassified';
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
    const groupId = expenseGroup(current);
    groups.set(groupId, (groups.get(groupId) || 0) + amount);
  }
  if (!groups.size) throw new Error(`No se encontraron gastos devengados para ${month.label}.`);
  return groups;
}

function monthComment(month, previous) {
  const main = month.groups.slice().sort((left, right) => right.amount - left.amount)[0];
  const marketplaceTotal = sum(month.groups.filter(group => group.section === 'Mercado Libre').map(group => group.amount));
  const share = main.amount / month.expenses;
  const mainText = `${main.label} fue el bloque principal: ${Math.round(share * 100)}% del gasto del mes.`;
  const marketplaceText = marketplaceTotal > 0 ? ` Mercado Libre explicó ${Math.round(marketplaceTotal / month.expenses * 100)}% del total.` : '';
  if (!previous || previous.expenses === 0) return `${mainText}${marketplaceText}`;
  const change = (month.expenses - previous.expenses) / previous.expenses;
  if (Math.abs(change) < 0.005) return `${mainText}${marketplaceText} El total se mantuvo prácticamente igual que en ${previous.month}.`;
  return `${mainText}${marketplaceText} El total ${change > 0 ? 'subió' : 'bajó'} ${Math.round(Math.abs(change) * 100)}% frente a ${previous.month}.`;
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
    const monthGroups = [...groups.entries()]
      .map(([id, amount]) => ({...GROUP_BY_ID.get(id), amount, share: amount / month.expenses}))
      .sort((left, right) => right.amount - left.amount || left.label.localeCompare(right.label, 'es'));
    return {...month, groups: monthGroups};
  });

  const groups = EXPENSE_GROUPS
    .filter(group => byMonth.some(month => month.groups.some(monthGroup => monthGroup.id === group.id)))
    .map(group => ({
      ...group,
      values: byMonth.map(month => month.groups.find(monthGroup => monthGroup.id === group.id)?.amount ?? 0)
    }))
    .map(group => ({...group, latest: group.values.at(-1), total: sum(group.values)}))
    .sort((left, right) => SECTION_ORDER.indexOf(left.section) - SECTION_ORDER.indexOf(right.section) || right.total - left.total || left.label.localeCompare(right.label, 'es'));

  const months = byMonth.map((month, index) => {
    const previous = byMonth[index - 1];
    const change = previous && previous.expenses !== 0 ? (month.expenses - previous.expenses) / previous.expenses : null;
    return {
      label: month.label,
      month: month.month,
      state: month.state,
      expenses: month.expenses,
      change,
      groups: month.groups,
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
    groups,
    methodology: 'Gastos devengados por mes económico. La tabla conserva la suma de la fuente, pero organiza los movimientos para lectura: Mercado Libre se abre entre venta, publicidad, promociones y Mi Página. Las compras de stock con Tipo Inversión no se suman a estos gastos.',
    nextStep: 'La próxima capa puede vincular documentación y caja del mismo cierre, sin duplicar el gasto devengado.'
  };
}
