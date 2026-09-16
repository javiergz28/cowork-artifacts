// Modelo de posición actual de stock, costo y margen unitario. No usa ventas
// ni comparaciones históricas: cada alerta sale de la misma foto del Maestro.
export const PRIORITIES = Object.freeze({urgent: 0, high: 1, minor: 2, none: 3});
export const RULES = Object.freeze({lowMargin: 0.15});

const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const positive = value => number(value) !== null && value > 0 ? value : null;
const nonNegative = value => number(value) !== null && value >= 0 ? value : null;
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const closeEnough = (actual, expected, tolerance = 0.02) => Math.abs(actual - expected) <= tolerance;

function readParameters(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('Faltan los parámetros del Maestro.');
  const values = new Map(rows.slice(1).map(([name, value]) => [normalize(name), value]));
  const required = (name, predicate) => {
    const value = number(values.get(normalize(name)));
    if (value === null || !predicate(value)) throw new Error(`Parámetro inválido o faltante: ${name}`);
    return value;
  };
  return {
    exchange: required('Tipo de cambio USD/UYU', value => value > 0),
    importFactor: required('Coef. aranceles / importacion', value => value >= 1),
    taxFactor: required('Coef. impuestos', value => value >= 1),
    mlFee: required('Comision ML %', value => value >= 0 && value < 1),
    webFee: required('Comision pasarela web %', value => value >= 0 && value < 1)
  };
}

function channel(price, suggestedPrice, cost, fee, status, isPublished) {
  const margin = price !== null && cost !== null ? price - cost - price * fee : null;
  return {
    price,
    suggestedPrice,
    fee,
    status,
    isPublished,
    commission: price !== null ? price * fee : null,
    margin,
    pct: margin !== null ? margin / price : null
  };
}

function expectedCosts(purchase, currency, parameters) {
  if (purchase === null) return null;
  if (currency === 'uyu') return {base: purchase, importCharge: 0, importTax: 0, final: purchase};
  if (currency !== 'usd') return null;
  const base = purchase * parameters.exchange;
  const importCharge = base * (parameters.importFactor - 1);
  const importTax = (base + importCharge) * (parameters.taxFactor - 1);
  return {base, importCharge, importTax, final: base + importCharge + importTax};
}

function auditCosts(raw, expected) {
  if (!expected) return [];
  const fields = [
    ['Costo base UYU', 'base'],
    ['Recargo import. est.', 'importCharge'],
    ['IVA import. est.', 'importTax'],
    ['Costo final UYU', 'final']
  ];
  return fields.flatMap(([header, key]) => {
    const actual = number(raw[header]);
    return actual !== null && !closeEnough(actual, expected[key]) ? [{header, actual, expected: expected[key]}] : [];
  });
}

function auditMargins(raw, product) {
  const fields = [
    ['Margen web $', product.web.margin, 0.02],
    ['Margen web %', product.web.pct, 0.0002],
    ['Comisión ML $', product.ml.commission, 0.02],
    ['Margen ML $', product.ml.margin, 0.02],
    ['Margen ML %', product.ml.pct, 0.0002]
  ];
  return fields.flatMap(([header, expected, tolerance]) => {
    const actual = number(raw[header]);
    return actual !== null && expected !== null && !closeEnough(actual, expected, tolerance) ? [{header, actual, expected}] : [];
  });
}

