(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const decimal = new Intl.NumberFormat('es-UY', {maximumFractionDigits: 2});
  const integer = new Intl.NumberFormat('es-UY', {maximumFractionDigits: 0});
  const percentage = new Intl.NumberFormat('es-UY', {style: 'percent', maximumFractionDigits: 1});
  const detailedPercentage = new Intl.NumberFormat('es-UY', {style: 'percent', maximumFractionDigits: 3});
  const money = value => value === null ? 'Sin dato' : '$ ' + decimal.format(value);
  const pct = value => value === null ? 'Sin dato' : percentage.format(value);
  const priorityOrder = {urgent: 0, high: 1, medium: 2, minor: 3, none: 4};
  const priorities = {
    urgent: {label: 'Urgente', plural: 'Urgentes', title: 'Validar antes de decidir', description: 'Revisiones que pueden cambiar la lectura del costo, stock o margen.'},
    high: {label: 'Alta', plural: 'Altas', title: 'Resolver datos y margen', description: 'Datos clave que faltan o márgenes bajos con stock disponible.'},
    medium: {label: 'Media', plural: 'Medias', title: 'Alinear el objetivo', description: 'Revisar si precio y multiplicador reflejan la decisión comercial.'},
    minor: {label: 'Menor', plural: 'Menores', title: 'Ordenar antes de reponer', description: 'Pendientes con menor exposición o productos sin stock registrado.'},
    none: {label: 'Sin alerta', plural: 'Sin alerta', title: 'Sin alerta del panel'}
  };
  const glossary = {
    'COD': 'Código de origen o proveedor. Es informativo; el cruce de productos se hace por SKU.',
    'ITEM COD': 'SKU del producto. Es la clave que identifica la fila del Maestro. Un sufijo de catálogo no implica un error.',
    'NAME': 'Nombre del producto o de la presentación registrada.',
    'CATEGORY': 'Categoría usada para agrupar y filtrar productos.',
    'Marca': 'Marca registrada en el Maestro.',
    'Modelo': 'Modelo o referencia del producto.',
    'Estado ML': 'Estado de la publicación informado en el Maestro. No equivale a una consulta en vivo de Mercado Libre.',
    'STOCK': 'Cantidad registrada en el Maestro. Hay que usar la misma unidad o pack que el costo; no estima demanda.',
    'Detalle Woo': 'Detalle informativo de cómo la sincronización compuso el stock. Este panel solo lo lee.',
    'Alerta': 'Alerta ya presente en el Maestro. Es distinta de las prioridades calculadas por este panel.',
    'Notas': 'Aclaraciones operativas del producto. Si piden verificar packs y piezas, se revisa esa equivalencia antes del precio.',
    'ITEM_ID ML': 'Identificador de la publicación en Mercado Libre. Puede repetirse y no se usa como clave del producto.',
    'Enlace ML': 'Enlace registrado a la publicación de Mercado Libre.',
    'Online WEB': 'Estado web registrado. Un precio cargado no prueba que la publicación esté activa.',
    'Sync': 'Marca informativa de sincronización en el Maestro. El panel no sincroniza ni cambia productos.',
    'Enlace': 'Enlace de origen o referencia del producto.',
    'Pedido': 'Pedido o compra al que corresponde el producto.',
    'Compra': 'Costo de compra de la unidad o presentación, expresado en la moneda indicada al lado.',
    'Moneda': 'Moneda del costo de compra. UYU se toma directo; USD se convierte con el tipo de cambio del Maestro.',
    'Costo base UYU': 'Compra pasada a pesos. Si es UYU, queda igual; si es importado: Compra × tipo de cambio.',
    'Recargo import. est.': 'Recargo estimado de importación. Importado: costo base × (coeficiente de importación − 1). En UYU es cero.',
    'IVA import. est.': 'Impuesto estimado. Importado: (costo base + recargo) × (coeficiente de impuestos − 1). En UYU es cero.',
    'Costo final UYU': 'Costo base + recargo de importación + IVA estimado. Es el costo usado para ambos canales.',
    'Multiplicador': 'Objetivo comercial cargado a mano sobre el costo. ×2 significa dos veces el costo; no es un margen real del 50% después de comisiones.',
    'Margen teórico %': '1 − 1 ÷ multiplicador. Describe el objetivo antes de la comisión; no usa los precios reales de web o ML.',
    'Precio Web': 'Precio cargado a mano en el Maestro. No se deduce del precio ML ni se consulta en vivo desde este panel.',
    'Margen web $': 'Precio web − costo final − (precio web × comisión de la pasarela). Sin precio o costo no se calcula.',
    'Margen web %': 'Margen web $ ÷ precio web. Multiplicado por 100, dice cuánto queda de cada $100 vendidos.',
    'Precio ML': 'Precio de Mercado Libre cargado en el Maestro. Puede requerir verificarlo contra la publicación vigente.',
    'Comisión ML $': 'Precio ML × porcentaje de comisión ML configurado en Parametros. Es una estimación.',
    'Costo total ML': 'Costo final + comisión estimada de Mercado Libre. No incluye todos los gastos del negocio.',
    'Margen ML $': 'Precio ML − comisión ML − costo final. Es margen estimado por unidad, no la ganancia neta del mes.',
    'Margen ML %': 'Margen ML $ ÷ precio ML. Multiplicado por 100, dice cuánto queda de cada $100 vendidos.'
  };
  const groupTitle = code => ({'verify-unit': 'Validar pack y unidad', 'invalid-stock': 'Revisar stock', 'missing-cost': 'Completar costo', 'missing-price': 'Completar precio publicado', 'negative-margin': 'Revisar margen negativo', 'low-margin': 'Revisar margen bajo', 'target-gap': 'Revisar multiplicador', 'missing-target': 'Definir objetivo comercial', 'formula-difference': 'Revisar fórmulas', 'zero-stock': 'Decidir continuidad sin stock'}[code] || 'Revisar el producto');

  try {
    const data = JSON.parse($('profitability-data').textContent);
    if (!Array.isArray(data.products) || !data.products.length) throw new Error('No hay productos en esta lectura.');
    const {products, summary, parameters, rules} = data;
    const state = {query: '', category: 'all', priority: 'all', stock: 'all', channel: 'all', sort: 'priority', direction: 1, page: 1, size: 12, expanded: new Set()};
    let visibleProducts = [];
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

    const firstTasks = summary.byPriority.urgent + summary.byPriority.high;
    $('kpis').innerHTML = [
      {label: 'Productos del Maestro', value: integer.format(summary.products), detail: `${new Set(products.map(p => p.category)).size} categorías · clave por SKU`},
      {label: 'Stock registrado', value: integer.format(summary.stock), detail: 'Suma de STOCK; packs pendientes de validar.'},
      {label: 'Comparables entre canales', value: integer.format(summary.comparable), detail: 'Con costo y dos precios; excluye packs por validar.'},
      {label: 'Primero, estas revisiones', value: integer.format(firstTasks), detail: `${summary.byPriority.urgent} urgentes + ${summary.byPriority.high} altas · productos únicos`, attention: true}
    ].map(kpi => `<article class="kpi${kpi.attention ? ' attention' : ''}"><span class="label">${kpi.label}</span><strong>${kpi.value}</strong><p>${kpi.detail}</p></article>`).join('');

    $('action-cards').innerHTML = ['urgent', 'high', 'medium', 'minor'].map(priority => {
      const config = priorities[priority];
      const group = products.filter(product => product.priority === priority);
      const counts = new Map();
      group.forEach(product => {
        const codes = new Set(product.actions.filter(action => action.priority === priority).map(action => action.code));
        codes.forEach(code => counts.set(code, (counts.get(code) || 0) + 1));
      });
      const reasons = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      return `<article class="action-card ${priority}"><div class="card-top"><span class="priority-label">${config.plural}</span><span class="count">${group.length}</span></div><h3>${config.title}</h3>${reasons.length ? `<ul>${reasons.map(([code, count]) => `<li><strong>${count}</strong> · ${escape(groupTitle(code))}</li>`).join('')}</ul>` : '<p>Sin productos en esta prioridad.</p>'}<button type="button" class="button" data-filter-priority="${priority}"${group.length ? '' : ' disabled'}>Ver ${group.length} producto${group.length === 1 ? '' : 's'} <span aria-hidden="true">↗</span></button></article>`;
    }).join('');

    const categories = [...new Set(products.map(product => product.category))].sort((a, b) => a.localeCompare(b, 'es'));
    $('category').insertAdjacentHTML('beforeend', categories.map(category => `<option value="${escape(category)}">${escape(category)}</option>`).join(''));

    function marginClass(channel) {
      return channel.margin === null ? '' : channel.margin < 0 ? 'margin-negative' : channel.pct < rules.lowMargin ? 'margin-low' : 'margin-positive';
    }
    function channelCell(product, key) {
      const channel = product[key];
      return `<span class="numeric">${money(channel.price)}</span><span class="cell-sub">${channel.margin === null ? 'Margen sin calcular' : `Deja <span class="${marginClass(channel)}">${money(channel.margin)} · ${pct(channel.pct)}</span>`}</span>${product.basisUnverified ? '<span class="provisional">Base por validar</span>' : ''}`;
    }
    function channelDetail(product, key) {
      const channel = product[key];
      const label = key === 'web' ? 'Web' : 'Mercado Libre';
      return `<article class="channel-card"><div class="channel-heading"><h4>${label}</h4><span>${escape(channel.status || 'Sin estado')}</span></div><dl class="calculation"><div><dt>Precio registrado</dt><dd>${money(channel.price)}</dd></div><div><dt>− Costo final</dt><dd>${money(product.cost)}</dd></div><div><dt>− Comisión (${detailedPercentage.format(channel.fee)})</dt><dd>${money(channel.commission)}</dd></div><div class="result"><dt>Margen estimado</dt><dd class="${marginClass(channel)}">${money(channel.margin)}</dd></div><div><dt>Margen sobre el precio</dt><dd>${pct(channel.pct)}</dd></div></dl>${product.basisUnverified ? '<p class="source-note"><strong>Resultado provisorio.</strong> Primero hay que conciliar la unidad de costo y stock. No se calcula una referencia de precio.</p>' : channel.margin === null ? '<p>Falta costo o precio: no se puede evaluar cuánto deja este canal.</p>' : `<p>De cada $100 vendidos, quedan aproximadamente <strong>${money(channel.pct * 100)}</strong> después del costo y de esta comisión.</p>`}<div class="reference-prices"><p>Precio para cubrir costo y comisión: <strong>${money(channel.breakeven)}</strong>.</p><p>Referencia con multiplicador ${product.multiplier === null ? 'sin definir' : '×' + decimal.format(product.multiplier)}: <strong>${money(channel.referencePrice)}</strong>.</p><p>La referencia no es un precio recomendado automáticamente. Revisá la presentación, el precio vigente y el objetivo comercial; no cubre todos los gastos.</p></div></article>`;
    }
    function rawValue(header, value) {
      if (value === '' || value === null || value === undefined) return 'Sin dato';
      if (typeof value === 'number') {
        if (header.includes('%')) return pct(value);
        if (header === 'Multiplicador') return '×' + decimal.format(value);
        if (['Costo base UYU', 'Recargo import. est.', 'IVA import. est.', 'Costo final UYU', 'Precio Web', 'Margen web $', 'Precio ML', 'Comisión ML $', 'Costo total ML', 'Margen ML $'].includes(header)) return money(value);
        return decimal.format(value);
      }
      if (typeof value === 'string' && /^https?:\/\//i.test(value) && ['Enlace ML', 'Enlace'].includes(header)) {
        try { const url = new URL(value); return `<a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">Abrir enlace ↗</a>`; } catch { /* Keep an invalid URL as plain text. */ }
      }
      return escape(value);
    }
    function fields(product, headers) {
      return `<dl class="field-grid">${headers.filter(header => data.headers.includes(header)).map(header => `<div class="field"><dt>${escape(header)}</dt><dd>${rawValue(header, product.raw[header])}<small>${escape(glossary[header] || 'Dato registrado en el Maestro.')}</small></dd></div>`).join('')}</dl>`;
    }
    const costHeaders = ['Compra', 'Moneda', 'Costo base UYU', 'Recargo import. est.', 'IVA import. est.', 'Costo final UYU', 'Multiplicador', 'Margen teórico %'];
    const channelHeaders = ['Precio Web', 'Margen web $', 'Margen web %', 'Precio ML', 'Comisión ML $', 'Costo total ML', 'Margen ML $', 'Margen ML %'];
    function detail(product) {
      return `<div class="product-detail" id="detail-${product.sheetRow}"><div class="detail-heading"><div><h3>${escape(product.name)}</h3><p>${escape(product.sku)} · ${escape(product.category)} · Fila ${product.sheetRow} del Maestro</p></div><button type="button" class="button" data-close="${product.sheetRow}" aria-label="Cerrar detalle de ${escape(product.sku)}">Cerrar</button></div><div class="detail-actions">${product.actions.length ? product.actions.map(action => `<div class="detail-action ${action.priority}"><strong><span class="priority-label">${priorities[action.priority].label}</span> · ${escape(action.title)}</strong><p>${escape(action.why)}</p><p class="next-step"><strong>Siguiente paso:</strong> ${escape(action.next)}</p></div>`).join('') : '<div class="detail-action none"><strong>Sin alerta de este panel</strong><p>No se activó ninguna regla. Aun así, confirmá costos y precios vigentes antes de tomar una decisión comercial.</p></div>'}</div><div class="channel-grid">${channelDetail(product, 'web')}${channelDetail(product, 'ml')}</div>${product.auditDifferences.length ? `<p class="audit-warning">Diferencias a revisar: ${product.auditDifferences.map(item => escape(item.header)).join(', ')}. Arriba se muestra el recálculo del panel; abajo, el valor original del Maestro.</p>` : ''}<details class="source-details" open><summary>De la compra al costo final</summary>${fields(product, costHeaders)}</details><details class="source-details"><summary>Valores de precios y márgenes en el Maestro</summary>${fields(product, channelHeaders)}</details><details class="source-details"><summary>Ficha operativa completa · stock, notas y demás columnas</summary>${fields(product, data.headers.filter(header => !costHeaders.includes(header) && !channelHeaders.includes(header)))}</details></div>`;
    }
    function getSortValue(product) {
      if (state.sort === 'priority') return priorityOrder[product.priority];
      if (state.sort.includes('-')) { const [channel, field] = state.sort.split('-'); return product[channel][field]; }
      return product[state.sort];
    }
    function filteredProducts() {
      const terms = normalize(state.query).split(/\s+/).filter(Boolean);
      return products.filter(product => {
        const text = normalize(`${product.sku} ${product.name} ${product.category} ${product.raw.Marca} ${product.raw.Modelo} ${product.notes} ${product.actions.map(action => action.title).join(' ')}`);
        if (!terms.every(term => text.includes(term))) return false;
        if (state.category !== 'all' && product.category !== state.category) return false;
        if (state.priority !== 'all' && product.priority !== state.priority) return false;
        if (state.stock === 'positive' && !(product.stock > 0)) return false;
        if (state.stock === 'zero' && product.stock !== 0) return false;
        if (state.stock === 'unknown' && product.stock !== null && product.stock >= 0) return false;
        if (state.channel === 'web' && product.web.margin === null) return false;
        if (state.channel === 'ml' && product.ml.margin === null) return false;
        if (state.channel === 'both' && (product.web.margin === null || product.ml.margin === null || product.basisUnverified)) return false;
        if (state.channel === 'missing-web' && product.web.price !== null) return false;
        if (state.channel === 'missing-ml' && product.ml.price !== null) return false;
        return true;
      }).sort((a, b) => {
        const valueA = getSortValue(a), valueB = getSortValue(b);
        // Unknown values remain last in both sort directions.
        if (valueA === null && valueB !== null) return 1;
        if (valueB === null && valueA !== null) return -1;
        let result = 0;
        if (valueA !== null && valueB !== null) result = typeof valueA === 'number' ? valueA - valueB : String(valueA).localeCompare(String(valueB), 'es', {numeric: true});
        return result * state.direction || (state.sort === 'priority' ? (b.stock ?? -1) - (a.stock ?? -1) : 0) || a.sku.localeCompare(b.sku, 'es');
      });
    }
    function render() {
      visibleProducts = filteredProducts();
      const pageSize = state.size === 'all' ? Math.max(1, visibleProducts.length) : state.size;
      const totalPages = Math.max(1, Math.ceil(visibleProducts.length / pageSize));
      state.page = Math.min(state.page, totalPages);
      const start = (state.page - 1) * pageSize;
      const pageProducts = visibleProducts.slice(start, start + pageSize);
      $('product-rows').innerHTML = pageProducts.map(product => {
        const expanded = state.expanded.has(product.sku);
        const action = product.actions[0];
        return `<tr class="product-row${expanded ? ' expanded' : ''}" role="row"><td role="cell"><button type="button" class="product-name" data-open="${product.sheetRow}" aria-expanded="${expanded}" aria-controls="detail-${product.sheetRow}">${escape(product.name)}</button><span class="sku">${escape(product.sku)}</span><span class="category-note">${escape(product.category)}</span></td><td data-label="Stock" role="cell"><span class="numeric">${product.stock === null ? 'Sin dato' : decimal.format(product.stock)}</span>${product.basisUnverified ? '<span class="provisional">Unidad por validar</span>' : '<span class="cell-sub">registrado</span>'}</td><td data-label="Costo final" role="cell"><span class="numeric">${money(product.cost)}</span><span class="cell-sub">por presentación</span></td><td data-label="Web · precio y margen" role="cell">${channelCell(product, 'web')}</td><td data-label="Mercado Libre · precio y margen" role="cell">${channelCell(product, 'ml')}</td><td role="cell"><span class="badge ${product.priority}">${priorities[product.priority].label}</span><span class="action-text">${escape(action?.title || 'Sin revisión prioritaria')}</span>${product.actions.length > 1 ? `<span class="cell-sub">+${product.actions.length - 1} en el detalle</span>` : ''}</td></tr><tr class="detail-row" role="row"${expanded ? '' : ' hidden'}><td colspan="6" role="cell">${expanded ? detail(product) : `<div id="detail-${product.sheetRow}"></div>`}</td></tr>`;
      }).join('');
      $('result-count').textContent = `${visibleProducts.length} de ${products.length} productos${state.priority !== 'all' ? ' · ' + priorities[state.priority].plural : ''}`;
      $('empty-state').hidden = visibleProducts.length !== 0;
      $('page-status').textContent = `${state.page} / ${totalPages}${visibleProducts.length ? ' · ' + (start + 1) + '–' + (start + pageProducts.length) : ''}`;
      $('previous').disabled = state.page === 1;
      $('next').disabled = state.page === totalPages;
      $('sort').value = state.sort;
      $('sort-direction').textContent = state.direction === 1 ? 'Ascendente ↑' : 'Descendente ↓';
      $('sort-direction').setAttribute('aria-label', `Cambiar orden a ${state.direction === 1 ? 'descendente' : 'ascendente'}`);
      document.querySelectorAll('th[data-sort]').forEach(header => {
        const selected = header.dataset.sort === state.sort;
        header.setAttribute('aria-sort', selected ? (state.direction === 1 ? 'ascending' : 'descending') : 'none');
        header.querySelector('span').textContent = selected ? (state.direction === 1 ? '↑' : '↓') : '↕';
      });
    }
    function reset() {
      Object.assign(state, {query: '', category: 'all', priority: 'all', stock: 'all', channel: 'all', page: 1});
      for (const id of ['category', 'priority', 'stock', 'channel']) $(id).value = 'all';
      $('search').value = '';
      render();
    }
    $('filters').addEventListener('submit', event => event.preventDefault());
    $('search').addEventListener('input', () => {state.query = $('search').value; state.page = 1; render();});
    for (const id of ['category', 'priority', 'stock', 'channel']) $(id).addEventListener('change', () => {state[id] = $(id).value; state.page = 1; render();});
    $('sort').addEventListener('change', () => {state.sort = $('sort').value; state.page = 1; render();});
    $('sort-direction').addEventListener('click', () => {state.direction *= -1; state.page = 1; render();});
    document.querySelectorAll('th[data-sort] button').forEach(button => button.addEventListener('click', () => {
      const sort = button.parentElement.dataset.sort;
      state.direction = state.sort === sort ? state.direction * -1 : 1;
      state.sort = sort; state.page = 1; render();
    }));
    $('page-size').addEventListener('change', () => {state.size = $('page-size').value === 'all' ? 'all' : Number($('page-size').value); state.page = 1; render();});
    $('previous').addEventListener('click', () => {state.page -= 1; render(); $('productos').scrollIntoView({block: 'start'});});
    $('next').addEventListener('click', () => {state.page += 1; render(); $('productos').scrollIntoView({block: 'start'});});
    $('reset-filters').addEventListener('click', reset);
    $('empty-reset').addEventListener('click', reset);
    $('action-cards').addEventListener('click', event => {
      const button = event.target.closest('[data-filter-priority]');
      if (!button) return;
      reset(); state.priority = button.dataset.filterPriority; $('priority').value = state.priority; render();
      $('productos').scrollIntoView({block: 'start'}); $('priority').focus({preventScroll: true});
    });
    $('product-rows').addEventListener('click', event => {
      const button = event.target.closest('[data-open],[data-close]');
      if (!button) return;
      const row = Number(button.dataset.open || button.dataset.close);
      const product = products.find(item => item.sheetRow === row);
      if (!product) return;
      if (button.dataset.close || state.expanded.has(product.sku)) state.expanded.delete(product.sku); else state.expanded.add(product.sku);
      render();
      document.querySelector(`[data-open="${row}"]`)?.focus({preventScroll: true});
    });

    const example = products.find(product => product.web.margin !== null && product.ml.margin !== null && !product.basisUnverified && !product.auditDifferences.length);
    if (example) $('worked-example').innerHTML = `<h3>Un ejemplo de esta lectura · ${escape(example.sku)}</h3><p>Web: <strong>${money(example.web.price)}</strong> de precio − <strong>${money(example.cost)}</strong> de costo − <strong>${money(example.web.commission)}</strong> de pasarela = <strong>${money(example.web.margin)} por unidad (${pct(example.web.pct)})</strong>.</p><p>Mercado Libre: <strong>${money(example.ml.price)}</strong> − <strong>${money(example.cost)}</strong> − <strong>${money(example.ml.commission)}</strong> = <strong>${money(example.ml.margin)} por unidad (${pct(example.ml.pct)})</strong>.</p><p>Se calcula con los decimales originales del Maestro; los importes visibles se redondean a dos decimales.</p>`;
    const parameterCards = [
      ['Tipo de cambio', decimal.format(parameters.exchange) + ' UYU / USD', 'Convierte las compras en dólares.'],
      ['Importación estimada', '×' + decimal.format(parameters.importFactor), `Equivale a un recargo de ${pct(parameters.importFactor - 1)} sobre el costo base.`],
      ['Impuestos estimados', '×' + decimal.format(parameters.taxFactor), `Equivale a ${pct(parameters.taxFactor - 1)} sobre costo base + recargo.`],
      ['Pasarela web', detailedPercentage.format(parameters.webFee), 'Se descuenta del precio web.'],
      ['Comisión Mercado Libre', pct(parameters.mlFee), 'Se descuenta del precio ML.'],
      ['Envío', parameters.shipping, 'Texto informativo; no suma ni resta en el cálculo.']
    ];
    $('parameters').innerHTML = parameterCards.map(([label, value, help]) => `<div class="parameter"><span>${escape(label)}</span><strong>${escape(value)}</strong><small>${escape(help)}</small></div>`).join('');
    $('priority-rules').innerHTML = `<ul><li><strong>Urgente:</strong> con stock, nota explícita de equivalencia pack/unidad por verificar o margen negativo. La nota de packs tiene precedencia: no se recomienda precio hasta conciliar la presentación.</li><li><strong>Alta:</strong> stock inválido; costo faltante con stock; precio faltante en un canal que figura publicado; diferencia de fórmulas; o margen entre 0% y ${pct(rules.lowMargin)} con stock.</li><li><strong>Media:</strong> con stock, precio inferior a la referencia de costo × multiplicador después de comisión (tolerancia ${pct(rules.targetTolerance)}); objetivo sin definir; o margen negativo sin stock.</li><li><strong>Menor:</strong> stock cero, costos pendientes sin stock o margen bajo sin stock. Antes de reponer, decidir continuidad y revisar el costo.</li></ul><p><strong>Umbrales del panel:</strong> ${pct(rules.lowMargin)} para revisar un margen bajo y ${pct(rules.targetTolerance)} de tolerancia al comparar el multiplicador. Son criterios orientativos visibles, no reglas impuestas por el Maestro ni decisiones automáticas.</p><p><strong>Alcance:</strong> solo se leen Articulos y Parametros de ${escape(data.meta.title)}. Los precios son los que tiene el Maestro. No hay reportes de ventas, publicidad ni cargas reales del mes; por eso no se calcula ganancia neta mensual ni se suman márgenes de distintos SKU como si fueran ventas.</p><p><strong>Datos pendientes:</strong> ${summary.costMissing} productos sin costo final positivo; ${summary.basisUnverified} con unidad de costo/stock pendiente de verificar. Comprobación aritmética de márgenes: ${summary.formulaDifferences ? summary.formulaDifferences + ' productos con diferencias' : 'sin diferencias en los valores numéricos comparables'}.</p><p><strong>Lectura guardada:</strong> ${escape(timestamp)} (Uruguay). Este panel no modifica el Maestro y no indica que una recomendación ya se haya realizado.</p>`;
    $('glossary').innerHTML = data.headers.map((header, index) => `<article class="glossary-item"><span class="column-ref">${escape(index < 26 ? String.fromCharCode(65 + index) : 'A' + String.fromCharCode(65 + index - 26))} · Maestro</span><h4>${escape(header)}</h4><p>${escape(glossary[header] || 'Dato informativo registrado en el Maestro.')}</p></article>`).join('');
    render();
  } catch (error) {
    $('app-error').hidden = false;
    $('app-error').textContent = `No se pudo cargar esta lectura. ${error.message} Volvé a abrir el panel o solicitá una actualización del snapshot.`;
    console.error('Error al cargar rentabilidad:', error);
  }
})();
