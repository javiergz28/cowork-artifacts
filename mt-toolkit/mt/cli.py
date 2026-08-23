"""CLI del toolkit. Objetivo de diseño: salidas CHICAS.

Todo el trabajo pesado pasa en el contenedor; a la conversación solo entran
tablas agregadas. Nunca imprime el contenido crudo de una planilla.
"""
import argparse
import glob
import os
import sys
from .util import parse_fecha


def _tabla(filas, headers):
    if not filas:
        return "(sin datos)"
    anchos = [max(len(str(h)), max((len(str(f[i])) for f in filas), default=0))
              for i, h in enumerate(headers)]
    out = ["| " + " | ".join(str(h).ljust(anchos[i]) for i, h in enumerate(headers)) + " |",
           "|" + "|".join("-" * (a + 2) for a in anchos) + "|"]
    for f in filas:
        out.append("| " + " | ".join(str(c).ljust(anchos[i]) for i, c in enumerate(f)) + " |")
    return "\n".join(out)


def cmd_inventario(a):
    from .fingerprint import huella
    archivos = []
    for p in a.paths:
        archivos.extend(sorted(glob.glob(os.path.join(p, "*.xlsx")))
                        if os.path.isdir(p) else [p])
    filas = []
    for f in archivos:
        h = huella(f)
        filas.append([os.path.basename(f)[:46], h["tipo"], h["destino"],
                      h["filas"], h["columnas"]])
    print(_tabla(filas, ["archivo", "tipo detectado", "destino", "filas", "cols"]))
    desc = [f[0] for f in filas if f[1] in ("desconocido", "ilegible")]
    if desc:
        print("\n⚠ SIN DESTINO — preguntar antes de cerrar el ciclo:")
        for d in desc:
            print("  -", d)


def cmd_ventas(a):
    from .ventas import cargar_ventas, resumen, por_sku
    env, meta = cargar_ventas(a.archivo)
    desde = parse_fecha(a.desde) if a.desde else None
    r = resumen(env, desde)
    print(f"# Ventas UY — corte {meta['corte']}" + (f" — desde {desde}" if desde else ""))
    print(f"envíos efectivos {r['envios_efectivos']} · cancelados {r['envios_cancelados']}")
    print(f"unidades brutas {r['unidades_brutas']:.0f} · netas {r['unidades_netas']:.0f} "
          f"· canceladas {r['unidades_canceladas']:.0f}")
    print(f"ingresos netos ${r['ingresos_netos']:,.0f} · ticket ${r['ticket_promedio']:,.0f}")
    print(f"unidades por envío {r['unidades_por_envio']} · "
          f"órdenes multiproducto {r['ordenes_multiproducto']} ({r['pct_multiproducto']}%)")
    print("\n## Canales")
    print(_tabla([[c, d["envios"], f"{d['unidades']:.0f}",
                   round(d["unidades"] / d["envios"], 2), d["multi"]]
                  for c, d in sorted(r["canales"].items(), key=lambda x: -x[1]["envios"])],
                 ["canal", "envíos", "unidades", "u/envío", "multiprod."]))
    if a.top:
        print(f"\n## Top {a.top} SKU")
        print(_tabla([[s["sku"], f"{s['unidades']:.0f}", f"{s['ingresos']:,.0f}",
                       f"{s['ads']:.0f}", s["titulo"][:38]] for s in por_sku(env, desde)[:a.top]],
                     ["sku", "unid", "ingresos", "u.ads", "título"]))
    if meta["avisos"]:
        print("\n⚠ avisos:", *meta["avisos"], sep="\n  ")


def cmd_sku(a):
    from .ventas import cargar_ventas, por_sku
    from .sku import resolver
    from .catalogo import cargar_catalogo
    catalogo, meta = (None, None)
    if a.catalogo:
        catalogo, meta = cargar_catalogo(a.catalogo, columna=a.columna)
    env, _ = cargar_ventas(a.archivo)
    filas = []
    for s in por_sku(env):
        r, regla, conf = resolver(s["sku"], catalogo, s["item_id"])
        if regla != "exacto":
            filas.append([s["sku"], r, regla, conf, f"{s['unidades']:.0f}", s["titulo"][:34]])
    if meta:
        print(f"catálogo: {meta['total']} SKU (método {meta['metodo']}"
              + (f", {meta['columna']}" if meta["columna"] else "") + ")")
        if meta["metodo"] == "barrido":
            print("  ⚠ no se encontró columna COD/SKU: se barrió toda la planilla. "
                  "Puede arrastrar SKU viejos de hojas auxiliares.")
    print(_tabla(filas, ["sku reporte", "sku resuelto", "regla", "confianza", "unid", "título"])
          if filas else "sin SKU a corregir")
    if any(f[3] == "revisar" for f in filas):
        print("\n⚠ 'revisar' = NO resuelto automáticamente. Verificar por ITEM_ID contra el maestro.")