function collectActions(product) {
  const actions = [];
  const add = (priority, code, title, why, next) => actions.push({priority, code, title, why, next});
  const inStock = product.stock !== null && product.stock > 0;

  if (product.basisUnverified) {
    add(inStock ? 'urgent' : 'high', 'verify-unit', 'Validar pack y unidad',
      'La nota del Maestro indica que falta confirmar la equivalencia entre la presentación, las unidades y el stock.',
      'Confirmar cuántas unidades incluye la presentación y reconciliar costo y stock antes de valorar ese inventario.');
  }
  if (product.stock === null || product.stock < 0) {
    add('high', 'invalid-stock', 'Revisar stock registrado',
      'STOCK está vacío, no es numérico o es negativo en la foto actual.',
      'Conciliar el dato en STOCK_MT_FINAL. No usarlo como unidades disponibles hasta resolverlo.');
  }
  if (inStock && product.purchase === null) {
    add('high', 'missing-purchase', 'Completar compra declarada',
      'Hay stock positivo, pero Compra no contiene un importe numérico positivo.',
      'Revisar el costo de compra de la misma presentación que figura en STOCK.');
  }
  if (inStock && !product.currencyRecognized) {
    add('high', 'invalid-currency', 'Revisar moneda de compra',
      'La moneda no es UYU ni USD, por lo que no se puede verificar cómo se forma el costo.',
      'Confirmar Moneda y el importe de Compra antes de estimar el valor del stock.');
  }
  if (inStock && product.finalCost === null) {
    add('high', 'missing-cost', 'Completar costo final',
      'Hay stock positivo, pero Costo final UYU está vacío, no es numérico o no es positivo.',
      'Revisar Compra, Moneda y el bloque de costos antes de usar una valuación.');
  }
  if (product.auditDifferences.length) {
    add('high', 'formula-difference', 'Revisar cálculos del Maestro',
      'Uno o más costos o márgenes registrados no coincide con el recálculo usando los parámetros de esta misma foto.',
      'Verificar fórmulas y referencias de la fila antes de basar una decisión de stock o precio en esos valores.');
  }
  if (!product.basisUnverified) {
    for (const [key, label] of [['web', 'Web'], ['ml', 'Mercado Libre']]) {
      const value = product[key];
      if (inStock && value.isPublished && value.price === null) {
        add('high', `missing-price-${key}`, `Completar precio ${label}`,
          `El Maestro registra ${label} como publicado, con stock y sin un precio numérico positivo.`,
          `Verificar el precio vigente en ${label} y actualizar el Maestro antes de interpretar el margen.`);
      }
      if (value.margin !== null) {
        if (value.margin < 0) {
          add(inStock ? 'urgent' : 'high', `negative-margin-${key}`, `Revisar margen negativo ${label}`,
            `Con el precio y la comisión estimada actuales, ${label} no cubre el costo final unitario.`,
            'Comprobar costo, presentación, precio y comisión; después decidir si corresponde ajustar o pausar la oferta.');
        } else if (inStock && value.pct < RULES.lowMargin) {
          add('high', `low-margin-${key}`, `Revisar margen bajo ${label}`,
            `El margen unitario estimado de ${label} es menor al 15% del precio actual.`,
            'Confirmar si alcanza para los demás gastos del negocio antes de sostener ese precio.');
        }
      }
    }
  }
  if (product.stock === 0) {
    add('minor', 'zero-stock', 'Producto sin stock',
      'La foto actual registra cero unidades.',
      'Decidir si se mantiene el producto y validar el costo antes de una reposición.');
  }
  return actions.sort((a, b) => PRIORITIES[a.priority] - PRIORITIES[b.priority]);
}

