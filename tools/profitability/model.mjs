// Inputs contain the effective values read from the workbook. Never substitute
// historical costs, exchange rates or commissions when a parameter is missing.
export const RULES = Object.freeze({lowMargin: 0.15, targetTolerance: 0.01});
export const PRIORITIES = Object.freeze({urgent: 0, high: 1, medium: 2, minor: 3, none: 4});
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const positive = value => number(value) !== null && value > 0 ? value : null;
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function readParameters(rows) {
  const values = new Map(rows.slice(1).map(([name, value]) => [normalize(name), value]));
  const requireNumber = (name, predicate) => {
    const value = number(values.get(normalize(name)));
    if (value === null || !predicate(value)) throw new Error(`Parámetro inválido o faltante: ${name}`);
    return value;
  };
  return {
    exchange: requireNumber('Tipo de cambio USD/UYU', value => value > 0),
    importFactor: requireNumber('Coef. aranceles / importacion', value => value >= 1),
    taxFactor: requireNumber('Coef. impuestos', value => value >= 1),
    mlFee: requireNumber('Comision ML %', value => value >= 0 && value < 1),
    webFee: requireNumber('Comision pasarela web %', value => value >= 0 && value < 1),
    shipping: String(values.get('envio') ?? 'Sin dato')
  };
}

function channel(price, cost, fee, multiplier, basisUnverified, status, isPublished) {
  const margin = price !== null && cost !== null ? price - cost - price * fee : null;
  return {
    price, fee, status, isPublished,
    commission: price !== null ? price * fee : null,
    margin,
    pct: margin !== null ? margin / price : null,
    // A multiplier is applied to cost after commission, not to sales margin.
    referencePrice: cost !== null && multiplier !== null && !basisUnverified ? cost * multiplier / (1 - fee) : null,
    breakeven: cost !== null && !basisUnverified ? cost / (1 - fee) : null
  };
}

function collectActions(product) {
  const actions = [];
  const add = (priority, code, title, why, next, channels = []) => actions.push({priority, code, title, why, next, channels});
  const inStock = product.stock !== null && product.stock > 0;
  if (product.basisUnverified) {
    add(inStock ? 'urgent' : 'high', 'verify-unit', 'Validar pack y unidad',
      'La nota del Maestro pide verificar la equivalencia entre packs, piezas y stock. El costo y los márgenes dependen de esa equivalencia.',
      'Confirmar qué presentación se vende y cuántas piezas incluye. Conciliar costo y stock con esa misma unidad antes de decidir un precio.');
  }
  if (product.stock === null || product.stock < 0) {
    add('high', 'invalid-stock', 'Revisar stock registrado', 'STOCK está vacío, no es numérico o es negativo.',
      'Conciliar el dato en la fuente operativa. No interpretar el valor como unidades disponibles.');
  }
  if (product.cost === null) {
    add(inStock ? 'high' : 'minor', 'missing-cost', 'Completar costo', 'El Maestro no tiene un costo final positivo; no se puede estimar rentabilidad.',
      'Revisar Compra, Moneda y el bloque de costos. Confirmar el costo de la presentación vendida antes de evaluar el precio.');
  }
  for (const key of ['web', 'ml']) {
    const value = product[key];
    const label = key === 'web' ? 'web' : 'Mercado Libre';
    if (value.price === null && inStock && value.isPublished) {
      add('high', 'missing-price', `Completar precio ${label}`, `Figura publicado en ${label}, con stock y sin un precio positivo en el Maestro.`,
        `Verificar el precio vigente de ${label} y actualizar el Maestro antes de evaluar el margen.`, [key]);
    }
    if (value.pct !== null && !product.basisUnverified) {
      if (value.margin < 0) {
        add(inStock ? 'urgent' : 'medium', 'negative-margin', `Revisar margen negativo ${label}`,
          `El precio registrado de ${label} no cubre costo y comisión estimada.`,
          'Comprobar costo, presentación y precio vigente. Después decidir el precio o pausar la oferta afectada.', [key]);
      } else if (value.pct < RULES.lowMargin) {
        add(inStock ? 'high' : 'minor', 'low-margin', `Revisar margen bajo ${label}`,
          `El margen unitario estimado de ${label} es menor al umbral de revisión del panel.`,
          'Revisar si ese margen alcanza para los demás gastos; decidir precio, costo u oferta con el responsable comercial.', [key]);
      } else if (inStock && value.referencePrice !== null && value.price < value.referencePrice * (1 - RULES.targetTolerance)) {
        add('medium', 'target-gap', `Revisar multiplicador ${label}`,
          `El ingreso después de la comisión de ${label} queda por debajo de costo × multiplicador.`,
          'Confirmar si el multiplicador sigue siendo el objetivo comercial. Revisar precio u objetivo; la referencia es orientativa.', [key]);
      }
    }
  }
  if (inStock && product.multiplier === null && product.cost !== null) {
    add('medium', 'missing-target', 'Definir multiplicador', 'Falta un multiplicador positivo para comparar el objetivo sobre el costo.',
      'Acordar el objetivo comercial. El margen con el precio cargado sí se puede calcular.');
  }
  if (product.auditDifferences.length) {
    add('high', 'formula-difference', 'Revisar cálculo del Maestro',
      'Hay valores del bloque que difieren del recálculo con los parámetros leídos.',
      'Comprobar las fórmulas y sus referencias antes de usar el margen para tomar decisiones.');
  }
  if (product.stock === 0) {
    add('minor', 'zero-stock', 'Revisar antes de reponer', 'El stock registrado es cero.',
      'Decidir si el producto continúa. Antes de reponer, validar costo y precio; este panel no estima demanda.');
  }
  return actions.sort((a, b) => PRIORITIES[a.priority] - PRIORITIES[b.priority]);
}