def cmd_catalogo(a):
    from .catalogo import cargar_catalogo, auditar
    skus, meta = cargar_catalogo(a.archivo, columna=a.columna)
    au = auditar(skus)
    print(f"# Catálogo — {meta['total']} SKU (método {meta['metodo']}"
          + (f", {meta['columna']}" if meta["columna"] else "") + ")")
    print("\n## Familias")
    print(_tabla([[k, v] for k, v in au["familias"].items()], ["prefijo", "SKU"]))
    print("\n## Consistencia de convención")
    if au["phc_sin_o"]:
        print(f"- {len(au['phc_sin_o'])} SKU en forma PHC0#### (sin la O): "
              + ", ".join(au["phc_sin_o"]))
        print(f"  colisiones con la forma PHCO####: {len(au['colisiones'])}"
              + (" -> corrección mecánica SEGURA" if not au["colisiones"]
                 else " -> ⚠ NO corregir automáticamente: " + ", ".join(au["colisiones"])))
    if au["fuera_de_convencion"]:
        print("- fuera de convención (PHCO + 5 dígitos): "
              + ", ".join(au["fuera_de_convencion"])
              + "\n  ⚠ verificar contra ITEM_ID: puede ser un producto distinto, no un typo.")
    if not au["phc_sin_o"] and not au["fuera_de_convencion"]:
        print("sin inconsistencias detectadas")


CACHE = os.path.expanduser("~/.cache/mt")


def a_parquet(path, hoja=None):
    """Convierte una planilla a parquet cacheado. duckdb no puede leer xlsx acá
    (la extensión 'excel' se baja de internet y el egress la bloquea), así que
    la conversión la hace pandas una sola vez por archivo."""
    import hashlib
    import pandas as pd
    os.makedirs(CACHE, exist_ok=True)
    st = os.stat(path)
    clave = hashlib.md5(f"{os.path.abspath(path)}|{st.st_mtime_ns}|{hoja}".encode()).hexdigest()[:16]
    dest = os.path.join(CACHE, clave + ".parquet")
    if not os.path.exists(dest):
        from .excel import cargar
        _t, cols, datos, _c = cargar(path, hoja)
        pd.DataFrame(datos, columns=cols).astype(str).to_parquet(dest, index=False)
    return dest


def cmd_sql(a):
    """SQL sobre planillas sin cargarlas al contexto. Todas las columnas son
    texto: usar mt_num() para comparar o sumar."""
    import duckdb
    con = duckdb.connect()
    con.create_function("mt_num", lambda v: __import__("mt.util", fromlist=["parse_num"]).parse_num(v, 0.0),
                        ["VARCHAR"], "DOUBLE")
    for i, f in enumerate(a.archivo):
        nombre = a.nombre[i] if a.nombre and i < len(a.nombre) else f"t{i}"
        pq = a_parquet(f, a.hoja[i] if a.hoja and i < len(a.hoja) else None)
        con.execute(f"CREATE VIEW {nombre} AS SELECT * FROM read_parquet('{pq}')")
    if a.columnas:
        for i, f in enumerate(a.archivo):
            nombre = a.nombre[i] if a.nombre and i < len(a.nombre) else f"t{i}"
            print(f"-- {nombre} ({os.path.basename(f)})")
            for c in con.execute(f"SELECT * FROM {nombre} LIMIT 0").description:
                print("   ", c[0])
        return
    con.sql(a.query).show(max_rows=a.limit)


def main(argv=None):
    p = argparse.ArgumentParser(prog="mt", description="Toolkit Multitrend — reportes ML")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("inventario", help="paso 0: identificar cada archivo del ciclo")
    s.add_argument("paths", nargs="+")
    s.set_defaults(func=cmd_inventario)

    s = sub.add_parser("ventas", help="Ventas UY parseado por envío")
    s.add_argument("archivo")
    s.add_argument("--desde", help="fecha de corte del ciclo anterior, p.ej. '16/08/2026 14:41'")
    s.add_argument("--top", type=int, default=10)
    s.set_defaults(func=cmd_ventas)

    s = sub.add_parser("sku", help="SKU que no matchean el catálogo")
    s.add_argument("archivo")
    s.add_argument("--catalogo", help="maestro .xlsx con los SKU válidos")
    s.add_argument("--columna", help="columna de SKU en el maestro (por defecto COD/SKU)")
    s.set_defaults(func=cmd_sku)

    s = sub.add_parser("catalogo", help="audita la consistencia de SKU del maestro")
    s.add_argument("archivo")
    s.add_argument("--columna")
    s.set_defaults(func=cmd_catalogo)

    s = sub.add_parser("sql", help="consulta SQL sobre planillas (duckdb)")
    s.add_argument("query", nargs="?", default="SELECT 1")
    s.add_argument("-f", "--archivo", action="append", required=True)
    s.add_argument("-n", "--nombre", action="append")
    s.add_argument("--hoja", action="append")
    s.add_argument("--columnas", action="store_true", help="lista las columnas y sale")
    s.add_argument("--limit", type=int, default=40)
    s.set_defaults(func=cmd_sql)

    a = p.parse_args(argv)
    return a.func(a) or 0


if __name__ == "__main__":
    sys.exit(main())