export function buildStockPosition(snapshot) {
  if (!snapshot?.meta?.fetchedAtUtc || !Array.isArray(snapshot.articles) || !Array.isArray(snapshot.parameters)) {
    throw new Error('Snapshot incompleto: se requieren meta.fetchedAtUtc, articles y parameters.');
  }
  const [headers, ...rows] = snapshot.articles;
  const requiredHeaders = ['ITEM COD', 'NAME', 'CATEGORY', 'STOCK', 'Compra', 'Moneda', 'Costo base UYU', 'Recargo import. est.', 'IVA import. est.', 'Costo final UYU', 'Precio Web', 'Precio ML', 'Online WEB', 'Estado ML', 'Notas'];
  for (const header of requiredHeaders) if (!headers.includes(header)) throw new Error(`Falta el encabezado ${header}`);
  if (new Set(headers).size !== headers.length) throw new Error('Encabezados duplicados.');

  const parameters = readParameters(snapshot.parameters);
  const seen = new Set();
  const products = rows.map((row, index) => {
    const raw = Object.fromEntries(headers.map((header, column) => [header, row[column] ?? '']));
    if (!String(raw['ITEM COD']).trim()) return null;
    const sku = String(raw['ITEM COD']).trim();
    if (seen.has(sku)) throw new Error(`SKU duplicado: ${sku}`);
    seen.add(sku);

    const purchase = positive(raw.Compra);
    const currency = normalize(raw.Moneda);
    const currencyRecognized = currency === 'uyu' || currency === 'usd';
    const expected = expectedCosts(purchase, currency, parameters);
    const notes = String(raw.Notas ?? '');
    const basisUnverified = /pack|piezas/i.test(notes) && /verificar|equival/i.test(notes);
    const product = {
      sku,
      name: String(raw.NAME || 'Sin nombre'),
      category: String(raw.CATEGORY || 'Sin categoría'),
      stock: number(raw.STOCK),
      purchase,
      currency: String(raw.Moneda ?? '').trim() || 'Sin dato',
      currencyRecognized,
      baseCost: positive(raw['Costo base UYU']),
      importCharge: nonNegative(raw['Recargo import. est.']),
      importTax: nonNegative(raw['IVA import. est.']),
      finalCost: positive(raw['Costo final UYU']),
      notes,
      basisUnverified,
      sheetRow: index + 2,
      raw,
      expectedCosts: expected
    };
    product.multiplier = positive(raw.Multiplicador);
    product.web = channel(positive(raw['Precio Web']), positive(raw['Precio Sugerido WEB $']), product.finalCost, parameters.webFee, String(raw['Online WEB'] ?? ''), normalize(raw['Online WEB']) === 'publicado');
    product.ml = channel(positive(raw['Precio ML']), positive(raw['Precio Sugerido ML']), product.finalCost, parameters.mlFee, String(raw['Estado ML'] ?? ''), normalize(raw['Estado ML']) === 'activa');
    product.auditDifferences = [...auditCosts(raw, expected), ...auditMargins(raw, product)];
    product.stockValue = product.stock !== null && product.stock > 0 && product.finalCost !== null && !basisUnverified
      ? product.stock * product.finalCost
      : null;
    product.actions = collectActions(product);
    product.priority = product.actions[0]?.priority ?? 'none';
    return product;
  }).filter(Boolean);

  if (!products.length) throw new Error('El snapshot no contiene artículos con ITEM COD.');
  const knownPosition = products.filter(product => product.stockValue !== null);
  const stockRows = products.filter(product => product.stock !== null && product.stock > 0);
  return {
    meta: snapshot.meta,
    parameters,
    headers,
    products,
    summary: {
      products: products.length,
      stock: products.reduce((sum, product) => sum + (product.stock !== null && product.stock >= 0 ? product.stock : 0), 0),
      stockRows: stockRows.length,
      valuedRows: knownPosition.length,
      stockValue: knownPosition.reduce((sum, product) => sum + product.stockValue, 0),
      byPriority: Object.fromEntries(Object.keys(PRIORITIES).map(priority => [priority, products.filter(product => product.priority === priority).length])),
      formulaDifferences: products.filter(product => product.auditDifferences.length).length,
      basisUnverified: products.filter(product => product.basisUnverified).length,
      missingCostWithStock: products.filter(product => product.stock !== null && product.stock > 0 && product.finalCost === null).length,
      webMarginKnown: products.filter(product => product.web.margin !== null).length,
      mlMarginKnown: products.filter(product => product.ml.margin !== null).length,
      negativeMargins: products.filter(product => (product.web.margin !== null && product.web.margin < 0) || (product.ml.margin !== null && product.ml.margin < 0)).length
    },
    rules: RULES
  };
}
