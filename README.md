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


## Material de trabajo local y GitHub

GitHub conserva el código del dashboard, sus activos públicos y la salida cifrada que se publica. Las herramientas de edición de video, audio e imágenes funcionan localmente y no necesitan que sus archivos estén en GitHub.

- `artifacts/`: proyectos creativos, tomas, voces, renders y exportaciones. Se conserva localmente y se ignora en Git.
- `_local/`: fuentes privadas, snapshots, respaldos y lecturas auxiliares nuevas. Se ignora en Git.
- `_local/creativos/tienda-web/`: banners, capturas, previsualizaciones HTML y notas de diseño, agrupados con sus archivos relacionados.
- `bridge/`, `.tmp-docs-trusted-read/` y `.codex/`: lecturas auxiliares y configuración local. Se ignoran en Git.
- Las capturas, medios y previsualizaciones `multitrend-*` sueltas en la raíz también se ignoran. Los activos del sitio deben ir dentro de su carpeta web correspondiente.

Ignorar un archivo no lo borra ni lo respalda: guardar los entregables importantes también en Drive o en una copia externa. Git continúa mostrando los cambios reales del dashboard. Usar rutas concretas al preparar una publicación y revisar el diff antes de confirmar.

Una regla de `.gitignore` no retira archivos que ya estuvieran versionados ni borra el historial publicado. Las copias de documentos internos no deben formar parte del repositorio público.

Ver [organización y publicación del repositorio](./docs/organizacion-repositorio.md). El video `reel-parlantes-tg-recortado.mp4` es una excepción ya publicada: se conserva su URL existente. Los videos nuevos permanecen locales.
