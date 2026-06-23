const express = require('express');
const multer = require('multer');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MDBReader = require('mdb-reader').default;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

// POST /api/generar-bac
// multipart: bac (file) + eans (JSON array of EAN strings)
app.post('/api/generar-bac', upload.single('bac'), (req, res) => {
  const id = Date.now();
  const srcPath = `/tmp/src_${id}.bac`;
  const outPath = `/tmp/out_${id}.bac`;
  const tmpFiles = [srcPath, outPath];

  try {
    const eans = JSON.parse(req.body.eans);
    // Normalize: strip leading zeros that double-precision can't store
    const eanSet = new Set(
      eans.map(e => String(e).trim()).flatMap(e => [e, String(Number(e))])
    );

    const bacBuf = req.file.buffer;
    fs.writeFileSync(srcPath, bacBuf);

    // Read schema + data from source
    const db = new MDBReader(bacBuf);
    const tableNames = db.getTableNames();

    // Create new empty JET3 database
    const created = spawnSync('mdb-create', ['-v', 'JET3', outPath]);
    if (created.status !== 0) {
      throw new Error('mdb-create failed: ' + (created.stderr || '').toString());
    }

    for (const tableName of tableNames) {
      const tbl = db.getTable(tableName);
      const colNames = tbl.getColumnNames();
      const cols = colNames.map(n => ({ name: n, ...tbl.getColumn(n) }));

      // Build CREATE TABLE SQL
      const colDefs = cols.map(c => `[${c.name}] ${mdbType(c)}`).join(', ');
      const createSQL = `CREATE TABLE [${tableName}] (${colDefs});\n`;
      const sqlResult = spawnSync('mdb-sql', [outPath], {
        input: createSQL,
        encoding: 'utf8',
      });
      if (sqlResult.stderr && sqlResult.stderr.trim()) {
        console.warn(`CREATE TABLE ${tableName}:`, sqlResult.stderr.trim());
      }

      // Get rows (filtered for product tables)
      let rows = tbl.getData();

      if (tableName === 'PLURED') {
        rows = rows.filter(r => {
          const ean = String(Math.round(Number(r.ARTIC_CEAN)));
          return eanSet.has(ean);
        });
      } else if (tableName === 'ProductosPen') {
        rows = rows.filter(r => {
          const raw = String(r['Código de Barras'] ?? '').trim();
          return eanSet.has(raw) || eanSet.has(String(Number(raw)));
        });
      }

      if (rows.length === 0) continue;

      // Export as TSV and import
      const tsvLines = rows.map(row =>
        colNames.map(n => {
          const v = row[n];
          if (v === null || v === undefined) return '';
          return String(v).replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
        }).join('\t')
      );
      const tsv = tsvLines.join('\n') + '\n';

      const tsvPath = `/tmp/data_${id}_${safeFileName(tableName)}.tsv`;
      tmpFiles.push(tsvPath);
      fs.writeFileSync(tsvPath, tsv, 'utf8');

      const importResult = spawnSync(
        'mdb-import',
        ['-d', '\t', '-H', outPath, tableName, tsvPath],
        { encoding: 'utf8' }
      );
      if (importResult.stderr && importResult.stderr.trim()) {
        console.warn(`mdb-import ${tableName}:`, importResult.stderr.trim());
      }
    }

    const output = fs.readFileSync(outPath);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="novedades_filtradas.bac"');
    res.send(output);

  } catch (err) {
    console.error('/api/generar-bac error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    tmpFiles.forEach(f => { try { fs.unlinkSync(f); } catch (_) {} });
  }
});

function safeFileName(s) {
  return s.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 40);
}

function mdbType(col) {
  const t = (col.type || '').toLowerCase();
  switch (t) {
    case 'double':       return 'DOUBLE';
    case 'single':       return 'SINGLE';
    case 'long integer': return 'LONG INTEGER';
    case 'integer':      return 'INTEGER';
    case 'byte':         return 'BYTE';
    case 'boolean':      return 'BOOLEAN';
    case 'datetime':     return 'DATETIME';
    case 'currency':     return 'CURRENCY';
    case 'memo':         return 'MEMO';
    case 'text':         return `TEXT(${col.size > 0 ? col.size : 255})`;
    default:             return 'TEXT(255)';
  }
}

app.listen(PORT, () => console.log(`Escaner PLP server :${PORT}`));
