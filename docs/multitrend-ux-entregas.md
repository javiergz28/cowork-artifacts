# Multitrend: navegación, rentabilidad y cierre

## Alcance

Tres espacios en el mismo sitio protegido: inicio del ecosistema, rentabilidad del stock y ciclos comerciales. HTML, CSS y JavaScript existentes; sin dependencias de producción nuevas. Marca oficial verde/negro y Rethink Sans.

La fuente privada vive en `_local/multitrend-source/multitrend-dashboard/` y no se versiona. Los datos de Google Sheets se leen, no se modifican. El código genérico y los recursos de marca sí se versionan. Los datos quedan embebidos dentro de páginas cifradas.

## Entregas

1. Portada con accesos separados, meses buscables y ordenables. El reporte mensual usa su último corte: nunca suma ciclos solapados.
2. `/multitrend-dashboard/rentabilidad/`: snapshot fechado de `STOCK_MT_FINAL`, cálculos por encabezado, tabla compacta con detalle, búsqueda/filtros/orden, acciones por prioridad y explicación sencilla de las columnas. No confundir margen unitario estimado con ganancia realizada.
3. Cierre del 2 de septiembre: resultado de agosto, puente completo al total informado por Mercado Libre, tablas paginadas con detalle y corrección de estados. El cierre del 28 permanece como referencia histórica.

## Validación y publicación

- Revisar cifras con valores efectivos del maestro y parámetros de esa misma lectura.
- Comprobar fórmulas, datos ausentes y prioridades con pruebas de lógica.
- Probar búsqueda, filtros, orden en ambos sentidos, paginación y detalles en navegador; escritorio y móvil.
- Comprobar que el sitio conserva el cifrado y que los archivos de datos privados no entran en Git.
- Generar con `npm run build:multitrend-protected`; solicita la contraseña de forma oculta y verifica que sea la del sitio existente antes de modificar la salida.
- En Windows también se puede usar `powershell -NoProfile -File tools/build-protected-dashboard.ps1 -Dialog` para ingresar la clave en una ventana con campo oculto.
- Validar con `npm run stage:multitrend-protected -- --check`.
- Preparar sólo la entrega elegida pasando rutas relativas al comando de stage, por ejemplo `npm run stage:multitrend-protected -- index.html rentabilidad assets`.
- Revisar el diff y hacer commits/pushes separados. Evitar regenerar en Git los paneles históricos que no cambiaron.

La contraseña vive sólo en el proceso de generación. No guardar credenciales ni snapshots en archivos versionados. Para cambiar la contraseña se requiere una decisión explícita; este flujo no la cambia.
