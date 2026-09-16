# Stock y costos de productos

## Propósito vigente

La ruta canónica es `multitrend-dashboard/rentabilidad/`. Aunque conserva esa URL por compatibilidad, su función actual es una única experiencia privada de **posición de stock, costo y margen unitario estimado**; no presenta resultado financiero ni rentabilidad real del negocio.

La persona que la abre puede:

- buscar por nombre, SKU, categoría o nota;
- ver el stock actual y el costo final de la presentación registrada;
- comparar el precio actual de Web y Mercado Libre con su margen unitario estimado en pesos;
- ver el precio sugerido de cada canal cuando existe en el Maestro, sin confundirlo con un precio publicado;
- entender el desglose Compra → costo base → importación → IVA → costo final;
- ver una valuación estimada de inventario (`STOCK × Costo final UYU`) cuando la unidad es verificable;
- abrir alertas que expliquen qué pasa y cuál es el siguiente paso;
- simular un precio Web y Mercado Libre por producto, con un multiplicador editable y sin escribir en la fuente;
- calcular un costo de incorporación desde compra e importación cuando se trata de una reposición o un producto nuevo.

`costos-multitrend/` sólo redirige a esta ruta, para no mantener dos productos equivalentes.

## Fuente y alcance

La única fuente inicial es `STOCK_MT_FINAL`, pestañas `Articulos` y `Parametros`, siempre en modo de lectura. Los campos se resuelven por encabezado vigente, nunca por letra de columna.

La foto muestra el momento de lectura en horario de Montevideo y no usa cortes anteriores. Las alertas no dependen de variación histórica, ventas o demanda: sólo evalúan los campos actuales de stock, costo, precio y comisión de cada canal.

Para cada canal, el margen mostrado es `precio − costo final UYU − comisión estimada del canal`. Es una lectura unitaria orientativa: no descuenta todos los gastos, impuestos, devoluciones, publicidad ni otros costos del negocio. No se llama ganancia ni resultado financiero.

El valor de stock es una **estimación de inventario actual**, no dinero pagado, caja, ventas, utilidad, COGS ni resultado del negocio. Se deja pendiente si falta costo, el stock es inválido o una nota solicita validar pack/piezas.

## Alertas actuales

Cada producto recibe sólo la severidad más alta encontrada en la misma foto:

- **Urgente:** la nota pide validar equivalencia entre pack, piezas y stock, o hay un margen unitario estimado negativo en un producto con stock.
- **Alta:** stock inválido, compra faltante, moneda no reconocida, costo final faltante, diferencia entre el bloque de costos y el recálculo con los parámetros actuales, precio faltante en un canal publicado o margen unitario estimado bajo.
- **Menor:** el stock registrado es cero.
- **Sin alerta:** ninguna regla de integridad actual falló. No afirma que el producto venda, tenga demanda ni sea rentable.

Las alertas no modifican `STOCK_MT_FINAL`; describen evidencia, impacto y una acción pendiente para la persona responsable.

## Simulador de precio y costo

El simulador comienza con un producto de la foto actual. Usa su costo final y multiplicador cuando están disponibles; para cada canal propone primero el precio actual, después el precio sugerido del Maestro y, si falta ambos, `costo final × multiplicador`. Mika y Seba pueden reemplazar esos dos precios o aplicar el multiplicador a ambos con un botón explícito.

Para Web y Mercado Libre muestra por separado precio propuesto, comisión estimada, margen unitario estimado en pesos y margen sobre el precio. Es un escenario local: no actualiza el Maestro, no publica precios y no altera las alertas de la foto actual.

El bloque desplegable de importación toma compra por unidad, moneda, tipo de cambio, coeficiente de importación, coeficiente de impuestos y cantidad del lote. Calcula el costo final para usarlo como base del escenario. Flete adicional, gastos generales y otros componentes no presentes en los parámetros quedan fuera hasta contar con una definición aprobada.

## Actualización controlada con GitHub Actions

El workflow [refresh-stock-position.yml](../.github/workflows/refresh-stock-position.yml) permite una corrida manual (`workflow_dispatch`) y luego corre cada noche a la 01:00 de Uruguay (04:00 UTC). El proceso:

1. autentica una cuenta de servicio de Google con permiso de **Lector**;
2. descarga `Articulos` y `Parametros` a `_local/`, fuera de Git;
3. valida encabezados, parámetros, SKUs y reglas actuales;
4. genera el HTML privado y lo cifra en el runner;
5. verifica que el HTML público no tenga datos sin cifrar ni JSON;
6. versiona únicamente el HTML cifrado autocontenido.

GitHub Pages nunca consulta la Sheet desde el navegador. El HTML generado incorpora sus estilos y JavaScript antes del cifrado, por lo que también puede abrirse como archivo en Chrome sin depender de recursos relativos. La contraseña protege una foto fechada: toda persona que conozca esa contraseña puede abrir esa foto, por lo que se debe tratar como acceso a información comercial.

### Requisitos que carga Javier en GitHub

1. Crear una cuenta de servicio de Google Cloud, habilitar Google Sheets API y compartir `STOCK_MT_FINAL` con el correo de esa cuenta como **Lector**.
2. En `Settings → Secrets and variables → Actions`, cargar el JSON de esa cuenta como `GOOGLE_SERVICE_ACCOUNT_JSON`.
3. Cargar la contraseña actual del panel como `STATICRYPT_PASSWORD`.
4. Ejecutar manualmente el workflow una vez y revisar la página cifrada; recién entonces queda habilitada la corrida nocturna.

Las claves no se escriben en el repositorio, en el dashboard ni en un chat.

## Verificación local

Los tests sintéticos cubren el modelo sin incluir SKUs, costos ni stock reales:

```sh
node --test tools/stock-position/model.test.mjs
```

Para una primera lectura manual se exporta la Sheet a `_local`, se transforma con `tools/xlsx-stock-snapshot.py` y se genera con `tools/build-stock-position.mjs`. Las salidas privadas y snapshots siguen bajo `_local/`; no se copian a GitHub Pages sin pasar por el cifrado.
