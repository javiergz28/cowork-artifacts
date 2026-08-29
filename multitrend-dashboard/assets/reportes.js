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

  function ciclosDe(data, mesId) {
    return data.ciclos.filter(function (c) { return c.mes === mesId; })
      .sort(function (a, b) { return a.fecha === b.fecha ? (a.id < b.id ? -1 : 1) : (a.fecha < b.fecha ? -1 : 1); });
  }
  function ultimoConPanel(data) {
    var conPanel = data.ciclos.filter(function (c) { return c.snapshot; });
    if (!conPanel.length) return null;
    return conPanel.sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; })[0];
  }

  /* ---------------- HUB ---------------- */
  function renderHub(data) {
    var cont = document.getElementById('meses');
    if (!cont) return;
    var meses = data.meses.slice().sort(function (a, b) { return a.id < b.id ? 1 : -1; });
    if (!meses.length) { cont.appendChild(el('div', 'empty', 'Todavía no hay meses publicados.')); return; }

    meses.forEach(function (m) {
      var ciclos = ciclosDe(data, m.id);
      var conReportes = ciclos.filter(function (c) { return c.tipo !== 'proceso'; });
      var r = m.resumen || {};
      var a = el('a', 'month-card');
      a.href = CFG.base + m.slug + '/';
      a.innerHTML =
        '<div class="month-top">' +
          '<div><h3 class="month-name">' + esc(m.nombre) + ' ' + m.anio + '</h3>' +
          '<p class="month-window">' + esc(m.ventana) + '</p></div>' +
          '<span class="chip' + (m.estado === 'cerrado' ? '' : ' chip-warn') + '">' +
            (m.estado === 'cerrado' ? 'Cerrado' : 'En curso') + '</span>' +
        '</div>' +
        '<div class="month-kpis">' +
          '<div><p class="kpi-label">Unidades</p><p class="kpi-value">' + num(r.unidades) + '</p></div>' +
          '<div><p class="kpi-label">Contribución</p><p class="kpi-value">' + money(r.contribucion_neta) +
            (r.contribucion_pct != null ? ' <small>' + pct(r.contribucion_pct) + '</small>' : '') + '</p></div>' +
          '<div><p class="kpi-label">ROAS</p><p class="kpi-value">' + mult(r.roas) + '</p></div>' +
        '</div>' +
        '<div class="month-foot"><span>' + conReportes.length + ' ciclo' + (conReportes.length === 1 ? '' : 's') +
          ' · ' + ciclos.length + ' pase' + (ciclos.length === 1 ? '' : 's') + '</span><span class="arrow">Ver el mes →</span></div>';
      cont.appendChild(a);
    });

    var ult = ultimoConPanel(data);
    document.querySelectorAll('[data-ultimo]').forEach(function (n) {
      if (ult) {
        n.href = CFG.base + ult.snapshot;
        var lbl = n.querySelector('[data-ultimo-label]');
        if (lbl) lbl.textContent = 'Último panel · ' + fechaCorta(ult.fecha);
      } else { n.style.display = 'none'; }
    });
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
    setText('mes-conteo', ciclos.length + ' pases · ' + ciclos.filter(function (c) { return c.snapshot; }).length + ' paneles guardados');

    var aviso = document.getElementById('mes-aviso');
    if (aviso) {
      if (mes.aviso) aviso.innerHTML = '<div class="notice"><span>⚠️</span><div><b>Ojo con la ventana.</b> ' + esc(mes.aviso) + '</div></div>';
      else aviso.remove();
    }

    var kpis = [
      { l: 'Unidades netas', v: num(r.unidades), n: 'descontadas las canceladas' },
      { l: 'Ingresos por productos', v: money(r.ingresos_productos), n: 'antes de cargas de ML' },
      { l: 'Neto liquidado por ML', v: money(r.neto_liquidado), n: r.carga_ml_pct != null ? 'carga de ML ' + pct(r.carga_ml_pct) : '' },
      { l: 'Contribución neta', v: money(r.contribucion_neta), n: r.contribucion_pct != null ? pct(r.contribucion_pct) + ' de los ingresos' : '' },
      { l: 'ROAS / ACOS', v: mult(r.roas) + ' <small>' + pct(r.acos) + '</small>', n: 'inversión ' + money(r.inversion_ads) },
      { l: 'Envíos', v: num(r.envios), n: 'netos del período' }
    ];
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

  /* Serie mes a la fecha: solo cortes comparables entre sí (misma ventana acumulada). */
  function renderSerie(ciclos) {
    var host = document.getElementById('mes-serie');
    if (!host) return;
    var pts = ciclos.filter(function (c) { return c.ventana === 'mes a la fecha' && c.kpis && c.kpis.unidades != null; });
    if (pts.length < 2) { host.remove(); return; }

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
        '<text x="' + x(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="' + fsAxis + '" fill="#8B968F">' + fechaCorta(p.fecha) + '</text>';
    }).join('');

    host.innerHTML =
      '<h3>Cómo se fue armando el mes</h3>' +
      '<p class="hint">Unidades netas acumuladas en cada corte. Solo se grafican los ciclos con ventana «mes a la fecha»: los de ventana propia no son comparables punto a punto.</p>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Unidades netas acumuladas por corte">' +
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
  fetch(CFG.base + 'data/ciclos.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      if (CFG.view === 'mes') renderMes(data); else renderHub(data);
      var act = document.getElementById('actualizado');
      if (act && data.meta && data.meta.actualizado) act.textContent = 'Actualizado ' + fechaLarga(data.meta.actualizado);
      document.body.classList.add('mt-ready');
    })
    .catch(function (e) {
      var host = document.getElementById('meses') || document.getElementById('mes-ciclos');
      if (host) host.innerHTML = '<div class="empty">No se pudo cargar <code>data/ciclos.json</code> (' + esc(e.message) + ').<br>Si estás abriendo el archivo directo desde el disco, subilo a GitHub Pages o serví la carpeta con un servidor local.</div>';
    });
})();
