"""Identifica qué reporte de ML es cada archivo por su huella (hojas +
encabezados), no por el nombre: ML cambia los nombres de archivo entre ciclos.

Paso 0 bloqueante del ciclo: todo archivo recibido tiene que tener destino
declarado. Un 'desconocido' no se ignora — se pregunta.
"""
from .excel import cargar, hojas
from .util import norm_txt

# (id, destino, señales que TIENEN que estar, señales que ayudan)
HUELLAS = [
    ("ventas_uy", "procesar",
     ["# de venta", "forma de entrega", "sku"], ["ingresos por productos", "venta por publicidad"]),
    ("evolucion_negocio", "procesar",
     ["visitas"], ["conversion", "ventas concretadas", "facturacion"]),
    ("desempeno_producto", "procesar",
     ["valores totales del periodo"], ["visitas", "unidades"]),
    ("promociones", "procesar",
     ["promocion"], ["unidades vendidas", "descuento"]),
    ("publicaciones", "procesar",
     ["# de publicacion", "stock"], ["precio", "estado"]),
    ("rendimiento_publicaciones", "procesar",
     ["visitas", "sku"], ["unidades vendidas", "conversion"]),
    ("ads_campanas", "procesar",
     ["campana"], ["inversion", "acos", "roas"]),
    ("ads_anuncios", "procesar",
     ["impresiones", "clics"], ["cpc", "inversion", "ingresos"]),
    ("ads_ventas", "procesar",
     ["venta por publicidad"], ["ingresos por publicidad"]),
    ("envios_agencias", "estado de cuenta",
     ["despacho"], ["a tiempo", "colocacion", "agencia"]),
    ("envios_flex", "estado de cuenta",
     ["flex"], ["zona", "entregado"]),
    ("fichas_tecnicas", "procesar",
     ["attribute"], ["categoria", "# de publicacion"]),
    ("catalogo_productos", "referencia",
     ["cod", "name", "category"], ["publicado en ml", "enlace ml", "stock"]),
    ("maestro_stock", "referencia",
     ["margen"], ["costo", "stock", "sku"]),
]


def huella(path):
    """Devuelve dict con tipo detectado, destino sugerido, hojas, filas y por qué."""
    try:
        hs = hojas(path)
        titulo, cols, datos, crudas = cargar(path)
    except Exception as e:
        return {"archivo": path, "tipo": "ilegible", "destino": "desconocido",
                "motivo": f"{type(e).__name__}: {e}", "hojas": [], "filas": 0}
    plano = " | ".join(norm_txt(c) for c in cols)
    mejor, mejor_score, mejor_dest = "desconocido", 0, "desconocido"
    for tid, dest, must, extra in HUELLAS:
        if not all(m in plano for m in must):
            continue
        score = len(must) * 2 + sum(1 for e in extra if e in plano)
        if score > mejor_score:
            mejor, mejor_score, mejor_dest = tid, score, dest
    return {"archivo": path, "tipo": mejor, "destino": mejor_dest,
            "hojas": hs, "hoja_leida": titulo, "filas": len(datos),
            "columnas": len(cols), "score": mejor_score}
