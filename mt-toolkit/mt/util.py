"""Utilidades base del toolkit Multitrend. Sin dependencias de negocio."""
import re
import unicodedata
from datetime import datetime

_MESES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
}

_LIMPIA_NUM = re.compile(r"[^\d,.\-]")


def parse_num(v, default=None):
    """Convierte a float un valor que puede venir como número o como texto con
    formato uruguayo/ML ('$ 1.234,56', '1,234.56', '12%', '1.234', '-79,82').

    Devuelve `default` si no se puede interpretar. NUNCA lanza excepción:
    los reportes de ML mezclan texto y números en la misma columna
    (p. ej. 'Venta por publicidad' trae 'Sí'/'No', no un número).
    """
    if v is None:
        return default
    if isinstance(v, bool):
        return default
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if not s:
        return default
    neg = s.startswith("(") and s.endswith(")")
    s = _LIMPIA_NUM.sub("", s)
    if not s or s in {"-", ",", "."}:
        return default
    tiene_coma, tiene_punto = "," in s, "." in s
    if tiene_coma and tiene_punto:
        # el separador decimal es el que aparece más a la derecha
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif tiene_coma:
        ent, _, dec = s.rpartition(",")
        # '1,5' -> decimal ; '1,234' -> puede ser miles. Con 3 dígitos y parte
        # entera no vacía asumimos miles (es el caso frecuente en ML).
        s = (ent + dec) if (len(dec) == 3 and ent not in ("", "-")) else (ent + "." + dec)
    elif tiene_punto:
        ent, _, dec = s.rpartition(".")
        if len(dec) == 3 and ent not in ("", "-") and "." not in ent:
            # ambiguo: '1.234'. ML exporta miles así en texto y decimales en
            # celdas numéricas, que no pasan por acá. Asumimos miles.
            s = ent + dec
    try:
        n = float(s)
    except ValueError:
        return default
    return -n if neg else n


def parse_fecha(v, default=None):
    """Fecha de ML: datetime, '14 de agosto de 2026 11:27 hs.', ISO o dd/mm/aaaa."""
    if v is None:
        return default
    if isinstance(v, datetime):
        return v
    s = str(v).strip()
    if not s:
        return default
    m = re.search(
        r"(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?",
        s.lower(),
    )
    if m:
        d, mes, a = int(m.group(1)), _MESES.get(m.group(2)), int(m.group(3))
        if mes:
            hh = int(m.group(4)) if m.group(4) else 0
            mm = int(m.group(5)) if m.group(5) else 0
            return datetime(a, mes, d, hh, mm)
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y %H:%M", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    return default


def sin_tildes(s):
    return "".join(
        c for c in unicodedata.normalize("NFD", str(s)) if unicodedata.category(c) != "Mn"
    )


def norm_txt(s):
    """Normaliza un encabezado para comparar: sin tildes, minúsculas, 1 espacio."""
    return re.sub(r"\s+", " ", sin_tildes(s or "").lower()).strip()


def es_cancelada(estado):
    """ML usa al menos 3 redacciones distintas para cancelado
    ('Cancelada', 'Venta cancelada. No despaches.', 'Cancelado por el comprador').
    Filtrar por prefijo deja pasar casos: siempre por substring.
    """
    return "cancel" in norm_txt(estado)
