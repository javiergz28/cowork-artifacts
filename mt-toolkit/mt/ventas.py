"""Parseo del reporte 'Ventas UY' a nivel ENVÍO FÍSICO, no a nivel fila.

Por qué importa: los paquetes multiproducto ocupan varias filas. La cabecera
trae Estado='Paquete de N productos' y la Forma de entrega; las N filas hijas
traen SKU y unidades con Forma de entrega vacía. Filtrar cancelados fila por
fila da mal el neto (fue el bug que mantuvo abierta la discrepancia 99 vs 93
durante dos ciclos).

Regla validada contra el export del 15/08/2026: 17 de 17 paquetes, 0 huérfanos.
"""
import re
from dataclasses import dataclass, field
from .excel import cargar, buscar_col
from .util import parse_num, parse_fecha, es_cancelada, norm_txt

RE_PAQUETE = re.compile(r"^paquete de (\d+) productos?", re.I)


@dataclass
class Item:
    sku: str = ""
    item_id: str = ""
    titulo: str = ""
    unidades: float = 0.0
    ingresos: float = 0.0
    por_publicidad: bool = False


@dataclass
class Envio:
    venta: str = ""
    fecha: object = None
    estado: str = ""
    canal: str = ""
    cancelado: bool = False
    es_paquete: bool = False
    items: list = field(default_factory=list)

    @property
    def unidades(self):
        return sum(i.unidades for i in self.items)

    @property
    def ingresos(self):
        return sum(i.ingresos for i in self.items)


def _txt(v):
    return "" if v is None else str(v).strip()


def cargar_ventas(path, hoja=None):
    """Devuelve (envios, meta). meta trae corte del reporte y avisos."""
    titulo, cols, datos, crudas = cargar(path, hoja)

    c_venta = buscar_col(cols, "# de venta")
    c_fecha = buscar_col(cols, "fecha de venta")
    c_estado = buscar_col(cols, "estado", grupo="Ventas") or buscar_col(cols, "estado")
    c_unid = buscar_col(cols, "unidades", grupo="Ventas") or buscar_col(cols, "unidades")
    c_ing = buscar_col(cols, "ingresos por productos")
    c_sku = buscar_col(cols, "sku")
    c_item = buscar_col(cols, "# de publicacion") or buscar_col(cols, "publicacion")
    c_tit = buscar_col(cols, "titulo de la publicacion")
    c_canal = buscar_col(cols, "forma de entrega", grupo="Envíos") or buscar_col(cols, "forma de entrega")
    c_ads = buscar_col(cols, "venta por publicidad")

    faltan = [n for n, c in [("# de venta", c_venta), ("estado", c_estado),
                             ("unidades", c_unid), ("forma de entrega", c_canal)] if not c]
    envios, avisos = [], []
    if faltan:
        avisos.append("FALTAN COLUMNAS CLAVE: " + ", ".join(faltan) + " -> revisar el export")
        return envios, {"hoja": titulo, "avisos": avisos, "corte": None, "columnas": cols}

    actual = None
    pendientes = 0
    for r in datos:
        estado = _txt(r.get(c_estado))
        canal = _txt(r.get(c_canal))
        m = RE_PAQUETE.match(estado)
        if m:
            if actual is not None and pendientes > 0:
                avisos.append(f"paquete {actual.venta} quedó con {pendientes} hijos faltantes")
            actual = Envio(venta=_txt(r.get(c_venta)), fecha=parse_fecha(r.get(c_fecha)),
                           estado=estado, canal=canal, es_paquete=True,
                           cancelado=es_cancelada(estado))
            pendientes = int(m.group(1))
            envios.append(actual)
            continue

        item = Item(
            sku=_txt(r.get(c_sku)) if c_sku else "",
            item_id=_txt(r.get(c_item)) if c_item else "",
            titulo=_txt(r.get(c_tit)) if c_tit else "",
            unidades=parse_num(r.get(c_unid), 0.0) or 0.0,
            ingresos=parse_num(r.get(c_ing), 0.0) or 0.0 if c_ing else 0.0,
            por_publicidad=norm_txt(r.get(c_ads)).startswith("si") if c_ads else False,
        )
        if canal == "" and actual is not None and pendientes > 0:
            actual.items.append(item)          # fila hija de un paquete
            pendientes -= 1
            if pendientes == 0:
                actual = None
        else:
            if canal == "" and actual is None:
                avisos.append(f"fila sin forma de entrega y sin paquete abierto (venta {_txt(r.get(c_venta))})")
            e = Envio(venta=_txt(r.get(c_venta)), fecha=parse_fecha(r.get(c_fecha)),
                      estado=estado, canal=canal, cancelado=es_cancelada(estado))
            e.items.append(item)
            envios.append(e)
            actual, pendientes = None, 0

    corte = None
    for f in crudas[:8]:
        for c in f:
            if c and "estado de tus ventas al" in norm_txt(c):
                corte = parse_fecha(str(c).split(" al ", 1)[-1])
    return envios, {"hoja": titulo, "avisos": avisos, "corte": corte, "columnas": cols}


def resumen(envios, desde=None):
    """Agregados que el ciclo necesita siempre. `desde` filtra por fecha de venta."""
    es = [e for e in envios if not desde or (e.fecha and e.fecha > desde)]
    efec = [e for e in es if not e.cancelado]
    canc = [e for e in es if e.cancelado]
    canales = {}
    for e in efec:
        c = e.canal or "(sin canal)"
        d = canales.setdefault(c, {"envios": 0, "unidades": 0.0, "multi": 0})
        d["envios"] += 1
        d["unidades"] += e.unidades
        if len(e.items) > 1:
            d["multi"] += 1
    n = len(efec)
    u = sum(e.unidades for e in efec)
    multi = sum(1 for e in efec if len(e.items) > 1)
    return {
        "envios_efectivos": n,
        "envios_cancelados": len(canc),
        "unidades_brutas": u + sum(e.unidades for e in canc),
        "unidades_netas": u,
        "unidades_canceladas": sum(e.unidades for e in canc),
        "ingresos_netos": sum(e.ingresos for e in efec),
        "unidades_por_envio": round(u / n, 2) if n else 0,
        "ordenes_multiproducto": multi,
        "pct_multiproducto": round(100 * multi / n, 1) if n else 0,
        "ticket_promedio": round(sum(e.ingresos for e in efec) / n, 2) if n else 0,
        "canales": canales,
    }


def por_sku(envios, desde=None, incluir_cancelados=False):
    agg = {}
    for e in envios:
        if desde and (not e.fecha or e.fecha <= desde):
            continue
        if e.cancelado and not incluir_cancelados:
            continue
        for it in e.items:
            d = agg.setdefault(it.sku or "(sin sku)", {
                "sku": it.sku or "(sin sku)", "titulo": it.titulo,
                "item_id": it.item_id, "unidades": 0.0, "ingresos": 0.0, "ads": 0.0})
            d["unidades"] += it.unidades
            d["ingresos"] += it.ingresos
            if it.por_publicidad:
                d["ads"] += it.unidades
    return sorted(agg.values(), key=lambda x: -x["unidades"])
