// Bundles the server into one file, which starts several times faster than the TypeScript source (it answers `initialize` sooner).
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

await build({
  entryPoints: [fileURLToPath(new URL('src/server.ts', import.meta.url))],
  outfile: 'dist/server.cjs',
  alias: { punycode: 'punycode/punycode.js' }, // markdown-it requires `punycode`; use the npm package, not Node's deprecated builtin
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  sourcemap: true,
  logLevel: 'warning',
});
