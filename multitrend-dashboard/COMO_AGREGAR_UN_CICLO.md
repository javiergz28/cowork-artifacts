# Cómo agregar un ciclo protegido al histórico

Procedimiento revisado el 03/09/2026. Ejecutar los comandos desde la raíz del repositorio. Comprobar primero estado Git, remoto y fuente privada; un clon público no recupera el HTML editable.

La carpeta pública `multitrend-dashboard/` contiene solamente la versión cifrada. No se edita directamente.
La fuente de trabajo vive en `_local/multitrend-source/multitrend-dashboard/`, excluida de Git.

Para un ciclo nuevo, preservar los datos de los anteriores y actualizar el `data/ciclos.json` privado.
La revisión expresamente solicitada de un ciclo existente modifica su ruta, conservando una base y las fechas de sus fuentes; no necesita otro registro solo por cambiar la presentación.
La rentabilidad del stock tiene página propia en `rentabilidad/` y no forma parte del ciclo.

## 1. Guardar el panel del ciclo

Copiar el HTML del panel a `ciclos/AAAA-MM-DD.html` dentro de la fuente privada
(la fecha del corte, no la del período).

Verificar que la ruta nueva no exista. Copiar la plantilla privada validada y adaptar el contenido a las fuentes reales; no ejecutar un generador antiguo sin revisar qué archivos reemplaza.
La barra de navegación se incorpora justo después de `<body>` si la plantilla todavía no la tiene:

```html
<!-- mt-nav: barra de navegación del histórico de reportes -->
<div id="mt-nav"></div>
<script src="../assets/nav.js" defer></script>
```

La barra resuelve el mes, anterior y siguiente desde el manifiesto embebido por el build. Los datos históricos se conservan salvo una corrección expresamente solicitada; regenerar el cifrado para actualizar navegación no equivale a recalcular esos datos.

## 2. Agregar el ciclo al `data/ciclos.json` privado

Un objeto nuevo al final de `"ciclos"`:

```json
{
  "id": "2026-09-05",
  "mes": "2026-09",
  "fecha": "2026-09-05",
  "titulo": "Frase corta con el hallazgo principal",
  "tipo": "reportes",
  "periodo": "1 – 4 sep 2026",
  "ventana": "mes a la fecha",
  "corte": "05/09 11:03 hs",
  "archivos": 12,
  "kpis": {
    "ventas": null, "ventas_concepto": "De qué reporte sale la cifra",
    "unidades": null, "unidades_concepto": "netas",
    "visitas": null, "conversion": null, "ticket": null,
    "envios": null, "roas": null, "acos": null, "inversion_ads": null,
    "contribucion_neta": null, "contribucion_pct": null, "fichas_tecnicas": null
  },
  "hallazgos": ["2 o 3 líneas, las mismas del bloque de alertas del panel"],
  "snapshot": "ciclos/2026-09-05.html"
}
```

Reglas:

- **Todo KPI que no llegó ese ciclo se omite o va en `null`.** Nunca se estima para rellenar: la página muestra `—`.
- **`ventana`** es obligatorio y decide la serie del mes: solo se grafican los ciclos con `"mes a la fecha"`, porque los de ventana propia no son comparables punto a punto.
- **`ventas_concepto`** dice de qué reporte sale la cifra. Ventas brutas de Evolución de negocio ≠ Ingresos por productos de Ventas UY: no se mezclan en la misma serie.
- **`tipo`**: `"reportes"` (ciclo normal), `"cierre"` (el último del mes) o `"proceso"` (pase sin reportes nuevos, queda en el historial pero sin KPIs).
- Si el ciclo no dejó panel guardado, `"snapshot": null`.

## 3. Si es un mes nuevo, agregarlo también

Un objeto en `"meses"` y una carpeta con la página del mes:

Dentro de la fuente privada, crear la carpeta mensual si falta y copiar la plantilla del mes anterior. Revisar su estructura actual y ajustar `MT_CFG.mes`, el título y cualquier etiqueta propia del mes; no hacer reemplazos globales sobre datos históricos.

En `"meses"`:

```json
{
  "id": "2026-09", "nombre": "Septiembre", "anio": 2026, "slug": "2026-09",
  "estado": "en curso", "ventana": "1 – 4 sep 2026",
  "aviso": "Opcional: advertencia sobre la ventana del período.",
  "resumen": { "unidades": null, "ingresos_productos": null, "neto_liquidado": null,
               "contribucion_neta": null, "contribucion_pct": null, "carga_ml_pct": null,
               "roas": null, "acos": null, "inversion_ads": null, "envios": null },
  "titulares": ["3 o 4 conclusiones del mes"]
}
```

`resumen` se actualiza con el corte más reciente del mes y `estado` pasa a `"cerrado"` con el cierre mensual.

## 4. Generar y preparar la versión protegida

Desde la raíz del repositorio:

```powershell
npm run build:multitrend-protected
npm run stage:multitrend-protected -- --check
```

