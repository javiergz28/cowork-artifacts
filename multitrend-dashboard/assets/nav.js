/* Barra de navegación para los paneles congelados.
   Se resuelve sola desde data/ciclos.json: al agregar un ciclo nuevo no hay que tocar los paneles viejos. */
(function () {
  'use strict';
  var MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  function corta(iso) { var p = iso.split('-'); return (+p[2]) + ' ' + MESES_CORTO[+p[1] - 1]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function cargarDatos(url) {
    var embebidos = document.getElementById('mt-ciclos-data');
    if (embebidos) {
      try { return Promise.resolve(JSON.parse(embebidos.textContent)); }
      catch (e) { return Promise.reject(e); }
    }
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }

  var host = document.getElementById('mt-nav');
  if (!host) return;
  var archivo = decodeURIComponent(location.pathname.split('/').pop() || '');

  var css = '#mt-nav{font-family:Outfit,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#0C0C0C;color:#fff;padding:9px 0;font-size:13.5px;line-height:1.4;}'
    + '#mt-nav .mt-nav-in{width:min(1180px,100% - 40px);margin:0 auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}'
    + '#mt-nav a{color:#fff;text-decoration:none;border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:5px 12px;font-weight:600;white-space:nowrap;transition:background .15s ease,border-color .15s ease;}'
    + '#mt-nav a:hover{background:rgba(255,255,255,.12);border-color:rgba(43,234,96,.7);}'
    + '#mt-nav .mt-now{display:flex;align-items:center;gap:7px;font-weight:600;color:#fff;margin-right:auto;}'
    + '#mt-nav .mt-dot{width:7px;height:7px;border-radius:50%;background:#2BEA60;flex:none;}'
    + '#mt-nav .mt-sub{font-weight:400;color:rgba(255,255,255,.55);}'
    + '#mt-nav .mt-off{opacity:.32;pointer-events:none;}'
    + '@media(max-width:640px){#mt-nav .mt-nav-in{width:min(1180px,100% - 24px);gap:7px;font-size:12.5px;}#mt-nav .mt-sub{display:none;}}';
  var st = document.createElement('style'); st.textContent = css;
  document.head.appendChild(st);

  if (!document.querySelector('link[rel="icon"]')) {
    var ic = document.createElement('link');
    ic.rel = 'icon';
    ic.href = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230C0C0C'/%3E%3Ccircle cx='16' cy='16' r='7' fill='%232BEA60'/%3E%3C/svg%3E";
    document.head.appendChild(ic);
  }

  cargarDatos('../data/ciclos.json')
    .then(function (d) {
      var conPanel = d.ciclos.filter(function (c) { return c.snapshot; })
        .sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
      var i = -1;
      conPanel.forEach(function (c, idx) { if (c.snapshot.split('/').pop() === archivo) i = idx; });
      var actual = i >= 0 ? conPanel[i] : null;
      var prev = i > 0 ? conPanel[i - 1] : null;
      var next = i >= 0 && i < conPanel.length - 1 ? conPanel[i + 1] : null;
      var mesId = actual ? actual.mes : null;
      var mesNom = mesId ? MESES[+mesId.split('-')[1] - 1] + ' ' + mesId.split('-')[0] : 'el mes';

      host.innerHTML = '<div class="mt-nav-in">'
        + '<span class="mt-now"><span class="mt-dot"></span>'
        + (actual ? 'Panel del ' + esc(corta(actual.fecha)) + ' <span class="mt-sub">· ' + esc(actual.periodo) + '</span>' : 'Panel guardado')
        + '</span>'
        + '<a href="../">Inicio</a>'
        + '<a href="../rentabilidad/">Rentabilidad del stock</a>'
        + (mesId ? '<a href="../' + esc(mesId) + '/">' + esc(mesNom) + '</a>' : '')
        + (prev ? '<a href="' + esc(prev.snapshot.split('/').pop()) + '">← ' + esc(corta(prev.fecha)) + '</a>'
                : '<a class="mt-off" href="#">← anterior</a>')
        + (next ? '<a href="' + esc(next.snapshot.split('/').pop()) + '">' + esc(corta(next.fecha)) + ' →</a>'
                : '<a class="mt-off" href="#">siguiente →</a>')
        + '</div>';
    })
    .catch(function () {
      host.innerHTML = '<div class="mt-nav-in"><span class="mt-now"><span class="mt-dot"></span>Panel guardado</span><a href="../">Reportes</a></div>';
    });
})();
