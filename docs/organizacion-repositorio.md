# Organización del repositorio

## Qué se publica

| Ubicación | Uso |
| --- | --- |
| `multitrend-dashboard/` | Páginas cifradas y activos públicos del dashboard |
| `index.html`, `costos-multitrend/` | Portada y rutas de compatibilidad |
| `tools/`, `mt-toolkit/` | Código de generación, validación y análisis |
| `.github/`, `package*.json`, `docs/` | Automatización, dependencias y documentación sin datos privados |

El archivo `reel-parlantes-tg-recortado.mp4` ya se publicó mediante una URL pública. Se conserva esa ruta para no interrumpir usos existentes. Su presencia no autoriza agregar otros renders al repositorio.

## Qué permanece local

| Ubicación | Uso |
| --- | --- |
| `~/Documents/Creaciones IA/` | Biblioteca creativa por marca y proyecto, fuera de Git |
| `artifacts/` | Enlaces de compatibilidad a proyectos anteriores de la biblioteca |
| `_local/creativos/tienda-web/` | Enlace de compatibilidad al proyecto de la tienda |
| `_local/` | Fuentes privadas, snapshots, respaldos y nuevas lecturas auxiliares |
| `.codex/`, `bridge/`, `.tmp-docs-trusted-read/` | Configuración y lecturas auxiliares locales existentes |

Estas rutas están ignoradas por Git. Mantener juntos los HTML de previsualización y sus imágenes relativas. Los proyectos de video conservan sus rutas para no interrumpir sus scripts y servidores locales.

La biblioteca usa `01_Entregas`, `02_Material`, `03_Proyecto` y `04_Revisiones`. Cada proyecto tiene un registro y las entregas llevan títulos claros y versiones incrementales. Las instrucciones globales de Codex y la habilidad local `creative-library` aplican esta organización a los trabajos con acceso a esta Mac, incluso cuando el chat está abierto en un repositorio. Las descargas de ChatGPT sin acceso a la Mac requieren importación.

Los respaldos de recuperación de Git permanecen fuera del repositorio, en `~/Documents/Multitrend/Respaldos Git/`, con acceso local restringido. Conservar una copia recuperable antes de descartar duplicados; los archivos ignorados no se respaldan automáticamente.

## Antes de publicar

1. Consultar `git status -sb` y comparar con el remoto.
2. Preparar únicamente las rutas de la tarea con `git add -- ruta`.
3. Revisar `git diff --cached --stat`, el contenido del diff y `git diff --cached --check`.
4. Verificar que no entren documentos internos, fuentes privadas, grabaciones, capturas, renders o credenciales. No forzar la inclusión de archivos ignorados.
5. Si se modifica el dashboard, usar su flujo de generación y cifrado, y verificar la salida publicada.

GitHub no es el respaldo de los archivos ignorados. Conservar entregables y fuentes importantes en Drive o en una copia externa.

## Historial y recuperación

Retirar un archivo con `git rm --cached` conserva la copia local y prepara su retiro de la próxima versión. No elimina copias en commits anteriores.

Una limpieza del historial público requiere un trabajo separado: inventario de rutas y referencias afectadas, respaldo verificado, coordinación con quienes usan el repositorio, revisión de automatizaciones, filtrado en una copia aislada, validación de que el árbol del dashboard no cambie y autorización explícita para actualizar las referencias remotas reescritas. No usar un push forzado como parte de una limpieza ordinaria.
