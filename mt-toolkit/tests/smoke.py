"""Smoke test: se corre antes de cada push. No reemplaza la validación contra
archivos reales, pero evita romper lo que ya funcionaba."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from mt.util import parse_num, parse_fecha, es_cancelada
from mt.sku import resolver

fallas = []
def chk(nombre, got, esp):
    if got != esp:
        fallas.append(f"{nombre}: got {got!r} esperado {esp!r}")

for v, e in [("$ 1.234,56", 1234.56), ("1.234", 1234.0), ("1,5", 1.5), ("-79.82", -79.82),
             ("12%", 12.0), ("Sí", None), ("", None), (None, None), ("(410,18)", -410.18)]:
    chk(f"parse_num({v!r})", parse_num(v), e)

chk("parse_fecha", str(parse_fecha("14 de agosto de 2026 11:27 hs.")), "2026-08-14 11:27:00")
for s, e in [("Entregado", False), ("Venta cancelada. No despaches.", True),
             ("Cancelado por el comprador", True), ("Cancelada. No despaches", True)]:
    chk(f"es_cancelada({s!r})", es_cancelada(s), e)

chk("sku typo", resolver("PHC00025", {"PHCO0025"})[0], "PHCO0025")
chk("sku typo regla", resolver("PHC00025", {"PHCO0025"})[1], "typo_phc")
chk("sku exacto", resolver("PHDH0004", {"PHDH0004"})[1], "exacto")
chk("sku ambiguo", resolver("PHCO0029", {"PHCO0029GRIS", "PHCO0029NEGR"})[2], "revisar")
chk("sku prefijo", resolver("PHCO0029G", {"PHCO0029GRIS"})[0], "PHCO0029GRIS")

if fallas:
    print("FALLAS:"); [print(" -", f) for f in fallas]; sys.exit(1)
print("smoke OK")
