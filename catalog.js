import MDBReader from 'mdb-reader';

function normalizeEAN(raw) {
  const n = String(raw ?? '').trim();
  // If it looks numeric, pad to 13 digits
  if (/^\d+$/.test(n)) return n.padStart(13, '0');
  return n;
}

function formatPrice(val) {
  const n = Number(val);
  if (!n) return null;
  return n;
}

export async function extractFromFile(file) {
  const buffer = await file.arrayBuffer();
  // Buffer is injected by esbuild (process-inject.js) — has .copy() needed by mdb-reader
  const db = new MDBReader(Buffer.from(buffer));

  const byEAN = new Map();

  // PLURED — main catalog (PLU for network/red)
  try {
    const tbl = db.getTable('PLURED');
    for (const row of tbl.getData()) {
      const ean = normalizeEAN(Math.round(Number(row.ARTIC_CEAN)));
      if (!ean || ean === '0000000000000') continue;
      byEAN.set(ean, {
        ean,
        nombre: String(row.ARTIC_NOMB ?? '').trim() || null,
        precio: formatPrice(row.ARTIC_PREC),
        depto: Number(row.DEPTO) || null,
        iva: Number(row.IVA) || null,
      });
    }
  } catch (e) {
    console.warn('PLURED read error:', e.message);
  }

  // ProductosPen — novedades (overrides PLURED where present, more detail)
  try {
    const tbl = db.getTable('ProductosPen');
    for (const row of tbl.getData()) {
      const ean = normalizeEAN(row['Código de Barras']);
      if (!ean || ean === '0000000000000') continue;
      const existing = byEAN.get(ean) ?? {};
      byEAN.set(ean, {
        ean,
        nombre: String(row['Descripción Larga'] ?? existing.nombre ?? '').trim() || null,
        precio: formatPrice(row['Precio A']) ?? existing.precio,
        depto: Number(row['Departamento']) || existing.depto || null,
        iva: Number(row['IVA']) || existing.iva || null,
      });
    }
  } catch (e) {
    console.warn('ProductosPen read error:', e.message);
  }

  return [...byEAN.values()].filter(p => p.nombre);
}
