import { upsertScan, getAllScans, deleteScan, clearAllScans, getCount, putCatalog, lookupProduct, getCatalogCount } from './db.js';
import { startScanner, stopScanner } from './scanner.js';
import { exportTXT, exportCSV } from './export.js';

// ── State ──────────────────────────────────────────────────────────────────
let state = 'idle';

function setState(s) {
  state = s;
  document.body.dataset.state = s;
}

// ── Elements ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const video          = $('video');
const headerCount    = $('header-count');
const lastScanBadge  = $('last-scan');

const btnStart       = $('btn-start');
const btnContinue    = $('btn-continue');
const continueCount  = $('continue-count');

const scanCountLabel = $('scan-count-label');
const btnToReview    = $('btn-to-review');
const scanListScan   = $('scan-list-scanning');
const manualInput    = $('manual-input');
const btnManualAdd   = $('btn-manual-add');
const btnStop        = $('btn-stop');
const btnExportScan  = $('btn-export-scanning');

const reviewCountLabel = $('review-count-label');
const scanListReview = $('scan-list-review');
const btnResume      = $('btn-resume');
const btnExportCsv   = $('btn-export-csv');
const btnExportTxt   = $('btn-export-txt');
const btnNewSession  = $('btn-new-session');

const exportFilename = $('export-filename');
const btnExportBack  = $('btn-export-back');
const btnExportAlsoCsv = $('btn-export-also-csv');

const cameraErrorOverlay = $('camera-error-overlay');
const btnDismissError    = $('btn-dismiss-error');

const bacFileInput   = $('bac-file-input');
const bacFilename    = $('bac-filename');
const btnGenerarBac  = $('btn-generar-bac');
const bacStatus      = $('bac-status');

const catalogFileInput  = $('catalog-file-input');
const catalogStatus     = $('catalog-status');
const btnCatalogLoad    = $('btn-catalog-load');

let selectedBacFile = null;

// ── Rendering ──────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatPrecio(n) {
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function scanItemHTML(scan) {
  const countClass = scan.count > 1 ? 'scan-count highlight' : 'scan-count';
  const nombreHTML = scan.nombre ? `<span class="scan-nombre">${esc(scan.nombre)}</span>` : '';
  const precioHTML = scan.precio ? `<span class="scan-precio">$${formatPrecio(scan.precio)}</span>` : '';
  return `
    <li class="scan-item" data-ean="${scan.ean}">
      <div class="scan-info">
        <span class="scan-ean">${scan.ean}</span>
        ${nombreHTML}
      </div>
      ${precioHTML}
      <span class="${countClass}">&times;${scan.count}</span>
      <button class="scan-delete" data-ean="${scan.ean}" aria-label="Eliminar ${scan.ean}">&times;</button>
    </li>`;
}

function emptyState(msg) {
  return `<li class="empty-state">${msg}</li>`;
}

function renderList(listEl, scans) {
  if (!scans.length) {
    listEl.innerHTML = emptyState('Todavia no se escaneo ningun producto');
    return;
  }
  listEl.innerHTML = scans.map(scanItemHTML).join('');
}

async function refreshUI() {
  const scans = await getAllScans();
  const count = scans.length;

  headerCount.textContent = count > 0 ? count : '';
  scanCountLabel.textContent = `${count} producto${count !== 1 ? 's' : ''}`;
  reviewCountLabel.textContent = `${count} producto${count !== 1 ? 's' : ''} escaneado${count !== 1 ? 's' : ''}`;

  if (state === 'scanning') renderList(scanListScan, scans);
  if (state === 'review')   renderList(scanListReview, scans);

  return scans;
}

// ── Last-scan badge ────────────────────────────────────────────────────────
let badgeTimeout = null;
function showLastScan(ean, nombre) {
  lastScanBadge.textContent = nombre ? nombre.slice(0, 32) : ean;
  lastScanBadge.hidden = false;
  clearTimeout(badgeTimeout);
  badgeTimeout = setTimeout(() => { lastScanBadge.hidden = true; }, 1800);
}

// ── Scanner callbacks ──────────────────────────────────────────────────────
async function onScan(ean) {
  const product = await lookupProduct(ean);
  await upsertScan(ean, product);
  showLastScan(ean, product?.nombre);
  await refreshUI();
}

function onCameraError(err) {
  console.error('Camera error:', err);
  cameraErrorOverlay.hidden = false;
}

// ── Navigation ─────────────────────────────────────────────────────────────
async function goScanning(fresh) {
  if (fresh) await clearAllScans();
  setState('scanning');
  await refreshUI();
  await startScanner(video, onScan, onCameraError);
}

async function goReview() {
  stopScanner();
  setState('review');
  await refreshUI();
}

async function goExport(filename) {
  setState('export');
  exportFilename.textContent = filename;
  btnExportAlsoCsv.hidden = false;
}

async function goIdle() {
  const count = await getCount();
  if (count > 0) {
    btnContinue.hidden = false;
    continueCount.textContent = count;
  } else {
    btnContinue.hidden = true;
  }
  setState('idle');
  headerCount.textContent = count > 0 ? count : '';

  const catCount = await getCatalogCount();
  if (catCount > 0) {
    catalogStatus.textContent = `Catalogo cargado: ${catCount.toLocaleString('es-AR')} productos`;
    catalogStatus.className = 'catalog-status ok';
  }
}

