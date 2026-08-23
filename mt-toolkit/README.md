# mt — toolkit Multitrend para reportes de Mercado Libre

Objetivo: que un ciclo se resuelva con **pocos comandos de salida chica** en vez de
cargar planillas enteras al contexto. Todo el trabajo pesado pasa en el contenedor.

## Uso en una sesión nueva

```bash
git clone --depth 1 https://github.com/javiergz28/cowork-artifacts.git /tmp/ca
export PATH="/tmp/ca/mt-toolkit/bin:$PATH"
pip install --break-system-packages -q duckdb pyarrow openpyxl pandas
mt --help
```

## Comandos

| Comando | Qué hace |
|---|---|
| `mt inventario <carpeta>` | Paso 0 del ciclo: identifica cada archivo por huella (hojas + encabezados, no por nombre) y le asigna destino. Lista aparte los que no reconoce. |
| `mt ventas <ventas_uy.xlsx> [--desde "16/08/2026 14:41"] [--top N]` | Ventas UY parseado **por envío físico**. Brutas/netas/canceladas, canales, unidades por envío, % multiproducto, ticket, top SKU. |
| `mt sku <ventas_uy.xlsx> --catalogo <maestro.xlsx>` | SKU del reporte que no matchean el catálogo, con la regla aplicada y el nivel de confianza. |
| `mt catalogo <maestro.xlsx>` | Audita la consistencia de convención de SKU del propio catálogo. |
| `mt sql "<query>" -f a.xlsx [-n t0] [--columnas]` | SQL (duckdb) sobre planillas sin cargarlas al contexto. `mt_num()` convierte texto a número. |

## Decisiones de diseño que no hay que volver a discutir

- **Parseo por envío, no por fila.** Los paquetes multiproducto ocupan varias filas:
  la cabecera trae `Estado = "Paquete de N productos"` y la forma de entrega; las N
  filas hijas traen SKU y unidades con forma de entrega vacía. Filtrar cancelados fila
  por fila da mal el neto — fue el bug de la discrepancia 99 vs 93.
  Validado contra el export del 15/08/2026: 17 de 17 paquetes, 0 huérfanos.
- **Encabezados duplicados.** Ventas UY tiene `Unidades` ×3, `Estado` ×2 y
  `Forma de entrega` ×2. Se desambiguan con la fila de grupo de arriba
  (`Ventas::`, `Envíos::`, `Devoluciones::`). Nunca usar el nombre pelado.
- **`parse_num` nunca lanza excepción.** `Venta por publicidad` trae `Sí`/`No` en una
  columna que parece numérica.
- **Cancelados por substring**, nunca por prefijo: hay al menos 4 redacciones
  (`Cancelada`, `Cancelada. No despaches`, `Cancelado por el comprador`,
  `Venta cancelada. No despaches.`).
- **El SKU nunca se inventa.** Solo se aplica la corrección mecánica `PHC0#### → PHCO####`
  y solo si no hay colisión. Todo lo demás sale marcado `revisar` para verificar por ITEM_ID.
- **duckdb no puede leer xlsx acá** (la extensión `excel` se descarga de internet y el
  egress la bloquea). `mt sql` convierte a parquet con pandas y cachea en `~/.cache/mt`.

## Qué falta
Módulos de Ads, fichas técnicas, envíos y stock. **No se escriben a ciegas**: cada uno
se agrega cuando haya un archivo real de ese tipo contra el cual validarlo.
