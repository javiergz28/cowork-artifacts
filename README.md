# cowork-artifacts

Backup y hosting (GitHub Pages) de los artefactos vivos de Cowork de Javi. Cada carpeta es un artefacto standalone (HTML autocontenido).

- [`flow/`](./flow/index.html) — **Flow, Personal Command Center.** Task manager personal (Today, Focus, Inbox, Upcoming, Completed). Persistencia real vía Supabase (proyecto `flow-personal-command-center`).
- [`multitrend-dashboard/`](./multitrend-dashboard/index.html) — **Multitrend Dashboard.** Panel de inteligencia comercial de Multitrend Uruguay (Mercado Libre): KPIs, ranking de productos, alertas del ciclo, rendimiento de promociones y de Mercado Ads, pendientes accionables. Se regenera vía el skill `/multitrend-ciclo`.

Este repo se actualiza manualmente (o vía Claude/Cowork) cada vez que alguno de los dos artefactos cambia — no hay sincronización automática todavía. La fuente de verdad "en vivo" de cada artefacto sigue siendo el artifact persistido en Cowork; esto es el respaldo versionado + la URL pública de solo lectura vía GitHub Pages.

🔗 **GitHub Pages:** una vez activado en Settings → Pages (branch `main`, carpeta `/root`), el deck queda en `https://<usuario>.github.io/cowork-artifacts/`.
