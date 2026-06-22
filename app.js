import { upsertScan, getAllScans, deleteScan, clearAllScans, getCount } from './db.js';
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

// ── Rendering ──────────────────────────────────────────────────────────────
function scanItemHTML(scan) {
  const countClass = scan.count > 1 ? 'scan-count highlight' : 'scan-count';
  return `
    <li class="scan-item" data-ean="${scan.ean}">
      <span class="scan-ean">${scan.ean}</span>
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
function showLastScan(ean) {
  lastScanBadge.textContent = ean;
  lastScanBadge.hidden = false;
  clearTimeout(badgeTimeout);
  badgeTimeout = setTimeout(() => { lastScanBadge.hidden = true; }, 1800);
}

// ── Scanner callbacks ──────────────────────────────────────────────────────
async function onScan(ean) {
  await upsertScan(ean);
  showLastScan(ean);
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
  await upsertScan(val);
  showLastScan(val);
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
