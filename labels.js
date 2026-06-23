function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Try to split name into main + unit/size (e.g. "LECHE ENTERA X 1 LT" → ["LECHE ENTERA", "X 1 LT"])
function splitNombre(nombre) {
  const m = nombre.match(/^(.+?)\s+(X\s+[\d,.]+\s*(?:ML|GR|KG|LT|CC|G|L|KGS|GRS)\b.*)$/i);
  if (m) return [m[1].trim(), m[2].trim().toUpperCase()];
  return [nombre, null];
}

function priceFontSize(precio) {
  const len = Number(precio).toFixed(2).length;
  if (len <= 6)  return '36pt';
  if (len <= 8)  return '30pt';
  if (len <= 10) return '26pt';
  return '22pt';
}

function makeLabelHTML(scan, dateStr) {
  const priceStr = escHtml(Number(scan.precio).toFixed(2));
  const fontSize = priceFontSize(scan.precio);
  const rawName = (scan.nombre || '').toUpperCase() || scan.ean;
  const [mainName, subName] = splitNombre(rawName);

  return `<div class="label">
  <div class="lh">
    <span class="lname">${escHtml(mainName)}</span>${subName ? `\n    <span class="lsub">${escHtml(subName)}</span>` : ''}
  </div>
  <div class="lp">
    <span class="price" style="font-size:${fontSize}">${priceStr}</span>
  </div>
  <div class="lf">
    <span class="lean">${scan.ean}</span>
    <span class="ldate">${dateStr}</span>
  </div>
</div>`;
}

export function printLabels(scans) {
  const items = scans.filter(s => s.precio != null);

  if (!items.length) {
    alert('Sin precios para imprimir.\nCargá el catálogo (BACK.MDB.BAC) desde la pantalla de inicio primero.');
    return;
  }

  const today = new Date();
  const dateStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

  const labelsHTML = items.map(s => makeLabelHTML(s, dateStr)).join('\n');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Etiquetas</title>
<style>
@page { size: A4 portrait; margin: 8mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #000; }

.grid {
  display: grid;
  grid-template-columns: repeat(3, 60mm);
  gap: 2.5mm;
}

/* ── Label container ── */
.label {
  width: 60mm;
  height: 30mm;
  border: 0.5pt solid #000;
  display: flex;
  flex-direction: column;
  padding: 1.5mm 2mm 1mm;
  overflow: hidden;
  page-break-inside: avoid;
  break-inside: avoid;
}

/* ── Header: product name ── */
.lh {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  line-height: 1.2;
}
.lname {
  font-size: 6.5pt;
  font-weight: 900;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.1pt;
}
.lsub {
  font-size: 6pt;
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
}

/* ── Price ── */
.lp {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.price {
  font-family: 'Arial Black', Arial, sans-serif;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
  text-align: center;
  letter-spacing: -0.5pt;
}

/* ── Footer: EAN + date ── */
.lf {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-shrink: 0;
  margin-top: 0.5mm;
}
.lean, .ldate {
  font-family: 'Courier New', Courier, monospace;
  font-size: 3.8pt;
  line-height: 1;
}

@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
</head>
<body>
<div class="grid">
${labelsHTML}
</div>
<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('El navegador bloqueó la ventana emergente.\nPermití popups para este sitio e intentá de nuevo.');
    return;
  }
  win.document.write(html);
  win.document.close();
}