// ── Delete handler (delegated) ─────────────────────────────────────────────
async function handleDelete(e) {
  const btn = e.target.closest('.scan-delete');
  if (!btn) return;
  const ean = btn.dataset.ean;
  await deleteScan(ean);
  btn.closest('.scan-item').remove();
  await refreshUI();
}

scanListScan.addEventListener('click', handleDelete);
scanListReview.addEventListener('click', handleDelete);

// ── Manual entry ───────────────────────────────────────────────────────────
async function addManual() {
  const val = manualInput.value.trim().replace(/\D/g, '');
  if (val.length < 8) return;
  manualInput.value = '';
  const product = await lookupProduct(val);
  await upsertScan(val, product);
  showLastScan(val, product?.nombre);
  await refreshUI();
}

btnManualAdd.addEventListener('click', addManual);
manualInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addManual();
});

// ── Button wiring ──────────────────────────────────────────────────────────
btnStart.addEventListener('click', () => goScanning(true));

btnContinue.addEventListener('click', () => goScanning(false));

btnStop.addEventListener('click', goReview);

btnToReview.addEventListener('click', goReview);

btnResume.addEventListener('click', async () => {
  setState('scanning');
  await refreshUI();
  await startScanner(video, onScan, onCameraError);
});

btnExportScan.addEventListener('click', async () => {
  const scans = await getAllScans();
  if (!scans.length) return;
  const filename = exportTXT(scans);
  await goExport(filename);
  stopScanner();
});

btnExportTxt.addEventListener('click', async () => {
  const scans = await getAllScans();
  if (!scans.length) return;
  const filename = exportTXT(scans);
  await goExport(filename);
});

btnExportCsv.addEventListener('click', async () => {
  const scans = await getAllScans();
  if (!scans.length) return;
  const filename = exportCSV(scans);
  await goExport(filename);
  btnExportAlsoCsv.hidden = true; // already CSV, don't offer again
});

btnExportBack.addEventListener('click', () => {
  setState('review');
  refreshUI();
});

btnExportAlsoCsv.addEventListener('click', async () => {
  const scans = await getAllScans();
  exportCSV(scans);
  btnExportAlsoCsv.hidden = true;
});

btnNewSession.addEventListener('click', async () => {
  const ok = window.confirm('Borrar todos los productos escaneados y comenzar de cero?');
  if (!ok) return;
  await clearAllScans();
  goIdle();
});

btnDismissError.addEventListener('click', () => {
  cameraErrorOverlay.hidden = true;
});

// ── Catalogo ───────────────────────────────────────────────────────────────
btnCatalogLoad.addEventListener('click', () => {
  catalogFileInput.value = '';
  catalogFileInput.click();
});

catalogFileInput.addEventListener('change', async () => {
  const file = catalogFileInput.files[0];
  if (!file) return;
  catalogStatus.textContent = 'Cargando catalogo...';
  catalogStatus.className = 'catalog-status loading';
  btnCatalogLoad.disabled = true;
  try {
    const { extractFromFile } = await import('./vendor/catalog.min.js');
    const products = await extractFromFile(file);
    await putCatalog(products);
    catalogStatus.textContent = `Catalogo cargado: ${products.length.toLocaleString('es-AR')} productos`;
    catalogStatus.className = 'catalog-status ok';
  } catch (err) {
    console.error('Catalog load error:', err);
    catalogStatus.textContent = `Error: ${err.message}`;
    catalogStatus.className = 'catalog-status err';
  } finally {
    btnCatalogLoad.disabled = false;
  }
});

// ── Generar .bac ───────────────────────────────────────────────────────────
bacFileInput.addEventListener('change', () => {
  const file = bacFileInput.files[0];
  if (!file) return;
  selectedBacFile = file;
  bacFilename.textContent = file.name;
  btnGenerarBac.disabled = false;
  bacStatus.textContent = '';
  bacStatus.className = 'bac-hint';
});

btnGenerarBac.addEventListener('click', async () => {
  if (!selectedBacFile) return;
  const scans = await getAllScans();
  if (!scans.length) {
    bacStatus.textContent = 'No hay productos escaneados.';
    bacStatus.className = 'bac-hint err';
    return;
  }

  btnGenerarBac.disabled = true;
  btnGenerarBac.textContent = 'Generando...';
  bacStatus.textContent = `Enviando ${scans.length} productos al servidor...`;
  bacStatus.className = 'bac-hint';

  try {
    const eans = scans.map(s => s.ean);
    const formData = new FormData();
    formData.append('bac', selectedBacFile, selectedBacFile.name);
    formData.append('eans', JSON.stringify(eans));

    const resp = await fetch('/api/generar-bac', { method: 'POST', body: formData });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || resp.statusText);
    }

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'novedades_filtradas.bac';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    bacStatus.textContent = `Listo. Descargado: novedades_filtradas.bac (${scans.length} productos)`;
    bacStatus.className = 'bac-hint ok';
  } catch (err) {
    bacStatus.textContent = `Error: ${err.message}`;
    bacStatus.className = 'bac-hint err';
  } finally {
    btnGenerarBac.disabled = false;
    btnGenerarBac.textContent = 'Generar .bac filtrado';
  }
});

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  await goIdle();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  }
}

init();
