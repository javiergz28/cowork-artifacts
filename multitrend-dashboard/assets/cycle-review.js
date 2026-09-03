'use strict';

// Presentation only. All report records are supplied by the encrypted cycle page.
(() => {
  const review = DATA.review;
  if (!review) {
    document.getElementById('ads-context').textContent = 'No se pudo cargar la ampliación del ciclo. Volvé a abrir la página.';
    return;
  }
  const el = id => document.getElementById(id);
  const kpi = (label, value, caption) => `<div class="kpi"><span class="lab">${esc(label)}</span><span class="val num">${value}</span><span class="foot">${esc(caption)}</span></div>`;
  const action = (title, why, next, kind = '') => `<article class="small-alert ${kind}"><h4>${esc(title)}</h4><p>${esc(why)}</p><p class="next-step">${esc(next)}</p></article>`;
  const list = values => `<ul class="field-list">${values.map(value => `<li>${esc(value)}</li>`).join('')}</ul>`;
  const metricDetail = (title, items) => `<div class="metric-detail"><h4>${esc(title)}</h4>${detailGrid(items)}</div>`;
  const itemLink = item => link('https://articulo.mercadolibre.com.uy/MLU-' + String(item).replace(/\D/g, ''), item);

  const tabs = [...document.querySelectorAll('.report-tabs [role="tab"]')];
  function chooseTab(tab, focus = false) {
    tabs.forEach(other => {
      const selected = other === tab;
      other.setAttribute('aria-selected', String(selected));
      other.tabIndex = selected ? 0 : -1;
      el(other.getAttribute('aria-controls')).hidden = !selected;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => chooseTab(tab));
    tab.addEventListener('keydown', event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
      if (next !== null) { event.preventDefault(); chooseTab(tabs[next], true); }
    });
  });

  el('result-actions').innerHTML = action('Confirmar devoluciones', `${n(DATA.profit.return_units_in_cogs)} unidades mantienen su costo porque no se confirmó su recuperación.`, 'Confirmar qué volvió en buen estado antes de ajustar el resultado.') + action('Conciliar el importe residual', `${money(DATA.sales.finance.other_adjustments)} permiten llegar al Total ML, pero su causa sigue sin identificar.`, 'Cruzar cargos y fechas; no volver a descontar la facturación completa.');
  const sourceWarnings = sourceRows.filter(source => ['Sustituido', 'Duplicado', 'Diferencias'].includes(source.status));
  el('source-alerts').innerHTML = sourceWarnings.map(source => action(source.status === 'Duplicado' ? 'Duplicado contado una sola vez' : source.status === 'Diferencias' ? 'Diferencias de cobertura en Ads' : 'Export parcial fuera del cálculo', source.file, plainCopy(source.note), 'info')).join('');
  el('source-list').querySelector('summary').textContent = `Ver los ${n(DATA.sources.length)} archivos y su uso en el ciclo`;
  el('open-notes').addEventListener('click', () => el('notes').querySelectorAll('details').forEach(detail => detail.open = true));
  el('close-notes').addEventListener('click', () => el('notes').querySelectorAll('details').forEach(detail => detail.open = false));

  const adData = review.ads;
  const totals = adData.totals.ads;
  const ratios = [['cpc', 'Costo por clic', money], ['ctr', 'Tasa de clics', pct], ['cvr', 'Conversión publicitaria', pct], ['acos', 'ACOS', pct], ['roas', 'ROAS', roas]];
  const currencyFields = new Set(['spend', 'income', 'income_direct', 'income_indirect', 'budget_reported', 'budget_daily_reported', 'cpc_reported']);
  const percentFields = new Set(['impression_share', 'lost_budget_share', 'lost_rank_share', 'top_search_impression_share']);
  function sourceValue(key, value) {
    if (value === null || value === undefined || value === '') return 'Sin dato en el export';
    if (currencyFields.has(key)) return money(value);
    if (percentFields.has(key)) return pct(value);
    if (key === 'roas_target') return roas(value);
    if (key === 'item' || key === 'sold_item') return itemLink(value);
    return typeof value === 'number' ? value.toLocaleString('es-UY', {maximumFractionDigits: 12}) : esc(value);
  }
  function adsDetail(view, row) {
    const source = adData.source_files[view];
    const fields = source.columns.filter(column => Object.hasOwn(row, column.key));
    const original = metricDetail('Campos completos del reporte', fields.map(column => [column.label, sourceValue(column.key, row[column.key])]));
    const calculated = view === 'attributed_sales' ? '' : metricDetail('Indicadores recalculados con esta fila', ratios.map(([key, label, format]) => [label, format(row[key])]));
    const additional = view === 'attributed_sales' ? detailGrid([['Venta atribuida', esc(row.attribution)], ['Publicación comprada', itemLink(row.sold_item)], ['Ingresos directos', money(row.income_direct)], ['Ingresos asistidos', money(row.income_indirect)]]) : '';
    return original + calculated + additional + `<p class="detail-note">Fuente: ${esc(source.file)} · hoja ${esc(source.sheet)} · ${row.source_row ? 'fila ' + n(row.source_row) : 'filas ' + esc((row.source_rows || []).join(', '))}. ${view === 'placements' ? 'Las tasas informadas se conservan con su escala original; pueden aparecer como fracciones redondeadas. Compará con los indicadores recalculados.' : 'Los indicadores calculados conservan los decimales originales y se redondean sólo al mostrar.'} Sin dato significa que la fuente no informó un valor; no se reemplaza por cero.</p>`;
  }
  function adsSummary(rows, view) {
    const missing = key => rows.filter(row => !hasNumber(row[key])).length;
    const partial = key => missing(key) ? ` (${n(missing(key))} filas sin dato)` : '';
    const amount = key => rows.some(row => hasNumber(row[key])) ? money(sum(rows, key)) + partial(key) : 'Sin datos';
    const complete = !missing('spend') && !missing('income');
    return `<strong>Todo el resultado filtrado:</strong> ${view === 'attributed_sales' ? '' : 'inversión informada ' + amount('spend') + ' · '}ingresos atribuidos ${amount('income')} · ${n(sum(rows, 'sales'))} ventas publicitarias${view === 'attributed_sales' ? '' : ' · ROAS ' + (complete && sum(rows, 'spend') > 0 ? roas(sum(rows, 'income') / sum(rows, 'spend')) : 'No calculable con datos incompletos o sin inversión')}. Cada vista usa su propia base. No sumes vistas ni porcentajes.`;
  }
  const resultLabel = row => !hasNumber(row.spend) || !hasNumber(row.income) ? 'Dato incompleto' : row.spend === 0 ? 'Sin inversión' : row.sales === 0 ? 'Con gasto, sin ventas' : 'Con ventas';
  function adTable(view, table, title, rows, first, extraFilters = []) {
    const columns = [{key: first.key, label: first.label, format: first.format}, {key: 'spend', label: 'Inversión', align: 'r', format: money}, {key: 'income', label: 'Ingresos atribuidos', align: 'r', format: money}, {key: 'sales', label: 'Ventas atribuidas', align: 'r', format: n}, {key: 'roas', label: 'ROAS', align: 'r', format: roas}];
    const sourceColumns = adData.source_files[view].columns.map(column => ({key: column.key, label: column.label}));
    const sortOptions = [...new Map([...columns, ...sourceColumns, ...ratios.map(([key, label]) => ({key, label}))].map(column => [column.key, column])).values()];
    mountTable({table, title, rows, sort: 'spend', unit: 'filas', searchKeys: ['title', 'campaign', 'item', 'state', 'page', 'placement'], filters: [{id: table + '-campaign', label: 'Campaña', get: row => row.campaign}, ...extraFilters, {id: table + '-result', label: 'Resultado', get: resultLabel}], columns, sortOptions, details: row => adsDetail(view, row), summary: rows => adsSummary(rows, view)});
  }
  el('ads-kpis').innerHTML = [
    kpi('Inversión', money(totals.spend), 'Fuente principal: anuncios'),
    kpi('Ingresos atribuidos', money(totals.income), 'Ya incluidos en las ventas del negocio'),
    kpi('ROAS', roas(totals.roas), 'Ingresos por cada peso invertido; no es ganancia'),
    kpi('ACOS', pct(totals.acos), 'Publicidad sobre ingresos atribuidos'),
    kpi('Clics', n(totals.clicks), n(totals.impressions) + ' impresiones'),
    kpi('Costo por clic', money(totals.cpc), 'Inversión ÷ clics'),
    kpi('CTR · tasa de clics', pct(totals.ctr), 'Clics ÷ impresiones × 100'),
    kpi('Ventas atribuidas', n(totals.sales), `${n(totals.sales_direct)} directas · ${n(totals.sales_indirect)} asistidas · CVR ${pct(totals.cvr)}`)
  ].join('');
  const glossary = [
    ['Ventas atribuidas', 'Un producto diferente dentro del carrito cuenta como una venta publicitaria; no es lo mismo que pedidos ni unidades.'],
    ['Directas y asistidas', 'Directa: compró la publicación anunciada. Asistida o indirecta: hizo clic en un anuncio y compró otra publicación del negocio.'],
    ...adData.derived_metrics.map(metric => [metric.label, metric.formula + '. ' + metric.aggregation]),
    ['Presupuesto y objetivo', 'Son configuraciones informadas en cada reporte. No son el gasto real del mes y pueden diferir entre exports.'],
    ['Impresiones ganadas y perdidas', 'Participación informada en campañas: cuánto se mostró y cuánto se perdió por presupuesto o ranking. Una pérdida por ranking no se resuelve necesariamente aumentando presupuesto.']
  ];
  el('ads-glossary').innerHTML = `<dl>${glossary.map(([term, text]) => `<div><dt>${esc(term)}</dt><dd>${esc(text)}</dd></div>`).join('')}</dl><p>En el detalle, “informado” conserva el valor del export y “recalculado” usa sus importes y conteos. Las cuatro vistas se superponen.</p>`;
  el('tab-ads').textContent = `Anuncios · ${n(adData.ads.length)}`;
  el('tab-campaigns').textContent = `Campañas · ${n(adData.campaigns.length)}`;
  el('tab-placements').textContent = `Ubicaciones · ${n(adData.placements.length)}`;
  el('tab-attributed').textContent = `Ventas atribuidas · ${n(adData.attributed_sales.pairs.length)}`;
  el('ads-context').textContent = `${n(adData.ads.length)} filas anuncio/campaña · ${n(adData.signals.unique_ad_publications)} publicaciones distintas. Un anuncio movido conserva sus resultados en cada campaña. Elegí “Todas” para ver todas las filas.`;
  el('campaigns-context').textContent = `${n(adData.campaigns.length)} filas del export, incluidas configuraciones sin actividad. Los nombres pueden repetirse. Cada detalle muestra presupuesto, objetivo, participación de impresiones y pérdidas por ranking o presupuesto.`;
  el('placements-context').textContent = `${n(adData.placements.length)} combinaciones de campaña, página y ubicación. Hay importes sin informar; el subtotal no completa los huecos. La inversión difiere de anuncios en ${money(adData.reconciliation.placements.spend.difference)}.`;
  el('attributed-context').textContent = 'Todas las relaciones entre anuncio y publicación comprada, agrupadas sin datos de compradores. Permite distinguir lo que vendió el propio anuncio de las ventas que asistió a otro producto. No es un listado de pedidos.';
  adTable('ads', 'ads-table', 'Publicidad por anuncio y campaña', adData.ads, {key: 'title', label: 'Anuncio', format: (value, row) => `<div class="product-cell"><span class="name">${esc(value)}</span><span class="mono">${esc(row.campaign)} · ${esc(row.item)}</span>${badge(row.state)}</div>`}, [{id: 'ads-state', label: 'Estado', get: row => row.state}]);
  adTable('campaigns', 'campaigns-table', 'Resultados por campaña', adData.campaigns, {key: 'campaign', label: 'Campaña', format: (value, row) => `<div class="product-cell"><span class="name">${esc(value)}</span><span class="mono">Objetivo ${roas(row.roas_target)} · fila ${n(row.source_row)}</span></div>`});
  adTable('placements', 'placements-table', 'Resultados por ubicación', adData.placements, {key: 'placement', label: 'Ubicación', format: (value, row) => `<div class="product-cell"><span class="name">${esc(row.page)} · ${esc(value)}</span><span class="mono">${esc(row.campaign)}</span></div>`}, [{id: 'placements-page', label: 'Página', get: row => row.page}]);
  mountTable({table: 'attributed-table', title: 'Ventas atribuidas por anuncio y publicación comprada', rows: adData.attributed_sales.pairs, sort: 'income', unit: 'relaciones', searchKeys: ['title', 'item', 'sold_title', 'sold_item', 'campaign', 'attribution'], filters: [{id: 'attributed-type', label: 'Atribución', get: row => row.attribution}, {id: 'attributed-campaign', label: 'Campaña', get: row => row.campaign}], columns: [
    {key: 'title', label: 'Anuncio que recibió el clic', width: '32%', format: (value, row) => `<div class="product-cell"><span class="name">${esc(value)}</span><span class="mono">${esc(row.item)}</span></div>`},
    {key: 'sold_title', label: 'Publicación comprada', width: '28%', format: (value, row) => `<div class="product-cell"><span class="name">${esc(value)}</span><span class="mono">${esc(row.sold_item)}</span></div>`},
    {key: 'attribution', label: 'Tipo', width: '12%'}, {key: 'sales', label: 'Ventas', width: '12%', align: 'r', format: n}, {key: 'income', label: 'Ingresos', width: '16%', align: 'r', format: money}
  ], details: row => adsDetail('attributed_sales', row), summary: rows => adsSummary(rows, 'attributed_sales')});
  el('ads-actions').innerHTML = action('Revisar gasto sin ventas', `${n(adData.signals.no_sales_ad_campaign_rows)} filas suman ${money(adData.signals.no_sales_spend)} sin ventas atribuidas (${pct(adData.signals.no_sales_share_of_spend_pct)} de la inversión).`, 'Filtrar “Con gasto, sin ventas”, ordenar por inversión y revisar publicación, precio y segmentación antes de mantener el gasto.', 'urgent') +
    action('Revisar campañas bajo objetivo', `${n(adData.signals.campaigns_below_target.length)} campañas con gasto quedaron por debajo de su ROAS objetivo del export.`, 'Abrir Campañas y comparar ROAS real con objetivo. Confirmar costos antes de ampliar presupuesto.') +
    action('Atender el ranking', `${n(adData.signals.campaigns_limited_more_by_ranking.length)} campañas con actividad perdieron más impresiones por ranking que por presupuesto.`, 'Revisar relevancia y calidad de las publicaciones; contrastar el dato antes de aumentar presupuesto.', 'info');
  const viewLabels = {campaigns: 'Campañas', placements: 'Ubicaciones', attributed_sales: 'Ventas atribuidas'};
  const keyLabels = {impressions: 'impresiones', clicks: 'clics', spend: 'inversión', income: 'ingresos', sales: 'ventas', sales_direct: 'ventas directas', sales_indirect: 'ventas asistidas'};
  const reconciliation = Object.entries(adData.reconciliation).map(([view, values]) => {
    const differences = Object.entries(values).filter(([, value]) => !value.matches || value.compared_missing_rows > 0);
    return `<div class="metric-detail"><h4>${esc(viewLabels[view])}</h4><p>${differences.length ? differences.map(([key, value]) => `${esc(keyLabels[key] || key)}: ${currencyFields.has(key) ? money(value.compared) : n(value.compared)} frente a ${currencyFields.has(key) ? money(value.ads_primary) : n(value.ads_primary)} en anuncios${value.compared_missing_rows ? ` · ${n(value.compared_missing_rows)} filas sin dato` : ''}`).join('<br>') : 'Ingresos y conteos de ventas coinciden con anuncios.'}</p></div>`;
  }).join('');
  el('ads-reconciliation').innerHTML = reconciliation + '<p class="detail-note">La diferencia se muestra, pero su causa no está identificada. Para comparar conversiones, pedir los mismos reportes con igual corte y alcance. Se conserva anuncios como fuente principal del resultado.</p>' + list(adData.budget_comparison.filter(row => !row.same_value).map(row => `${row.campaign}: presupuesto en campañas ${money(row.campaign_budget_reported)}; diario en ubicaciones ${row.placement_daily_budgets_reported.map(money).join(', ')}. No son gasto ejecutado.`));

  const operationData = review.operations.operations;
  const agency = operationData.agencies;
  const flex = operationData.flex;
  const incidents = operationData.incidents;
  const agencyWeek = agency.latest_week;
  const agencyFour = agency.four_weeks;
  const flexWeek = flex.latest_week;
  el('operation-kpis').innerHTML = kpi('Agencias · 24–30/08', pct(agencyWeek.computed_pct), `${n(agencyWeek.on_time)} de ${n(agencyWeek.analyzed)} a tiempo · ${agencyWeek.exposure}`) + kpi('Agencias · 03–30/08', pct(agencyFour.computed_pct), `${n(agencyFour.on_time)} de ${n(agencyFour.analyzed)} · ${n(agencyFour.excluded)} excluidos`) + kpi('Flex · 24–30/08', pct(flexWeek.computed_pct), `${n(flexWeek.on_time)} de ${n(flexWeek.analyzed)} · ${flexWeek.exposure}`) + kpi('Envíos de agosto', n(DATA.sales.shipments), `${n(DATA.sales.canceled_shipments)} cancelados, contados aparte`);
  const weeks = [...agency.weeks.map(row => ({...row, channel: 'Agencias'})), ...flex.weeks.map(row => ({...row, channel: 'Flex'}))];
  mountTable({table: 'shipping-weeks-table', title: 'Desempeño semanal de despachos y entregas', rows: weeks, sort: 'start', direction: 'asc', unit: 'semanas/canal', searchKeys: ['label', 'channel'], filters: [{id: 'shipping-channel', label: 'Canal', get: row => row.channel}], columns: [
    {key: 'label', label: 'Semana', format: (value, row) => `<div class="product-cell"><span class="name">${esc(value)}</span>${badge(row.channel)}</div>`}, {key: 'analyzed', label: 'Evaluados', align: 'r', format: n}, {key: 'on_time', label: 'A tiempo', align: 'r', format: n}, {key: 'late_analyzed', label: 'Demorados', align: 'r', format: n}, {key: 'pct', label: 'Cumplimiento', align: 'r', format: pct}
  ], sortOptions: [{key: 'start', label: 'Fecha de la semana'}], details: row => detailGrid([['Envíos físicos', n(row.physical_shipments)], ['Excluidos del porcentaje', n(row.excluded)], ['Envíos con cruce a ventas de agosto', n(row.sales_matched_shipments)], ['Salida de la ventana móvil de cuatro semanas', row.leaves_rolling_4_week_window_from ? esc(row.leaves_rolling_4_week_window_from) : 'No informado: Flex sólo trae una semana']]) + '<p class="detail-note">Semana asignada por fecha límite de despacho o entrega, no por la fecha de compra. La fecha de salida supone que el próximo reporte conserva la misma ventana semanal. El porcentaje usa sólo envíos evaluados.</p>', summary: rows => [...new Set(rows.map(row => row.channel))].map(channel => { const group = rows.filter(row => row.channel === channel); return `${esc(channel)}: ${n(sum(group, 'on_time'))} a tiempo de ${n(sum(group, 'analyzed'))} evaluados · ${n(sum(group, 'excluded'))} excluidos`; }).join(' · ') + '. Cada canal conserva su propia ventana.'});
  mountTable({table: 'channels-table', title: 'Canales de los envíos de agosto', rows: operationData.sales_channels, sort: 'shipments_non_canceled', unit: 'canales', searchKeys: ['channel'], columns: [
    {key: 'channel', label: 'Canal'}, {key: 'shipments_non_canceled', label: 'Envíos', align: 'r', format: n}, {key: 'share_shipments_pct', label: 'Del total', align: 'r', format: pct}, {key: 'units_net', label: 'Unidades', align: 'r', format: n}, {key: 'units_per_shipment', label: 'Unidades/envío', align: 'r', format: value => hasNumber(value) ? Number(value).toLocaleString('es-UY', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : 'Sin dato'}
  ], details: row => detailGrid([['Envíos cancelados', n(row.shipments_canceled)], ['Paquetes con varios productos, sin cancelar', n(row.multiproduct_shipments_non_canceled)], ['Todos los envíos, incluidos cancelados', n(row.shipments_all)]]) + '<p class="detail-note">Ventas UY de agosto. Cada paquete cuenta una vez. “Acuerdo con el comprador” no tiene un reporte de reputación en estas fuentes.</p>', summary: rows => `${n(sum(rows, 'shipments_non_canceled'))} envíos sin cancelación · ${n(sum(rows, 'units_net'))} unidades operativas · ${n(sum(rows, 'shipments_canceled'))} envíos cancelados aparte.`});
  mountTable({table: 'zones-table', title: 'Entregas Flex por zona del 24 al 30 de agosto', rows: flex.zones, sort: 'late_analyzed', unit: 'zonas', searchKeys: ['label'], filters: [{id: 'zone-result', label: 'Resultado', get: row => row.late_analyzed > 0 ? 'Con demoras' : 'A tiempo'}], columns: [
    {key: 'label', label: 'Zona'}, {key: 'analyzed', label: 'Evaluados', align: 'r', format: n}, {key: 'on_time', label: 'A tiempo', align: 'r', format: n}, {key: 'late_analyzed', label: 'Demorados', align: 'r', format: n}, {key: 'pct', label: 'Cumplimiento', align: 'r', format: pct}
  ], details: row => detailGrid([['Envíos físicos', n(row.physical_shipments)], ['Excluidos', n(row.excluded)], ['Afectación de reputación explícita', n(row.affected_reputation_explicit)], ['Con cruce a ventas del mes', n(row.sales_matched_shipments)]]) + '<p class="detail-note">La zona es la etiqueta del reporte Flex. Una zona con pocos envíos no prueba una tendencia. El efecto en reputación sólo se cuenta cuando el archivo lo declara.</p>', summary: rows => `${n(sum(rows, 'on_time'))} entregas a tiempo de ${n(sum(rows, 'analyzed'))} evaluadas · ${n(sum(rows, 'late_analyzed'))} demoradas.`});
  el('incident-kpis').innerHTML = kpi('Reclamos', n(incidents.claims.unique_august_sale), `${n(incidents.claims.unique_august_sale_matched)} cruzan con Ventas UY`) + kpi('Despachos demorados', n(incidents.delayed.unique_august_sale), `${n(incidents.delayed.unique_august_sale_matched)} cruzan con Ventas UY`) + kpi('Cancelaciones propias', n(incidents.seller_cancellations.unique_august_sale), `${n(incidents.seller_cancellations.unique_august_sale_matched)} cruzan con Ventas UY`);
  el('incident-context').innerHTML = `<p>Incidentes asociados a ventas de agosto, deduplicados dentro de cada reporte. ${n(incidents.claims.unique_august_sale_unmatched)} reclamos y ${n(incidents.delayed.unique_august_sale_unmatched)} demoras no encuentran un cruce exacto con Ventas UY; conservamos esos casos en los totales, sin asignarlos a un producto por parecido.</p><p>En las coincidencias hay ${n(incidents.cross_report_overlap.claims_and_delayed_shipments)} envío con reclamo y demora: no sumes incidentes como si fueran envíos distintos. Un paquete puede involucrar varias publicaciones.</p>` + metricDetail('Motivos de reclamo informados', incidents.claims.august_by_type.map(row => [row.group, n(row.count)]));
  const incidentRows = incidents.by_publication.map(row => ({...row, total: row.claims + row.delayed + row.seller_cancellations}));
  mountTable({table: 'incidents-table', title: 'Publicaciones vinculadas a incidentes con cruce exacto', rows: incidentRows, sort: 'total', unit: 'publicaciones', searchKeys: ['title', 'item', 'skus'], filters: [{id: 'incident-type', label: 'Reclamos', get: row => row.claims > 0 ? 'Con reclamos' : 'Sin reclamos'}], columns: [
    {key: 'title', label: 'Publicación', format: (value, row) => `<div class="product-cell"><span class="name">${esc(value)}</span><span class="mono">${esc(row.skus.join(' · '))}</span></div>`}, {key: 'claims', label: 'Reclamos', align: 'r', format: n}, {key: 'delayed', label: 'Demoras', align: 'r', format: n}, {key: 'seller_cancellations', label: 'Cancelaciones propias', align: 'r', format: n}
  ], sortOptions: [{key: 'total', label: 'Incidentes vinculados'}], details: row => detailGrid([['Publicación', itemLink(row.item)], ['SKU presentes en el cruce', esc(row.skus.join(', '))]]) + '<p class="detail-note">Vínculo comprobado por el identificador de venta, sin mostrarlo. Un incidente de un paquete puede aparecer en varias publicaciones. El vínculo no demuestra que el producto haya causado la demora o el reclamo.</p>', summary: rows => `${n(rows.length)} publicaciones del subconjunto con cruce exacto. No sumes columnas ni publicaciones para reconstruir el total de incidentes.`});
  const worstWeek = agency.weeks.reduce((worst, row) => row.pct < worst.pct ? row : worst, agency.weeks[0]);
  el('operation-actions').innerHTML = action('Recuperar el despacho por agencia', `Última semana: ${n(agencyWeek.late_analyzed)} de ${n(agencyWeek.analyzed)} despachos llegaron tarde. Dentro de ese total hacían falta ${n(agencyWeek.additional_on_time_needed_fixed_denominator_90pct)} a tiempo más para alcanzar una meta interna de 90%.`, 'Preparar antes del horario límite y revisar pendientes cada día. El 90% es una meta propuesta, no una garantía de destaque.', 'urgent') + action('Seguir la ventana de cuatro semanas', `La semana ${worstWeek.label} cerró en ${pct(worstWeek.pct)} y deja de integrar esa ventana desde ${worstWeek.leaves_rolling_4_week_window_from}.`, 'Comparar el próximo reporte con sus propias fechas; una semana mala sigue pesando aunque mejore la siguiente.', 'info') + action('Revisar la excepción Flex', `${n(flexWeek.late_analyzed)} entrega demorada de ${n(flexWeek.analyzed)} evaluadas. El export mantiene “${flexWeek.exposure}”.`, flex.late_details.length ? `Revisar ${flex.late_details[0].zone}: ${(flex.late_details[0].detail || 'demora registrada').replace(/\.$/, '')}. Confirmar la causa y ajustar la coordinación de esa ruta.` : 'Mantener seguimiento de la entrega y su fecha límite.');

  const catalog = review.operations.catalog;
  const catalogSummary = catalog.summary;
  const catalogRows = catalog.publications.map(row => ({...row, sku: row.skus.join(' '), units_net: row.sales?.units_net ?? 0, income: row.sales?.income ?? 0}));
  el('catalog-coverage').textContent = `${n(catalogSummary.unique_publications)} publicaciones · ${n(catalogSummary.source_variant_rows)} filas/variantes · ${n(catalogSummary.catalog_publications)} de catálogo`;
  el('catalogo').querySelector('.lede').textContent = '“Sí” y “No” son respuestas válidas. Las variantes toman correctamente los valores compartidos. Un blanco en el Excel puede ser un “No aplica” de Mercado Libre: queda por verificar, no como una obligación de completar.';
  const catalogLocation = occurrence => `${esc(occurrence.sku || 'Sin SKU')} · hoja ${esc(occurrence.source_sheet)}, celda ${esc(occurrence.source_cell || String(occurrence.source_row))}`;
  const catalogReference = occurrence => occurrence.resolution?.kind === 'reference' ? ` · toma el valor de ${esc(occurrence.resolution.source_cell)}` : '';
  const catalogUnknown = occurrence => occurrence.kind === 'unresolved_formula' ? 'El archivo no permite resolver este valor.' : occurrence.kind === 'placeholder' ? 'El export trae un texto de ejemplo; confirmar si corresponde un dato o una excepción.' : occurrence.selector === 'yes_no' ? 'Selector Sí/No sin respuesta visible en el export; revisar la selección en Mercado Libre.' : 'Sin valor visible en el export; puede estar sin completar o marcado No aplica en Mercado Libre.';
  const catalogDetails = row => {
    const unverified = row.missing_count ? `<h4 class="detail-section-title">Campos por verificar en Mercado Libre · ${n(row.missing_count)}</h4><ul class="field-list">${row.missing_attributes.map(attribute => `<li><strong>${esc(attribute.label)}</strong>${attribute.occurrences.map(occurrence => `<p>${catalogLocation(occurrence)}${catalogReference(occurrence)}<br>${esc(catalogUnknown(occurrence))}</p>`).join('')}</li>`).join('')}</ul>` : '<p class="detail-note">Todos los atributos revisados tienen una respuesta legible en este archivo. Esto no certifica los requisitos actuales de Mercado Libre.</p>';
    const recorded = (row.recorded_attributes || []).map(attribute => `<li><strong>${esc(attribute.label)}</strong>${attribute.occurrences.map(occurrence => `<p>${badge(occurrence.state === 'not_applicable' ? 'No aplica' : occurrence.value, 'good')}<br>${catalogLocation(occurrence)}${catalogReference(occurrence)}</p>`).join('')}</li>`).join('');
    return detailGrid([['Publicación', itemLink(row.item)], ['Tipo de ficha', badge(row.catalog ? 'Catálogo' : 'Propia', row.catalog ? 'info' : 'mute')], ['Estado al corte', badge(row.state, fold(row.state) === 'activa' ? 'good' : 'mute')], ['Filas/variantes revisadas', n(row.variant_rows)], ['Respuestas Sí/No válidas', n(row.yes_no_cells)], ['Respuestas recuperadas entre variantes', n(row.inherited_answer_cells)]]) + unverified + `<details><summary>Ver respuestas registradas · ${n((row.recorded_attributes || []).length)} atributos</summary><ul class="field-list">${recorded}</ul></details><p class="detail-note"><strong>Qué hacer:</strong> ${esc(row.action)}</p><p class="detail-note"><strong>Cómo leer la cobertura:</strong> respuestas legibles del archivo ÷ celdas de atributos revisadas × 100. Incluye Sí, No y No aplica explícito. No es un puntaje de calidad ni un porcentaje de requisitos obligatorios de ML. Un campo por verificar se cuenta una vez por publicación; el detalle conserva cada variante.</p>`;
  };
  mountTable({table: 'catalog-table', title: 'Lectura del catálogo por publicación', search: 'catalog-search', rows: catalogRows, sort: 'income', unit: 'publicaciones', searchKeys: ['title', 'sku', 'item', 'category', 'missing_fields'], filters: [{id: 'catalog-filter', label: 'Ventas', get: row => row.has_net_sales ? 'Con ventas' : 'Sin ventas'}, {id: 'catalog-completion', label: 'Revisión', get: row => row.missing_count > 0 ? 'Por verificar en ML' : 'Sin blancos en el export'}, {id: 'catalog-type', label: 'Tipo', get: row => row.catalog ? 'Catálogo' : 'Propia'}], columns: [
    {key: 'title', label: 'Publicación', format: (value, row) => `<div class="product-cell"><span class="name">${esc(value)}</span><span class="mono">${esc(row.skus.join(' · '))} · ${n(row.variant_rows)} fila(s)</span></div>`},
    {key: 'units_net', label: 'Unidades operativas', align: 'r', format: n},
    {key: 'income', label: 'Ingresos', align: 'r', format: money},
    {key: 'completion_pct', label: 'Cobertura del export', align: 'r', format: pct},
    {key: 'missing_count', label: 'Campos por verificar', align: 'r', format: n}
  ], details: catalogDetails, summary: rows => `${n(rows.length)} publicaciones · ${n(sum(rows, 'missing_count'))} campos por verificar, contados por publicación · ${n(rows.filter(row => row.has_net_sales && row.missing_count > 0).length)} publicaciones con ventas para revisar · ${n(sum(rows, 'units_net'))} unidades operativas. Los campos por verificar no son faltantes confirmados.`});
  el('catalog-actions').innerHTML = action('Respuestas de variantes recuperadas', `${n(catalogSummary.inherited_answer_cells)} respuestas válidas estaban enlazadas a otra fila y ya no se cuentan como vacíos. Se reconocen ${n(catalogSummary.yes_no_cells)} respuestas Sí/No entre todas las variantes.`, 'Abrí “Ver respuestas registradas” para revisar el valor y la celda de donde se tomó.', 'info') + action('Confirmar antes de completar', `${n(catalogSummary.sold_missing_attributes)} campos de ${n(catalogSummary.sold_incomplete_publications)} publicaciones con ventas no tienen una respuesta verificable en el archivo.`, 'Filtrar “Con ventas” y “Por verificar en ML”. Si el campo ya tiene una respuesta o No aplica en Mercado Libre, no requiere corrección.', 'info');


  const additionalNotes = [
    {level: 'warn', title: 'Ads: diferencias de cobertura visibles', body: `Campañas informa ${n(adData.totals.campaigns.sales)} ventas frente a ${n(totals.sales)} de anuncios. Ubicaciones informa ${money(adData.totals.placements.spend)} de inversión frente a ${money(totals.spend)}, con importes ausentes. No se sustituyen los totales del resultado por los de otra vista.`},
    {level: 'ok', title: 'Catálogo: respuestas de variantes recuperadas', body: `${n(catalogSummary.inherited_answer_cells)} respuestas enlazadas entre variantes se recuperaron sin cambiar el Excel. Sí y No son respuestas válidas. Quedan ${n(catalogSummary.sold_missing_attributes)} campos de publicaciones con ventas por verificar en ML: un blanco del export no confirma que falte completarlo ni permite distinguir todos los No aplica.`},
    {level: 'warn', title: 'Cruces de incidentes parciales', body: `Reclamos: ${n(incidents.claims.unique_august_sale_matched)}/${n(incidents.claims.unique_august_sale)}; demoras: ${n(incidents.delayed.unique_august_sale_matched)}/${n(incidents.delayed.unique_august_sale)}; cancelaciones propias: ${n(incidents.seller_cancellations.unique_august_sale_matched)}/${n(incidents.seller_cancellations.unique_august_sale)} coinciden con Ventas UY. Los restantes no se asignan por parecido. Los reportes de agencias y Flex tienen ventanas propias.`},
    {level: 'warn', title: 'No hay cuatro semanas de Flex en este export', body: 'Agencias permite comparar cuatro semanas. Flex sólo trae el 24–30/08; no se construye una tendencia mensual con una única semana.'}
  ];
  const reviewNotes = [...notes.filter(note => note.title !== 'Ads son cuatro vistas solapadas'), ...additionalNotes];
  el('notes').innerHTML = reviewNotes.map(note => `<details class="q ${note.level}"><summary>${esc(plainCopy(note.title))}<span class="tagline">${note.level === 'ok' ? 'verificado' : 'alcance / revisión'}</span></summary><div class="body"><p>${esc(plainCopy(note.body))}</p></div></details>`).join('');
  el('note-count').textContent = `${n(reviewNotes.length)} notas y controles`;
  el('team-summary').innerHTML = [
    `Agosto dejó ${money(DATA.profit.contribution)} de aporte estimado, antes de gastos operativos faltantes.`,
    `Se registraron ${n(DATA.sales.net_units)} unidades operativas y ${n(DATA.sales.shipments)} envíos sin cancelación.`,
    `Ads invirtió ${money(totals.spend)} con ROAS ${roas(totals.roas)}; no equivale a ganancia.`,
    `Revisar ${money(adData.signals.no_sales_spend)} de gasto en filas de anuncios sin ventas atribuidas.`,
    `Priorizar agencias: ${pct(agencyWeek.computed_pct)} a tiempo; Flex alcanzó ${pct(flexWeek.computed_pct)}.`,
    `Verificar en ML los campos sin respuesta visible de ${n(catalogSummary.sold_incomplete_publications)} publicaciones con ventas.`,
    'Revisar la vigencia y el resultado propio de promociones y cupones antes de repetirlos.',
    `Conciliar el residual ${money(DATA.sales.finance.other_adjustments)} y confirmar ${n(DATA.profit.return_units_in_cogs)} unidades devueltas.`
  ].map(text => `<li><span>${esc(text)}</span></li>`).join('');
})();
