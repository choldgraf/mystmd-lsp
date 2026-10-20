// Bundles the server into one file, which starts several times faster than the TypeScript source (it answers `initialize` sooner).
import { build } from 'esbuild';
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

await build({
  entryPoints: [fileURLToPath(new URL('src/server.ts', import.meta.url))],
  outfile: 'dist/server.cjs',
  alias: { punycode: 'punycode/punycode.js' }, // markdown-it requires `punycode`, so use the npm package rather than Node's deprecated builtin
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  logLevel: 'warning',
});
// So the npm page isn't blank. npm resolves the README's relative links from the repository root, so package.json has no `directory`.
copyFileSync(new URL('../../README.md', import.meta.url), new URL('README.md', import.meta.url));
copyFileSync(new URL('../../LICENSE', import.meta.url), new URL('LICENSE', import.meta.url));
