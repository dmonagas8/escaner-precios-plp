function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function priceFontSize(precio) {
  const str = '$' + Number(precio).toFixed(2);
  if (str.length <= 7)  return '24pt'; // $999.99
  if (str.length <= 9)  return '20pt'; // $99999.99
  if (str.length <= 11) return '17pt'; // $9999999.99
  return '14pt';
}

function makeLabelHTML(scan, dateStr) {
  const price = '$' + Number(scan.precio).toFixed(2);
  const nombre = escHtml((scan.nombre || scan.ean).toUpperCase());
  const fontSize = priceFontSize(scan.precio);

  return `<div class="label">
  <div class="ll">
    <span class="ean">${scan.ean}</span>
    <span class="ldate">${dateStr}</span>
  </div>
  <div class="lc">
    <div class="price" style="font-size:${fontSize}">${price}</div>
  </div>
  <div class="lr">
    <span class="nombre">${nombre}</span>
  </div>
</div>`;
}

export function printLabels(scans) {
  const items = scans.filter(s => s.precio != null);

  if (!items.length) {
    alert('Sin precios para imprimir. Cargá el catálogo primero desde la pantalla de inicio.');
    return;
  }

  const today = new Date();
  const dateStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

  const labelsHTML = items.map(s => makeLabelHTML(s, dateStr)).join('\n');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Etiquetas Superprecios La Plata</title>
<style>
@page { size: A4 portrait; margin: 8mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #000; }

.grid {
  display: grid;
  grid-template-columns: repeat(3, 60mm);
  gap: 3mm;
}

.label {
  width: 60mm;
  height: 30mm;
  border: 0.5pt solid #000;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  page-break-inside: avoid;
  break-inside: avoid;
}

/* Left strip: EAN + date */
.ll {
  width: 8mm;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 1mm 0.5mm;
  border-right: 0.3pt solid #bbb;
}
.ean {
  font-family: 'Courier New', Courier, monospace;
  font-size: 4pt;
  line-height: 1;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  letter-spacing: 0.3pt;
}
.ldate {
  font-size: 3.5pt;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}

/* Center: price */
.lc {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1mm;
  overflow: hidden;
}
.price {
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
  text-align: center;
}

/* Right strip: product name */
.lr {
  width: 14mm;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1mm 0.5mm;
  border-left: 0.3pt solid #bbb;
}
.nombre {
  font-size: 5pt;
  font-weight: 700;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  text-align: center;
  text-transform: uppercase;
  line-height: 1.15;
  max-height: 27mm;
  overflow: hidden;
  word-break: break-word;
}

@media print {
  .grid { gap: 2mm; }
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
