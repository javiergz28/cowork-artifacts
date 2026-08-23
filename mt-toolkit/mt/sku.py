"""Resolución de SKU. Nunca inventa: si no puede resolver, marca para revisión.

Reglas conocidas (documentadas en areas/multitrend-pendientes.md):
  - Typo recurrente: falta la O después de PHC  -> PHC00025 = PHCO0025
  - Color truncado:  PHCO0029G = PHCO0029GRIS, PHCO0029N = PHCO0029NEGR
  - NO mecánico:     PHCO00032 -> PHCO0033 (producto distinto). Ese tipo de
    caso solo se resuelve por ITEM_ID contra el maestro, jamás por parecido.
"""
import re

RE_TYPO_PHC = re.compile(r"^PHC0(\d{4})(.*)$", re.I)


def limpiar(sku):
    if sku is None:
        return ""
    return re.sub(r"\s+", "", str(sku)).upper()


def resolver(sku, catalogo=None, item_id=None, mapa_item_id=None):
    """Devuelve (sku_resuelto, regla, confianza).

    regla: exacto | typo_phc | prefijo | item_id | sin_resolver
    confianza: alta | media | revisar

    `catalogo`      : iterable de SKU válidos del maestro.
    `mapa_item_id`  : dict {item_id -> sku} para resolver por publicación.
    """
    s = limpiar(sku)
    cat = set(limpiar(c) for c in catalogo) if catalogo else None

    if cat is None:
        m = RE_TYPO_PHC.match(s)
        if m and not s.startswith("PHCO"):
            return "PHCO" + m.group(1) + m.group(2).upper(), "typo_phc", "media"
        return s, ("exacto" if s else "sin_resolver"), ("alta" if s else "revisar")

    if s and s in cat:
        return s, "exacto", "alta"

    m = RE_TYPO_PHC.match(s)
    if m and not s.startswith("PHCO"):
        cand = "PHCO" + m.group(1) + m.group(2).upper()
        if cand in cat:
            return cand, "typo_phc", "alta"

    if s:
        pref = sorted(c for c in cat if c.startswith(s))
        if len(pref) == 1:
            return pref[0], "prefijo", "media"
        if len(pref) > 1:
            return s, "sin_resolver", "revisar"

    if item_id and mapa_item_id:
        cand = mapa_item_id.get(str(item_id).strip().upper())
        if cand:
            return limpiar(cand), "item_id", "alta"

    return s, "sin_resolver", "revisar"
