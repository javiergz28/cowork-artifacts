# Panel de rentabilidad

La página independiente usa exclusivamente una lectura de `Articulos` y
`Parametros` de `STOCK_MT_FINAL`. No consulta reportes de ventas ni escribe en el
Maestro. El bloque de costos se resuelve por encabezado.

## Actualizar la lectura

Guardar el snapshot sin redondear dentro de `_local`. El contrato es:

```js
{
  meta: {
    title, spreadsheetId, fetchedAtUtc, timeZone
  },
  articles: [encabezados, ...filas],
  parameters: [['Parametro', 'Valor'], ...filas]
}
```

`articles` debe incluir las columnas de `A:AG`, especialmente `Notas`, `STOCK`,
`Costo final UYU`, `Multiplicador`, los precios y los márgenes. Los importes y
porcentajes deben ser valores numéricos efectivos de Sheets; no cadenas
formateadas. `parameters` debe incluir las dos comisiones, tipo de cambio y
coeficientes del bloque. El generador falla ante parámetros inválidos,
encabezados faltantes o SKU duplicados. No toma parámetros históricos por defecto.

```powershell
node tools/build-profitability.mjs _local/rentabilidad-AAAA-MM-DD/live-master.json _local/multitrend-source/multitrend-dashboard/rentabilidad
node --test tools/profitability/model.test.mjs
```

El primer comando genera la página con datos embebidos **solo dentro de
`_local`** y copia allí el JavaScript y CSS de presentación. No cifra, prepara ni
publica el sitio. Para publicar hay que seguir el proceso existente de cifrado
del dashboard; nunca copiar directamente este HTML ni el snapshot al árbol
público. Estos archivos de `tools/profitability` no incluyen cifras ni SKU reales
del negocio; los tests usan ejemplos sintéticos.

## Decisiones de cálculo y presentación

- Web resta la pasarela leída de `Parametros`; ML resta su comisión propia.
- El margen unitario se recalcula y se compara con los valores numéricos de la
  hoja. El detalle conserva también los valores originales.
- Un precio o costo faltante, cero o no numérico deja el margen sin calcular.
- Las notas explícitas que piden verificar equivalencias de packs/piezas hacen
  provisional el cálculo y bloquean precios de referencia. No se infiere un
  problema por el nombre de un producto o por el sufijo de un SKU.
- El multiplicador es un objetivo sobre el costo. Su porcentaje teórico es
  distinto del margen sobre el precio después de comisiones.
- Las prioridades y sus umbrales están definidos en `model.mjs` y se explican en
  la página. Los productos se cuentan una vez por su prioridad más alta.
- El stock es la suma de las cantidades registradas, sin convertir packs. No se
  suman márgenes por SKU para presentarlos como ganancias.
- La tabla muestra seis columnas; el detalle da acceso a toda la ficha. Hay
  búsqueda, filtros, ordenamiento numérico/textual y paginación. En pantallas
  pequeñas cada fila se presenta como tarjeta.

Validar visualmente escritorio y móvil después de regenerar; comprobar también
el detalle, el estado vacío, filtros, ordenamiento y paginación antes de cifrar y
publicar.