function audit(product) {
  const differences = [];
  const compare = (header, expected, tolerance = 0.02) => {
    const actual = number(product.raw[header]);
    if (actual !== null && expected !== null && Math.abs(actual - expected) > tolerance) {
      differences.push({header, actual, expected});
    }
  };
  compare('Margen web $', product.web.margin);
  compare('Margen web %', product.web.pct, 0.0002);
  compare('Comisión ML $', product.ml.commission);
  compare('Costo total ML', product.cost !== null && product.ml.commission !== null ? product.cost + product.ml.commission : null);
  compare('Margen ML $', product.ml.margin);
  compare('Margen ML %', product.ml.pct, 0.0002);
  compare('Margen teórico %', product.theoreticalMargin, 0.0002);
  return differences;
}

export function buildModel(snapshot) {
  if (!snapshot?.meta?.fetchedAtUtc || !Array.isArray(snapshot.articles) || !Array.isArray(snapshot.parameters)) {
    throw new Error('Snapshot incompleto: se requieren meta.fetchedAtUtc, articles y parameters.');
  }
  const [headers, ...rows] = snapshot.articles;
  for (const header of ['ITEM COD', 'NAME', 'CATEGORY', 'STOCK', 'Costo final UYU', 'Precio Web', 'Precio ML', 'Multiplicador', 'Notas', 'Online WEB', 'Estado ML']) {
    if (!headers.includes(header)) throw new Error(`Falta el encabezado ${header}`);
  }
  if (new Set(headers).size !== headers.length) throw new Error('Encabezados duplicados.');
  const parameters = readParameters(snapshot.parameters);
  const seen = new Set();
  const products = rows.map((row, index) => {
    const raw = Object.fromEntries(headers.map((header, i) => [header, row[i] ?? '']));
    if (!String(raw['ITEM COD']).trim()) return null;
    const sku = String(raw['ITEM COD']).trim();
    if (seen.has(sku)) throw new Error(`SKU duplicado: ${sku}`);
    seen.add(sku);
    const notes = String(raw.Notas ?? '');
    // Read the workbook's explicit verification note; do not guess an error from
    // a SKU suffix, product title, low price or a product's pack presentation.
    const basisUnverified = /pack|piezas/i.test(notes) && /verificar|equival/i.test(notes);
    const cost = positive(raw['Costo final UYU']);
    const multiplier = positive(raw.Multiplicador);
    const product = {
      sku, name: String(raw.NAME), category: String(raw.CATEGORY || 'Sin categoría'),
      stock: number(raw.STOCK), cost, multiplier, notes, basisUnverified,
      theoreticalMargin: multiplier !== null ? 1 - 1 / multiplier : null,
      sheetRow: index + 2, raw,
      web: channel(positive(raw['Precio Web']), cost, parameters.webFee, multiplier, basisUnverified, String(raw['Online WEB']), normalize(raw['Online WEB']) === 'publicado'),
      ml: channel(positive(raw['Precio ML']), cost, parameters.mlFee, multiplier, basisUnverified, String(raw['Estado ML']), normalize(raw['Estado ML']) === 'activa')
    };
    product.auditDifferences = audit(product);
    product.actions = collectActions(product);
    product.priority = product.actions[0]?.priority ?? 'none';
    return product;
  }).filter(Boolean);
  if (!products.length) throw new Error('El snapshot no contiene artículos con ITEM COD.');
  return {
    meta: snapshot.meta, parameters, rules: RULES, headers, products,
    summary: {
      products: products.length,
      stock: products.reduce((sum, product) => sum + (product.stock !== null && product.stock >= 0 ? product.stock : 0), 0),
      comparable: products.filter(product => product.web.margin !== null && product.ml.margin !== null && !product.basisUnverified).length,
      costMissing: products.filter(product => product.cost === null).length,
      byPriority: Object.fromEntries(Object.keys(PRIORITIES).map(priority => [priority, products.filter(product => product.priority === priority).length])),
      formulaDifferences: products.filter(product => product.auditDifferences.length).length,
      basisUnverified: products.filter(product => product.basisUnverified).length
    }
  };
}
