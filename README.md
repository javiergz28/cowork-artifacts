# cowork-artifacts

Repositorio y hosting de las capas web de Multitrend. El código versionado no contiene datos comerciales, costos, stock, clientes ni credenciales.

```text
multitrend-dashboard/       Salida pública/protegida de reportes y rentabilidad
├── assets/                 Presentación compartida
├── ciclos/                 Snapshots históricos inmutables
├── 2026-07/, 2026-08/      Páginas mensuales
├── ultimo/                 Ruta estable al último ciclo
└── rentabilidad/           Ruta canónica de productos, costos y rentabilidad
mt-toolkit/                 Utilidades de análisis de reportes de Mercado Libre
tools/                      Generación, cifrado, staging e integridad
docs/                       Diseño, decisiones operativas y guías
costos-multitrend/          Redirección de compatibilidad hacia rentabilidad/
```

La fuente editable del dashboard y los snapshots viven fuera de Git, en `_local/` cuando están disponibles. Nunca editar directamente la salida protegida ni publicar datos privados en GitHub Pages.

La lectura canónica de inventario está en [Stock y costos de productos](./docs/productos-y-rentabilidad.md): usa una foto de `STOCK_MT_FINAL` para buscar productos, explicar costos y alertar problemas actuales. Expone stock, costo, precio y margen unitario estimado en pesos para Web y Mercado Libre; no calcula resultado financiero.

La actualización se define en [refresh-stock-position.yml](./.github/workflows/refresh-stock-position.yml): admite una corrida manual y una corrida nocturna protegida. Requiere que el dueño del repositorio cargue los secretos `GOOGLE_SERVICE_ACCOUNT_JSON` y `STATICRYPT_PASSWORD`; nunca se guardan en el código. Para ciclos históricos, usar [la guía de publicación](./multitrend-dashboard/COMO_AGREGAR_UN_CICLO.md).

🔗 **GitHub Pages:** https://javiergz28.github.io/cowork-artifacts/
