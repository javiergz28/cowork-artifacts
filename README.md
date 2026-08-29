# cowork-artifacts

Backup y hosting (GitHub Pages) de los artefactos vivos de Cowork de Javi. Cada carpeta es un artefacto standalone (HTML autocontenido).

- [`flow/`](./flow/index.html) — **Flow, Personal Command Center.** Task manager personal (Today, Focus, Inbox, Upcoming, Completed). Persistencia real vía Supabase (proyecto `flow-personal-command-center`).
- [`multitrend-dashboard/`](./multitrend-dashboard/index.html) — **Reportes Multitrend.** Histórico de inteligencia comercial de Multitrend Uruguay (Mercado Libre): índice de reportes, una página por mes y el panel congelado de cada ciclo.

## Estructura de los reportes de Multitrend

```
multitrend-dashboard/
├── index.html              Landing: explicación + tarjetas por mes
├── 2026-08/index.html      Reporte mensual (plantilla, una carpeta por mes)
├── ciclos/2026-08-28.html  Panel congelado de cada ciclo — no se edita nunca
├── ultimo/                 URL estable que redirige al panel más reciente
├── data/ciclos.json        Manifiesto: de acá salen el índice y las páginas mensuales
└── assets/                 CSS y JS compartidos (reportes.js para el índice, nav.js para los paneles)
```

**Para agregar un ciclo nuevo: [`COMO_AGREGAR_UN_CICLO.md`](./multitrend-dashboard/COMO_AGREGAR_UN_CICLO.md).** En resumen: copiar el HTML a `ciclos/`, agregar un objeto a `ciclos.json` y pushear. El índice, la página del mes y la navegación entre paneles se arman solos.

Los paneles se generan con el ciclo `/multitrend-ciclo` a partir de los reportes exportados de Mercado Libre, cruzados con el maestro `STOCK_MT_FINAL`.

🔗 **GitHub Pages:** https://javiergz28.github.io/cowork-artifacts/
