(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const money = value => value === null || value === undefined ? 'Pendiente' : '$ ' + new Intl.NumberFormat('es-UY', {maximumFractionDigits: 2}).format(value);
  const integer = value => new Intl.NumberFormat('es-UY', {maximumFractionDigits: 0}).format(value);
  const priorityOrder = {urgent: 0, high: 1, minor: 2, none: 3};
  const priorities = {
    urgent: {label: 'Urgente', plural: 'Urgentes', title: 'Validar antes de valorar', description: 'Hay una equivalencia de unidad o pack sin confirmar.'},
    high: {label: 'Alta', plural: 'Altas', title: 'Completar o revisar datos', description: 'El stock o el bloque de costos no permite una lectura confiable.'},
    minor: {label: 'Menor', plural: 'Menores', title: 'Ordenar antes de reponer', description: 'Producto actualmente sin stock registrado.'},
    none: {label: 'Sin alerta', plural: 'Sin alerta', title: 'Sin alerta actual', description: 'No se encontró una alerta de integridad en esta foto.'}
  };
  const actionLabels = {
    'verify-unit': 'Validar pack y unidad', 'invalid-stock': 'Revisar stock registrado', 'missing-purchase': 'Completar compra declarada',
    'invalid-currency': 'Revisar moneda de compra', 'missing-cost': 'Completar costo final', 'formula-difference': 'Revisar cálculos del Maestro', 'zero-stock': 'Producto sin stock',
    'missing-price-web': 'Completar precio Web', 'missing-price-ml': 'Completar precio Mercado Libre',
    'negative-margin-web': 'Revisar margen negativo Web', 'negative-margin-ml': 'Revisar margen negativo Mercado Libre',
    'low-margin-web': 'Revisar margen bajo Web', 'low-margin-ml': 'Revisar margen bajo Mercado Libre'
  };

  try {
    const data = JSON.parse($('stock-position-data').textContent);
    if (!Array.isArray(data.products) || !data.products.length) throw new Error('No hay productos en esta lectura.');
    const {products, summary, parameters, rules = {lowMargin: 0.15}} = data;
    const state = {query: '', category: 'all', priority: 'all', stock: 'all', margin: 'all', sort: 'priority', direction: 1, page: 1, size: 12};
    const sourceDate = new Date(String(data.meta.fetchedAtUtc).replace(' UTC', 'Z').replace(' ', 'T'));
    if (Number.isNaN(sourceDate.getTime())) throw new Error('La fecha de lectura no es válida.');
    const timestamp = new Intl.DateTimeFormat('es-UY', {dateStyle: 'medium', timeStyle: 'short', hour12: false, timeZone: data.meta.timeZone || 'America/Montevideo'}).format(sourceDate);
    $('snapshot-date').textContent = timestamp + ' · Uruguay';
    $('snapshot-source').textContent = `${data.meta.title} · Articulos + Parametros`;
    $('footer-source').textContent = `Fuente: ${data.meta.title} · Lectura ${timestamp} (UY)`;
    if (data.meta.spreadsheetId) {
      $('source-link').href = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(data.meta.spreadsheetId)}/edit`;
      $('source-link').target = '_blank';
      $('source-link').rel = 'noopener noreferrer';
      $('source-link').innerHTML = 'Abrir Maestro <span aria-hidden="true">↗</span>';
    }

    $('kpis').innerHTML = [
      {label: 'Productos del Maestro', value: integer(summary.products), detail: `${new Set(products.map(product => product.category)).size} categorías · clave por SKU`},
      {label: 'Unidades registradas', value: integer(summary.stock), detail: 'Suma literal de STOCK; no convierte packs.'},
      {label: 'Valor estimado con cobertura', value: money(summary.stockValue), detail: `${integer(summary.valuedRows)} de ${integer(summary.stockRows)} productos con stock son valorizables.`},
      {label: 'Márgenes a revisar', value: integer(summary.negativeMargins), detail: `${integer(summary.webMarginKnown)} Web y ${integer(summary.mlMarginKnown)} ML calculables.`, attention: true}
    ].map(item => `<article class="kpi${item.attention ? ' attention' : ''}"><span class="label">${item.label}</span><strong>${item.value}</strong><p>${item.detail}</p></article>`).join('');

    const categories = [...new Set(products.map(product => product.category))].sort((a, b) => a.localeCompare(b, 'es'));
    $('category').insertAdjacentHTML('beforeend', categories.map(category => `<option value="${escape(category)}">${escape(category)}</option>`).join(''));
    $('parameters').innerHTML = [
      ['Tipo de cambio USD/UYU', money(parameters.exchange)],
      ['Coeficiente de importación', '× ' + parameters.importFactor],
      ['Coeficiente de impuestos', '× ' + parameters.taxFactor],
      ['Comisión Web estimada', new Intl.NumberFormat('es-UY', {style: 'percent', maximumFractionDigits: 1}).format(parameters.webFee)],
      ['Comisión ML estimada', new Intl.NumberFormat('es-UY', {style: 'percent', maximumFractionDigits: 1}).format(parameters.mlFee)]
    ].map(([label, value]) => `<div class="parameter"><span>${label}</span><strong>${value}</strong></div>`).join('');
    $('priority-rules').innerHTML = `<ul><li><strong>Urgente:</strong> la nota actual pide validar equivalencia de pack, piezas o unidades; también un margen negativo en un canal con stock.</li><li><strong>Alta:</strong> stock, compra, moneda, costo o cálculo incompleto; precio faltante en un canal publicado; o margen por debajo de ${new Intl.NumberFormat('es-UY', {style: 'percent', maximumFractionDigits: 0}).format(rules.lowMargin)} con stock.</li><li><strong>Menor:</strong> stock actual igual a cero.</li><li><strong>Sin alerta:</strong> no significa demanda, venta ni rentabilidad; sólo que estas reglas no encontraron un problema.</li></ul><p>Los márgenes son unitarios y estimados con el precio y comisión actual del Maestro. No hay comparaciones contra fotos anteriores.</p>`;

    const textFor = product => normalize([product.sku, product.name, product.category, product.notes].join(' '));
    function matchesStock(product) {
      if (state.stock === 'positive') return product.stock !== null && product.stock > 0;
      if (state.stock === 'zero') return product.stock === 0;
      if (state.stock === 'unknown') return product.stock === null || product.stock < 0;
      return true;
    }
    function matchesMargin(product) {
      const channels = [product.web, product.ml];
      if (state.margin === 'negative') return channels.some(channel => channel.margin !== null && channel.margin < 0);
      if (state.margin === 'low') return channels.some(channel => channel.margin !== null && channel.margin >= 0 && channel.pct < rules.lowMargin);
      if (state.margin === 'known') return channels.some(channel => channel.margin !== null);
      if (state.margin === 'missing') return channels.some(channel => channel.margin === null);
      return true;
    }
    function filtered() {
      return products.filter(product => (!state.query || textFor(product).includes(normalize(state.query))) && (state.category === 'all' || product.category === state.category) && (state.priority === 'all' || product.priority === state.priority) && matchesStock(product) && matchesMargin(product));
    }
    function sortValue(product, key) {
      if (key === 'priority') return priorityOrder[product.priority];
      if (key === 'name') return normalize(product.name);
      if (key === 'sku') return normalize(product.sku);
      if (key === 'category') return normalize(product.category);
      if (key === 'stock') return product.stock === null ? -Infinity : product.stock;
      if (key === 'cost') return product.finalCost === null ? -Infinity : product.finalCost;
      if (key === 'web-margin') return product.web.margin === null ? -Infinity : product.web.margin;
      if (key === 'ml-margin') return product.ml.margin === null ? -Infinity : product.ml.margin;
      if (key === 'valuation') return product.stockValue === null ? -Infinity : product.stockValue;
      return 0;
    }
    function sorted(items) {
      return [...items].sort((left, right) => {
        const a = sortValue(left, state.sort), b = sortValue(right, state.sort);
        const comparison = typeof a === 'string' ? a.localeCompare(b, 'es') : a - b;
        return comparison * state.direction || left.sku.localeCompare(right.sku, 'es');
      });
    }
    function actionHtml(action) {
      return `<article class="action"><span class="priority-badge ${action.priority}">${priorities[action.priority].label}</span><div><h4>${escape(action.title)}</h4><p><strong>Qué pasa:</strong> ${escape(action.why)}</p><p><strong>Qué hacer:</strong> ${escape(action.next)}</p></div></article>`;
    }
    function productHtml(product) {
      const status = priorities[product.priority];
      const components = [
        ['Compra', product.purchase === null ? 'Pendiente' : `${product.currency} ${new Intl.NumberFormat('es-UY', {maximumFractionDigits: 2}).format(product.purchase)}`],
        ['Costo base', money(product.baseCost)],
        ['Recargo de importación', money(product.importCharge)],
        ['IVA de importación', money(product.importTax)],
        ['Costo final', money(product.finalCost)]
      ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('');
      const channelMetric = (label, channel, type) => `<div class="channel-metric ${type}"><span>${label}</span><strong>${money(channel.price)}</strong><small class="${channel.margin !== null && channel.margin < 0 ? 'negative' : ''}">Margen $: ${money(channel.margin)}</small></div>`;
      const channelDetail = (label, channel, type) => `<section class="channel-detail ${type}"><p class="channel-title">${label}</p><div><span>Precio registrado</span><strong>${money(channel.price)}</strong></div><div><span>Comisión estimada</span><strong>${money(channel.commission)}</strong></div><div><span>Margen unitario estimado</span><strong class="${channel.margin !== null && channel.margin < 0 ? 'negative' : ''}">${money(channel.margin)}</strong><small>${channel.pct === null ? 'Pendiente' : new Intl.NumberFormat('es-UY', {style: 'percent', maximumFractionDigits: 1}).format(channel.pct)} del precio</small></div></section>`;
      const audit = product.auditDifferences.length ? `<p class="audit-note">El modelo recalculó ${product.auditDifferences.map(item => escape(item.header)).join(', ')} y detectó una diferencia. Ver alerta.</p>` : '';
      return `<article class="product-card ${product.priority}"><div class="product-top"><div><p class="sku">${escape(product.sku)}</p><h3>${escape(product.name)}</h3><p class="category">${escape(product.category)}</p></div><span class="priority-badge ${product.priority}">${status.label}</span></div><div class="product-metrics"><div><span>Stock actual</span><strong>${product.stock === null ? 'Por revisar' : integer(product.stock)}</strong></div><div><span>Costo final</span><strong>${money(product.finalCost)}</strong></div>${channelMetric('Web', product.web, 'web')}${channelMetric('Mercado Libre', product.ml, 'ml')}<div class="valuation"><span>Valor estimado del stock</span><strong>${product.stockValue === null ? 'Pendiente' : money(product.stockValue)}</strong></div></div><details><summary>Ver costo, margen y alertas <span aria-hidden="true">↓</span></summary><div class="detail"><div class="cost-grid">${components}</div><div class="channel-details">${channelDetail('Web', product.web, 'web')}${channelDetail('Mercado Libre', product.ml, 'ml')}</div>${audit}${product.notes ? `<p class="notes"><strong>Nota del Maestro:</strong> ${escape(product.notes)}</p>` : ''}<div class="actions">${product.actions.length ? product.actions.map(actionHtml).join('') : '<p class="no-action">Sin alerta actual para este producto.</p>'}</div><p class="lineage">Lectura de la fila ${product.sheetRow} del Maestro. Este panel no modifica la fuente.</p></div></details></article>`;
    }
    function renderActions() {
      $('action-cards').innerHTML = ['urgent', 'high', 'minor'].map(priority => {
        const matching = products.filter(product => product.priority === priority);
        const firstCodes = new Map();
        matching.forEach(product => product.actions.filter(action => action.priority === priority).forEach(action => firstCodes.set(action.code, (firstCodes.get(action.code) || 0) + 1)));
        const reasons = [...firstCodes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
        return `<article class="action-card ${priority}"><div class="card-top"><span class="priority-label">${priorities[priority].plural}</span><span class="count">${matching.length}</span></div><h3>${priorities[priority].title}</h3><p>${priorities[priority].description}</p>${reasons.length ? `<ul>${reasons.map(([code, count]) => `<li><strong>${count}</strong> · ${escape(actionLabels[code] || code)}</li>`).join('')}</ul>` : '<p>Sin productos en esta prioridad.</p>'}<button class="button" type="button" data-priority="${priority}"${matching.length ? '' : ' disabled'}>Ver productos <span aria-hidden="true">↗</span></button></article>`;
      }).join('');
    }
    function render() {
      const items = sorted(filtered());
      const totalPages = state.size === 'all' ? 1 : Math.max(1, Math.ceil(items.length / state.size));
      state.page = Math.min(state.page, totalPages);
      const shown = state.size === 'all' ? items : items.slice((state.page - 1) * state.size, state.page * state.size);
      $('result-count').textContent = `${integer(items.length)} producto${items.length === 1 ? '' : 's'} encontrados`;
      $('product-list').innerHTML = shown.map(productHtml).join('');
      $('empty-state').hidden = items.length !== 0;
      $('product-list').hidden = items.length === 0;
      $('page-status').textContent = state.size === 'all' ? 'Todos los resultados' : `Página ${state.page} de ${totalPages}`;
      $('previous').disabled = state.page === 1 || state.size === 'all';
      $('next').disabled = state.page === totalPages || state.size === 'all';
      $('sort-direction').textContent = state.direction === 1 ? 'Ascendente ↑' : 'Descendente ↓';
      $('sort-direction').setAttribute('aria-label', state.direction === 1 ? 'Cambiar orden a descendente' : 'Cambiar orden a ascendente');
    }
    function reset() {
      Object.assign(state, {query: '', category: 'all', priority: 'all', stock: 'all', margin: 'all', sort: 'priority', direction: 1, page: 1, size: 12});
      ['search', 'category', 'priority', 'stock', 'margin', 'sort', 'page-size'].forEach(id => $(id).value = id === 'page-size' ? '12' : (id === 'sort' ? 'priority' : ''));
      $('category').value = 'all'; $('priority').value = 'all'; $('stock').value = 'all'; $('margin').value = 'all';
      render();
    }
    function setFilter(target) {
      const field = target.id === 'search' ? 'query' : target.id;
      state[field] = target.value;
      state.page = 1;
      render();
    }
    $('filters').addEventListener('input', event => setFilter(event.target));
    $('filters').addEventListener('change', event => setFilter(event.target));
    $('sort').addEventListener('change', event => { state.sort = event.target.value; state.page = 1; render(); });
    $('page-size').addEventListener('change', event => { state.size = event.target.value === 'all' ? 'all' : Number(event.target.value); state.page = 1; render(); });
    $('sort-direction').addEventListener('click', () => { state.direction *= -1; render(); });
    $('previous').addEventListener('click', () => { state.page -= 1; render(); });
    $('next').addEventListener('click', () => { state.page += 1; render(); });
    ['reset-filters', 'empty-reset'].forEach(id => $(id).addEventListener('click', reset));
    $('action-cards').addEventListener('click', event => {
      const button = event.target.closest('[data-priority]');
      if (!button) return;
      state.priority = button.dataset.priority; $('priority').value = state.priority; state.page = 1; render(); $('productos').scrollIntoView({behavior: 'smooth'});
    });

    const simulator = $('simulator-form');
    for (const [name, value] of [['exchange', parameters.exchange], ['importFactor', parameters.importFactor], ['taxFactor', parameters.taxFactor]]) simulator.elements[name].value = value;
    simulator.elements.purchase.value = 1;
    function renderSimulation() {
      const values = Object.fromEntries(new FormData(simulator));
      const purchase = Number(values.purchase), units = Number(values.units), exchange = Number(values.exchange), importFactor = Number(values.importFactor), taxFactor = Number(values.taxFactor);
      if (![purchase, units, exchange, importFactor, taxFactor].every(Number.isFinite) || purchase < 0 || units < 1 || exchange <= 0 || importFactor < 1 || taxFactor < 1) {
        $('simulation-result').innerHTML = '<p>Completá valores válidos para ver el escenario.</p>'; return;
      }
      const imported = values.currency === 'USD';
      const base = imported ? purchase * exchange : purchase;
      const importCharge = imported ? base * (importFactor - 1) : 0;
      const tax = imported ? (base + importCharge) * (taxFactor - 1) : 0;
      const final = base + importCharge + tax;
      $('simulation-result').innerHTML = `<p class="simulation-label">Escenario estimado</p><strong class="simulation-main">${money(final)} <small>por unidad</small></strong><dl><div><dt>Costo base</dt><dd>${money(base)}</dd></div><div><dt>Importación</dt><dd>${money(importCharge)}</dd></div><div><dt>IVA de importación</dt><dd>${money(tax)}</dd></div><div><dt>Valor estimado del lote</dt><dd>${money(final * units)}</dd></div></dl><p class="footnote">No actualiza el Maestro ni incluye precio, margen, comisiones, flete adicional o gastos generales.</p>`;
    }
    simulator.addEventListener('submit', event => { event.preventDefault(); renderSimulation(); });
    simulator.addEventListener('input', renderSimulation);
    function enableSectionTransitions() {
      if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.querySelectorAll('.reveal').forEach(section => section.classList.add('is-visible'));
        return;
      }
      const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
      }), {threshold: 0.12});
      document.querySelectorAll('.reveal').forEach(section => observer.observe(section));
    }
    renderActions(); renderSimulation(); render(); enableSectionTransitions();
  } catch (error) {
    const box = $('app-error'); box.hidden = false; box.textContent = `No se pudo cargar la posición de stock: ${error.message}`;
  }
})();
