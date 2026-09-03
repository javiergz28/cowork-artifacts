/* Multitrend — Reportes. Render del hub y de las páginas mensuales desde data/ciclos.json.
   Cada página define window.MT_CFG = { base: './' | '../', view: 'hub' | 'mes', mes: '2026-08' } */
(function () {
  'use strict';

  var CFG = window.MT_CFG || { base: './', view: 'hub' };
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

  var nfMoney = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 });
  var nfNum = new Intl.NumberFormat('es-UY');
  var nfDec = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 2 });

  function money(n) { return n == null ? '—' : '$ ' + nfMoney.format(n); }
  function num(n) { return n == null ? '—' : nfNum.format(n); }
  function pct(n) { return n == null ? '—' : nfDec.format(n) + '%'; }
  function mult(n) { return n == null ? '—' : nfDec.format(n) + '×'; }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function parseFecha(iso) { var p = iso.split('-'); return { d: +p[2], m: +p[1] - 1, y: +p[0] }; }
  function fechaCorta(iso) { var f = parseFecha(iso); return f.d + ' ' + MESES_CORTO[f.m]; }
  function fechaLarga(iso) { var f = parseFecha(iso); return f.d + ' de ' + MESES[f.m] + ' de ' + f.y; }

  function cargarDatos(url) {
    var embebidos = document.getElementById('mt-ciclos-data');
    if (embebidos) {
      try { return Promise.resolve(JSON.parse(embebidos.textContent)); }
      catch (e) { return Promise.reject(e); }
    }
    return fetch(url, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }

  function ciclosDe(data, mesId) {
    return data.ciclos.filter(function (c) { return c.mes === mesId; })
      .sort(function (a, b) { return a.fecha === b.fecha ? (a.id < b.id ? -1 : 1) : (a.fecha < b.fecha ? -1 : 1); });
  }
  function ultimoConPanel(data) {
    var conPanel = data.ciclos.filter(function (c) { return c.snapshot; });
    if (!conPanel.length) return null;
    return conPanel.sort(function (a, b) { return a.fecha === b.fecha ? String(b.id).localeCompare(String(a.id)) : (a.fecha < b.fecha ? 1 : -1); })[0];
  }

  function normalizar(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

  /* Muestra hasta 3 KPIs, en orden de prioridad, salteando los que el mes no tiene.
     Un mes sin Ventas UY (ej. julio 2026) no tiene unidades ni contribución: cae en ventas/visitas. */
  function tarjetasKpi(r) {
    var cand = [
      { l: 'Unidades', v: r.unidades, f: num },
      { l: 'Contribución', v: r.contribucion_neta, f: money, extra: r.contribucion_pct != null ? pct(r.contribucion_pct) : null },
      { l: 'Ventas', v: r.ventas, f: num },
      { l: 'Visitas', v: r.visitas, f: num },
      { l: 'ROAS', v: r.roas, f: mult }
    ];
    var out = cand.filter(function (c) { return c.v != null; }).slice(0, 3);
    if (!out.length) return '<div><p class="kpi-label">Sin KPIs</p><p class="kpi-value">—</p></div>';
    return out.map(function (c) {
      return '<div><p class="kpi-label">' + c.l + '</p><p class="kpi-value">' + c.f(c.v) +
        (c.extra ? ' <small>' + c.extra + '</small>' : '') + '</p></div>';
    }).join('');
  }

  /* ---------------- HUB ---------------- */
  function renderHub(data) {
    var cont = document.getElementById('meses');
    if (!cont) return;
    var buscar = document.getElementById('mes-buscar');
    var estado = document.getElementById('mes-estado');
    var orden = document.getElementById('mes-orden');
    var ult = ultimoConPanel(data);
    document.querySelectorAll('[data-ultimo]').forEach(function (n) {
      if (ult) {
        n.href = CFG.base + ult.snapshot + (n.getAttribute('data-ultimo-hash') || '');
        var lbl = n.querySelector('[data-ultimo-label]');
        if (lbl) lbl.textContent = 'Abrir último ciclo';
      } else { n.hidden = true; }
    });
    if (ult) {
      setText('ultimo-fecha', 'Publicado ' + fechaCorta(ult.fecha));
      setText('ultimo-titulo', ult.titulo);
      setText('ultimo-periodo', 'Período: ' + ult.periodo);
    } else {
      setText('ultimo-titulo', 'Todavía no hay ciclos publicados.');
      setText('ultimo-periodo', 'El primer panel aparecerá acá cuando esté disponible.');
    }

    function mostrarMeses() {
      var terminos = normalizar(buscar && buscar.value).split(/\s+/).filter(Boolean);
      var filtroEstado = estado ? estado.value : 'todos';
      var meses = data.meses.filter(function (m) {
        var texto = normalizar(m.nombre + ' ' + m.anio + ' ' + m.id + ' ' + m.ventana);
        return terminos.every(function (t) { return texto.indexOf(t) !== -1; }) &&
          (filtroEstado === 'todos' || (filtroEstado === 'cerrado' ? m.estado === 'cerrado' : m.estado !== 'cerrado'));
      }).sort(function (a, b) {
        return (orden && orden.value === 'antiguo' ? 1 : -1) * a.id.localeCompare(b.id);
      });
      cont.innerHTML = '';
      cont.setAttribute('aria-busy', 'false');
      setText('mes-resultados', meses.length + (meses.length === 1 ? ' mes' : ' meses') + ' de ' + data.meses.length + ' publicados');
      if (!meses.length) {
        cont.appendChild(el('div', 'empty', data.meses.length
          ? 'No encontramos meses con esos filtros. Probá otra búsqueda o elegí todos los estados.'
          : 'Todavía no hay meses publicados.'));
        return;
      }
      meses.forEach(function (m) {
        var ciclos = ciclosDe(data, m.id);
        var conReportes = ciclos.filter(function (c) { return c.tipo !== 'proceso'; });
        var paneles = ciclos.filter(function (c) { return c.snapshot; }).length;
        var r = m.resumen || {};
        var a = el('a', 'month-card');
        a.href = CFG.base + m.slug + '/';
        a.innerHTML =
          '<div class="month-top">' +
            '<div><h3 class="month-name">' + esc(m.nombre) + ' ' + esc(m.anio) + '</h3>' +
            '<p class="month-window">' + esc(m.ventana) + '</p></div>' +
            '<span class="chip' + (m.estado === 'cerrado' ? '' : ' chip-warn') + '">' +
              (m.estado === 'cerrado' ? 'Cerrado' : 'En curso') + '</span>' +
          '</div>' +
          '<div class="month-kpis">' + tarjetasKpi(r) + '</div>' +
          '<p class="month-caption">Cifras del último corte de este mes.</p>' +
          '<div class="month-foot"><span>' + conReportes.length + ' ciclo' + (conReportes.length === 1 ? '' : 's') +
            ' · ' + paneles + ' panel' + (paneles === 1 ? '' : 'es') + '</span><span class="arrow">Ver mes <span aria-hidden="true">→</span></span></div>';
        cont.appendChild(a);
      });
    }
    if (buscar) buscar.addEventListener('input', mostrarMeses);
    if (estado) estado.addEventListener('change', mostrarMeses);
    if (orden) orden.addEventListener('change', mostrarMeses);
    mostrarMeses();
  }

  /* ---------------- MES ---------------- */
  function renderMes(data) {
    var mes = data.meses.filter(function (m) { return m.id === CFG.mes; })[0];
    var ciclos = ciclosDe(data, CFG.mes);
    if (!mes) { document.getElementById('contenido').innerHTML = '<div class="empty">No encontré este mes en el manifiesto.</div>'; return; }

    var r = mes.resumen || {};
    document.title = mes.nombre + ' ' + mes.anio + ' — Reportes Multitrend';
    setText('mes-nombre', mes.nombre + ' ' + mes.anio);
    setText('mes-ventana', 'Período informado: ' + mes.ventana);
    var nPan = ciclos.filter(function (c) { return c.snapshot; }).length;
    setText('mes-conteo', ciclos.length + (ciclos.length === 1 ? ' pase' : ' pases') + ' · ' +
      nPan + (nPan === 1 ? ' panel guardado' : ' paneles guardados'));

    var aviso = document.getElementById('mes-aviso');
    if (aviso) {
      if (mes.aviso) aviso.innerHTML = '<div class="notice"><div><b>Sobre este período.</b> ' + esc(mes.aviso) + '</div></div>';
      else aviso.remove();
    }

    var unidadesCorte = ciclos.slice().reverse().filter(function (c) { return c.kpis && c.kpis.unidades === r.unidades && c.kpis.unidades_concepto; })[0];
    var concepto = r.unidades_concepto || (unidadesCorte ? unidadesCorte.kpis.unidades_concepto : 'concepto no informado en el resumen');
    var kpis = [
      { l: 'Unidades', d: r.unidades, v: num(r.unidades), n: concepto },
      { l: 'Cantidad de ventas', d: r.ventas, v: num(r.ventas), n: 'líneas de producto, no unidades' },
      { l: 'Visitas', d: r.visitas, v: num(r.visitas), n: 'totales del período' },
      { l: 'Ingresos por productos', d: r.ingresos_productos, v: money(r.ingresos_productos), n: 'antes de cargas de ML' },
      { l: 'Total informado por ML', d: r.neto_liquidado, v: money(r.neto_liquidado), n: 'importe del reporte; no acredita un depósito bancario' },
      { l: 'Contribución neta', d: r.contribucion_neta, v: money(r.contribucion_neta), n: r.contribucion_pct != null ? pct(r.contribucion_pct) + ' de los ingresos' : '' },
      { l: 'ROAS / ACOS', d: r.roas, v: mult(r.roas) + ' <small>' + pct(r.acos) + '</small>', n: r.inversion_ads != null ? 'inversión ' + money(r.inversion_ads) : '' },
      { l: 'Envíos', d: r.envios, v: num(r.envios), n: 'netos del período' }
    ].filter(function (k) { return k.d != null; });
    var kr = document.getElementById('mes-kpis');
    if (kr) kpis.forEach(function (k) {
      kr.appendChild(el('div', 'kpi-card',
        '<p class="kpi-label">' + k.l + '</p><p class="kpi-value">' + k.v + '</p>' + (k.n ? '<p class="kpi-note">' + k.n + '</p>' : '')));
    });

    var tit = document.getElementById('mes-titulares');
    if (tit && mes.titulares && mes.titulares.length) {
      tit.innerHTML = '<ul class="cycle-find">' + mes.titulares.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    } else if (tit) { tit.closest('.section') && tit.closest('.section').remove(); }

    renderSerie(ciclos);
    renderCiclos(ciclos);
  }

  function setText(id, txt) { var n = document.getElementById(id); if (n) n.textContent = txt; }

  /* No unir unidades netas, brutas u operativas: compartir ventana no alcanza.
     Sólo se grafica el grupo más reciente que tenga dos cortes del mismo concepto. */
  function renderSerie(ciclos) {
    var host = document.getElementById('mes-serie');
    if (!host) return;
    var candidatos = ciclos.filter(function (c) { return c.ventana === 'mes a la fecha' && c.kpis && c.kpis.unidades != null; });
    var grupos = {};
    candidatos.forEach(function (c) {
      var concepto = normalizar(c.kpis.unidades_concepto);
      var clave = /^(netas|brutas|operativas)\b/.exec(concepto);
      if (clave) (grupos[clave[1]] || (grupos[clave[1]] = [])).push(c);
    });
    var comparables = Object.keys(grupos).filter(function (clave) { return grupos[clave].length >= 2; })
      .sort(function (a, b) { return grupos[b][grupos[b].length - 1].fecha.localeCompare(grupos[a][grupos[a].length - 1].fecha); });
    if (!comparables.length) {
      host.innerHTML = '<h3>Evolución entre cortes</h3><p class="hint">Todavía no hay dos cortes acumulados con el mismo concepto de unidades para trazar una comparación. Podés consultar cada período por separado abajo.</p>';
      return;
    }
    var conceptoSerie = comparables[0];
    var pts = grupos[conceptoSerie];
    var excluidos = candidatos.filter(function (c) { return pts.indexOf(c) === -1; });
    var notaExcluidos = excluidos.length ? ' No se incluyen ' + excluidos.map(function (c) {
      return 'el corte del ' + fechaCorta(c.fecha) + ' (' + (c.kpis.unidades_concepto || 'concepto no informado') + ')';
    }).join(' ni ') + '.' : '';

    var narrow = window.innerWidth < 700;
    var W = narrow ? 360 : 720, H = narrow ? 200 : 190;
    var PL = narrow ? 26 : 34, PR = narrow ? 26 : 34, PT = 30, PB = 30;
    var fsVal = narrow ? 15 : 13, fsAxis = narrow ? 13 : 11.5, rDot = narrow ? 5 : 4.5;
    var vals = pts.map(function (p) { return p.kpis.unidades; });
    var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
    var pad = ((max - min) || max || 1) * 0.28;
    max += pad; min -= pad;
    var span = (max - min) || 1;
    var x = function (i) { return PL + (pts.length === 1 ? 0 : i * (W - PL - PR) / (pts.length - 1)); };
    var y = function (v) { return PT + (1 - (v - min) / span) * (H - PT - PB); };

    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.kpis.unidades).toFixed(1); }).join(' ');
    var area = line + ' L' + x(pts.length - 1).toFixed(1) + ' ' + (H - PB) + ' L' + x(0).toFixed(1) + ' ' + (H - PB) + ' Z';
    var dots = pts.map(function (p, i) {
      return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.kpis.unidades).toFixed(1) + '" r="' + rDot + '" fill="#fff" stroke="#16A34A" stroke-width="2.5"/>' +
        '<text x="' + x(i).toFixed(1) + '" y="' + (y(p.kpis.unidades) - 13).toFixed(1) + '" text-anchor="middle" font-size="' + fsVal + '" font-weight="700" fill="#0C0C0C">' + p.kpis.unidades + '</text>' +
        '<text x="' + x(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="' + fsAxis + '" fill="#657167">' + fechaCorta(p.fecha) + '</text>';
    }).join('');

    host.innerHTML =
      '<h3>Evolución de unidades ' + esc(conceptoSerie) + '</h3>' +
      '<p class="hint">Cortes con el mismo concepto de unidades y período «mes a la fecha». Los valores son acumulados y no se suman.' + esc(notaExcluidos) + '</p>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Unidades ' + esc(conceptoSerie) + ' acumuladas por corte">' +
        '<title>' + esc(pts.map(function (p) { return fechaCorta(p.fecha) + ': ' + num(p.kpis.unidades) + ' unidades ' + conceptoSerie; }).join('; ')) + '</title>' +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#2BEA60" stop-opacity=".22"/><stop offset="100%" stop-color="#2BEA60" stop-opacity="0"/>' +
        '</linearGradient></defs>' +
        '<path d="' + area + '" fill="url(#g)"/>' +
        '<path d="' + line + '" fill="none" stroke="#16A34A" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
        dots +
      '</svg>';
  }

  function renderCiclos(ciclos) {
    var host = document.getElementById('mes-ciclos');
    if (!host) return;
    ciclos.slice().reverse().forEach(function (c) {
      var k = c.kpis || {};
      var row = el('article', 'cycle');

      var chips = [];
      if (c.tipo === 'cierre') chips.push('<span class="chip">Cierre del mes</span>');
      if (c.tipo === 'proceso') chips.push('<span class="chip chip-muted">Pase de proceso</span>');
      if (c.ventana && c.ventana !== '—') chips.push('<span class="chip chip-muted">Ventana: ' + esc(c.ventana) + '</span>');
      if (c.corte) chips.push('<span class="chip chip-muted">Corte ' + esc(c.corte) + '</span>');
      if (c.archivos) chips.push('<span class="chip chip-muted">' + c.archivos + ' archivos</span>');

      var lines = [];
      if (k.ventas != null) lines.push('<li>' + money(k.ventas) + ' <strong>' + esc(k.ventas_concepto || 'ventas') + '</strong></li>');
      if (k.unidades != null) lines.push('<li><strong>' + num(k.unidades) + '</strong> unidades' + (k.unidades_concepto ? ' ' + esc(k.unidades_concepto) : '') + '</li>');
      if (k.visitas != null) lines.push('<li><strong>' + num(k.visitas) + '</strong> visitas</li>');
      if (k.conversion != null) lines.push('<li>conversión <strong>' + pct(k.conversion) + '</strong></li>');
      if (k.roas != null) lines.push('<li>ROAS <strong>' + mult(k.roas) + '</strong> · ACOS ' + pct(k.acos) + '</li>');
      if (k.contribucion_neta != null) lines.push('<li>contribución <strong>' + money(k.contribucion_neta) + '</strong></li>');
      if (k.fichas_tecnicas != null) lines.push('<li>fichas técnicas <strong>' + pct(k.fichas_tecnicas) + '</strong></li>');

      row.innerHTML =
        '<div class="cycle-date">' + fechaCorta(c.fecha) + '<span>' + esc(c.periodo) + '</span></div>' +
        '<div>' +
          '<h3 class="cycle-title">' + esc(c.titulo) + '</h3>' +
          (chips.length ? '<div class="cycle-meta">' + chips.join('') + '</div>' : '') +
          (lines.length ? '<ul class="cycle-kpis">' + lines.join('') + '</ul>' : '') +
          (c.hallazgos && c.hallazgos.length ? '<ul class="cycle-find">' + c.hallazgos.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>' : '') +
        '</div>' +
        '<div class="cycle-action">' +
          (c.snapshot
            ? '<a class="btn btn-primary" href="' + CFG.base + esc(c.snapshot) + '"><span class="live"></span>Abrir panel</a>'
            : '<span class="no-snapshot">Sin panel guardado</span>') +
        '</div>';
      host.appendChild(row);
    });
  }

  /* ---------------- Arranque ---------------- */
  cargarDatos(CFG.base + 'data/ciclos.json')
    .then(function (data) {
      if (CFG.view === 'mes') renderMes(data); else renderHub(data);
      var act = document.getElementById('actualizado');
      if (act && data.meta && data.meta.actualizado) act.textContent = 'Actualizado ' + fechaLarga(data.meta.actualizado);
      document.body.classList.add('mt-ready');
    })
    .catch(function (e) {
      var host = document.getElementById('meses') || document.getElementById('mes-ciclos');
      if (host) {
        host.setAttribute('aria-busy', 'false');
        host.innerHTML = '<div class="empty"><p>No pudimos cargar los reportes. Volvé a intentar en unos momentos.</p><button class="btn" type="button" id="reintentar-datos">Volver a intentar</button></div>';
        document.getElementById('reintentar-datos').addEventListener('click', function () { window.location.reload(); });
      }
      setText('mes-resultados', 'Los reportes no están disponibles en este momento.');
      document.querySelectorAll('.archive-controls input, .archive-controls select').forEach(function (n) { n.disabled = true; });
      console.error('No se pudo cargar el manifiesto de Multitrend:', e);
    });
})();
