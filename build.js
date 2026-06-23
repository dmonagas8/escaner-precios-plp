const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

fs.mkdirSync('vendor', { recursive: true });

// Bundle ZXing barcode scanner
esbuild.buildSync({
  stdin: {
    contents: `
      export { BrowserMultiFormatReader } from '@zxing/browser';
      export { NotFoundException } from '@zxing/library';
    `,
    resolveDir: __dirname,
  },
  bundle: true,
  minify: true,
  format: 'esm',
  outfile: 'vendor/zxing.min.js',
  platform: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' },
});
console.log('Built: vendor/zxing.min.js');

// Bundle idb (IndexedDB helper)
esbuild.buildSync({
  stdin: {
    contents: `export { openDB } from 'idb';`,
    resolveDir: __dirname,
  },
  bundle: true,
  minify: true,
  format: 'esm',
  outfile: 'vendor/idb.min.js',
  platform: 'browser',
});
console.log('Built: vendor/idb.min.js');

// Bundle catalog.js + mdb-reader + all Node polyfills into one browser module
esbuild.buildSync({
  entryPoints: ['catalog.js'],
  bundle: true,
  minify: true,
  format: 'esm',
  outfile: 'vendor/catalog.min.js',
  platform: 'browser',
  alias: {
    buffer: 'buffer',
    events: 'events',
    stream: 'readable-stream',
  },
  inject: [path.join(__dirname, 'process-inject.js')],
});
console.log('Built: vendor/catalog.min.js');