Finalizar datos, UI, pruebas y hashes de CSS/JS antes de ejecutar el build. El primer comando solicita la contraseña de forma oculta y genera una copia cifrada. También verifica que la clave abre la portada actual y conserva su configuración de cifrado. La alternativa con ventana segura es:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/build-protected-dashboard.ps1 -Dialog
```

No pedir la clave por chat ni ponerla en comandos o archivos. Esperar la salida de la ejecución original antes de abrir otro diálogo. La clave se descarta al terminar el proceso.

`--check` **no copia archivos**: verifica el recibo de integridad de fuente/salida, cifrado de los HTML y ausencia de JSON público. Si cambió la fuente tras el build, regenerar antes de continuar.

Preparar la carpeta publicable según el alcance:

- Nuevo ciclo o manifiesto modificado: `npm run stage:multitrend-protected`, para actualizar todas las páginas que incorporan el manifiesto. Revisar que los datos de los paneles históricos no cambien.
- Solo revisión del cierre, sin modificar manifiesto: preparar únicamente rutas afectadas. Ejemplo de la revisión de agosto:

```powershell
node tools/stage-protected-dashboard.mjs ciclos/2026-09-02.html assets/cycle-final.js assets/cycle-final.css assets/cycle-review.js
```

Este staging copia archivos verificados a `multitrend-dashboard/`; todavía falta seleccionarlos con `git add`.

La contraseña nunca se escribe en el repositorio. `multitrend-dashboard/data/ciclos.json` no debe restaurarse:
el manifiesto queda embebido dentro de cada página cifrada.

## 5. Publicar

Con publicación autorizada, revisar diff, remoto y cambios entrantes. Seleccionar con `git add` las rutas concretas del ciclo y los recursos afectados; no usar `git add -A` ni incluir `_local/`.

```powershell
git diff --cached --check
git diff --cached --stat
git commit -m "Describe el ciclo o la revisión publicada"
git push origin main
```

GitHub Desktop es una alternativa, no un requisito. No forzar el push. Cambiar solo documentación no requiere volver a cifrar el sitio.

Después del push, comprobar que el workflow de Pages del SHA enviado terminó correctamente; verificar la versión servida por HTTP y abrirla en el navegador. Un commit local o un push exitoso no prueban que Pages ya la esté sirviendo.

## Verificación antes de pushear

1. Probar primero la fuente privada por HTTP en localhost; después verificar la versión cifrada publicable. Mantener el servidor fuera de la carpeta de salida que el build reemplaza para evitar `EBUSY`.
   **Con `file://` no funciona** porque el cifrado usa WebCrypto en HTTPS o localhost.
2. La portada pide contraseña y una contraseña incorrecta no abre el contenido.
3. Marcar «Recordarme» y comprobar que los meses y ciclos siguientes abren sin volver a pedirla.
4. La tarjeta del mes muestra los KPIs nuevos.
5. El ciclo nuevo aparece primero en la página del mes, con el botón «Abrir panel».
6. `/ultimo/` redirige al panel nuevo.
7. «Rentabilidad del stock» abre `/multitrend-dashboard/rentabilidad/`, independiente del ciclo.
8. La barra negra del panel nuevo tiene el ciclo anterior a la izquierda.
9. Todas las tablas permiten buscar y ordenar, con filtros útiles, detalles completos, paginación y «Todas». Totales calculados sobre el conjunto filtrado, no solo la página visible.
10. Vista de escritorio y móvil sin cortes con nombres largos; teclado y consola comprobados. Validar recursos versionados por hash, no una pestaña con CSS/JS anterior en caché.
11. Los registros comerciales están dentro del HTML cifrado; los scripts públicos contienen presentación. `multitrend-dashboard/data/ciclos.json` debe devolver 404.
12. En producción, el HTML cifrado y los recursos modificados coinciden con la copia publicable. Si se comparan como texto, normalizar únicamente CRLF/LF para no confundir saltos de línea con cambios de contenido.

Aplicar las comprobaciones al alcance actual: una revisión de presentación conserva el corte y los datos originales. No repetir extracciones ni pruebas amplias si no resuelven un riesgo concreto.

## URLs estables

| URL | Qué es |
|---|---|
| `/multitrend-dashboard/` | Inicio del ecosistema |
| `/multitrend-dashboard/rentabilidad/` | Costos, precios y stock con fecha de lectura propia |
| `/multitrend-dashboard/ultimo/` | Siempre el panel más reciente — es la que conviene compartir |
| `/multitrend-dashboard/2026-08/` | Reporte del mes |
| `/multitrend-dashboard/ciclos/2026-09-02.html` | Cierre final de agosto, con fuentes fechadas |

Orden de lectura acordado: Resultado → Productos → Ads → Promociones y cupones → Operación y reputación → Salud del catálogo → Notas de calidad → Archivos → Resumen. Los archivos comienzan plegados con las alertas arriba; el resumen no supera diez puntos breves. Una página publicada en vivo sigue mostrando snapshots, no una sincronización automática de fuentes.
