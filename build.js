const esbuild = require('esbuild');
const fs = require('fs');

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

// Bundle mdb-reader (reads Access MDB files in the browser)
esbuild.buildSync({
  stdin: {
    contents: `export { default as MDBReader } from 'mdb-reader';`,
    resolveDir: __dirname,
  },
  bundle: true,
  minify: true,
  format: 'esm',
  outfile: 'vendor/mdb-reader.min.js',
  platform: 'browser',
  alias: {
    buffer: 'buffer',
    events: 'events',
    stream: 'readable-stream',
    process: 'process/browser',
  },
});
console.log('Built: vendor/mdb-reader.min.js');
