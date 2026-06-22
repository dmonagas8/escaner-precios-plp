function dateStamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function formatAR(ts) {
  return new Date(ts).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function exportTXT(scans) {
  const lines = scans.map(s => s.ean).join('\r\n');
  const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
  const filename = `escaneo_${dateStamp()}.txt`;
  download(blob, filename);
  return filename;
}

export function exportCSV(scans) {
  const header = 'codigo_barra,cantidad,primer_escaneo,ultimo_escaneo\r\n';
  const rows = scans
    .map(s => `${s.ean},${s.count},${formatAR(s.firstScanned)},${formatAR(s.lastScanned)}`)
    .join('\r\n');
  // BOM prefix so Excel opens with correct encoding
  const blob = new Blob(['﻿' + header + rows], { type: 'text/csv;charset=utf-8' });
  const filename = `escaneo_${dateStamp()}.csv`;
  download(blob, filename);
  return filename;
}
