# Cómo agregar un ciclo protegido al histórico

La carpeta pública `multitrend-dashboard/` contiene solamente la versión cifrada. No se edita directamente.
La fuente de trabajo vive en `_local/multitrend-source/multitrend-dashboard/`, excluida de Git.

No hay que tocar `index.html`, la página del mes ni los paneles viejos: todo se arma desde el
`data/ciclos.json` de la fuente privada.

## 1. Guardar el panel del ciclo

Copiar el HTML del panel a `ciclos/AAAA-MM-DD.html` dentro de la fuente privada
(la fecha del corte, no la del período).

```bash
cd _local/multitrend-source/multitrend-dashboard
cp /ruta/al/panel-generado.html ciclos/2026-09-05.html
python3 ../_local/inyectar_nav.py ciclos/2026-09-05.html   # agrega la barra de navegación
```

Si no está el script, alcanza con pegar esto justo después de `<body>`:

```html
<!-- mt-nav: barra de navegación del histórico de reportes -->
<div id="mt-nav"></div>
<script src="../assets/nav.js" defer></script>
```

La barra resuelve sola el mes, el anterior y el siguiente. **Los paneles ya publicados no se tocan nunca más.**

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
    "ventas": 0, "ventas_concepto": "De qué reporte sale la cifra",
    "unidades": 0, "unidades_concepto": "netas",
    "visitas": 0, "conversion": 0, "ticket": 0,
    "envios": 0, "roas": 0, "acos": 0, "inversion_ads": 0,
    "contribucion_neta": 0, "contribucion_pct": 0, "fichas_tecnicas": 0
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

```bash
mkdir -p 2026-09
sed 's/2026-08/2026-09/g; s/Agosto 2026/Septiembre 2026/g' 2026-08/index.html > 2026-09/index.html
```

La página del mes es una plantilla de 60 líneas: lo único propio es `MT_CFG.mes` y el `<title>`.

En `"meses"`:

```json
{
  "id": "2026-09", "nombre": "Septiembre", "anio": 2026, "slug": "2026-09",
  "estado": "en curso", "ventana": "1 – 4 sep 2026",
  "aviso": "Opcional: advertencia sobre la ventana del período.",
  "resumen": { "unidades": 0, "ingresos_productos": 0, "neto_liquidado": 0,
               "contribucion_neta": 0, "contribucion_pct": 0, "carga_ml_pct": 0,
               "roas": 0, "acos": 0, "inversion_ads": 0, "envios": 0 },
  "titulares": ["3 o 4 conclusiones del mes"]
}
```

`resumen` se actualiza con el corte más reciente del mes y `estado` pasa a `"cerrado"` con el cierre mensual.

## 4. Generar y preparar la versión protegida

Desde la raíz del repositorio:

```powershell
npm run build:multitrend-protected
npm run stage:multitrend-protected
```

El primer comando solicita la contraseña de forma oculta y genera una copia cifrada. El segundo comprueba
que todos los HTML estén cifrados, que no haya JSON público y recién entonces actualiza la carpeta publicable.

La contraseña nunca se escribe en el repositorio. `multitrend-dashboard/data/ciclos.json` no debe restaurarse:
el manifiesto queda embebido dentro de cada página cifrada.

## 5. Publicar

```bash
git add -A && git commit -m "Ciclo 05/09/2026" && git push origin main
```

O directamente **Commit to main → Push origin** en GitHub Desktop.

## Verificación antes de pushear

1. Servir `multitrend-dashboard/` con un servidor local y abrir la URL local.
   **Con `file://` no funciona** porque el cifrado usa WebCrypto en HTTPS o localhost.
2. La portada pide contraseña y una contraseña incorrecta no abre el contenido.
3. Marcar «Recordarme» y comprobar que los meses y ciclos siguientes abren sin volver a pedirla.
4. La tarjeta del mes muestra los KPIs nuevos.
5. El ciclo nuevo aparece primero en la página del mes, con el botón «Abrir panel».
6. `/ultimo/` redirige al panel nuevo.
7. «Rentabilidad del stock» abre `/multitrend-dashboard/rentabilidad/`, independiente del ciclo.
8. La barra negra del panel nuevo tiene el ciclo anterior a la izquierda.

## URLs estables

| URL | Qué es |
|---|---|
| `/multitrend-dashboard/` | Índice de reportes |
| `/multitrend-dashboard/rentabilidad/` | Costos, precios y stock con fecha de lectura propia |
| `/multitrend-dashboard/ultimo/` | Siempre el panel más reciente — es la que conviene compartir |
| `/multitrend-dashboard/2026-08/` | Reporte del mes |
| `/multitrend-dashboard/ciclos/2026-08-28.html` | Un panel congelado, no cambia nunca |
