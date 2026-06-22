import { BrowserMultiFormatReader, NotFoundException } from './vendor/zxing.min.js';

let reader = null;
let controls = null;
const cooldown = new Map(); // ean → timestamp of last scan
const COOLDOWN_MS = 2000;

let _audioCtx = null;

function beep() {
  try {
    if (!_audioCtx) _audioCtx = new AudioContext();
    const osc = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.connect(gain);
    gain.connect(_audioCtx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, _audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + 0.15);
    osc.start(_audioCtx.currentTime);
    osc.stop(_audioCtx.currentTime + 0.15);
  } catch (_) {
    // audio not supported or blocked — silently skip
  }
}

export async function startScanner(videoEl, onScan, onError) {
  try {
    reader = new BrowserMultiFormatReader();
    controls = await reader.decodeFromVideoDevice(undefined, videoEl, (result, err) => {
      if (result) {
        const ean = result.getText();
        const now = Date.now();
        const last = cooldown.get(ean) || 0;
        if (now - last >= COOLDOWN_MS) {
          cooldown.set(ean, now);
          beep();
          onScan(ean);
        }
      } else if (err) {
        const name = (err.constructor && err.constructor.name) || err.name || '';
        if (!name.includes('NotFoundException') && !(err instanceof NotFoundException)) {
          onError(err);
        }
      }
    });
  } catch (err) {
    onError(err);
  }
}

export function stopScanner() {
  if (controls) {
    controls.stop();
    controls = null;
  }
  cooldown.clear();
}
