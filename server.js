const express = require('express');
const multer = require('multer');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

  try {
    const eans = JSON.parse(req.body.eans);

    // Build numeric set (ARTIC_CEAN stored as double, no leading zeros)
    const numericEans = eans
      .map(e => String(Math.round(Number(String(e).trim()))))
      .filter(e => e && e !== 'NaN');
    const numericSet = [...new Set(numericEans)];

    // Build string set (Código de Barras stored as text, may have leading zeros)
    const stringEans = eans.map(e => String(e).trim());
    const stringSet = [...new Set([...stringEans, ...numericEans])];

    fs.writeFileSync(srcPath, req.file.buffer);

    // Start from a copy of the original — no mdb-create needed
    fs.copyFileSync(srcPath, outPath);

    // DELETE from PLURED: keep only scanned EANs (numeric)
    if (numericSet.length > 0) {
      const notIn = numericSet.join(',');
      const sql = `DELETE FROM PLURED WHERE ARTIC_CEAN NOT IN (${notIn});\n`;
      const r = spawnSync('mdb-sql', [outPath], { input: sql, encoding: 'utf8' });
      console.log('DELETE PLURED:', r.status, r.stderr?.trim() || '');
    }

    // DELETE from ProductosPen: keep only scanned EANs (string)
    if (stringSet.length > 0) {
      const notIn = stringSet.map(e => `'${e.replace(/'/g, "''")}'`).join(',');
      const sql = `DELETE FROM [ProductosPen] WHERE [Codigo de Barras] NOT IN (${notIn});\n`;
      const r = spawnSync('mdb-sql', [outPath], { input: sql, encoding: 'utf8' });
      console.log('DELETE ProductosPen:', r.status, r.stderr?.trim() || '');
    }

    const output = fs.readFileSync(outPath);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="novedades_filtradas.bac"');
    res.send(output);

  } catch (err) {
    console.error('/api/generar-bac error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    try { fs.unlinkSync(srcPath); } catch (_) {}
    try { fs.unlinkSync(outPath); } catch (_) {}
  }
});

app.listen(PORT, () => console.log(`Escaner PLP server :${PORT}`));
