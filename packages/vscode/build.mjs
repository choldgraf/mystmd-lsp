// VS Code runs extensions on its own Node without TypeScript support, so bundle into dist/, with the server bundle beside it.
import { build } from 'esbuild';
import { copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';

await build({ entryPoints: ['src/extension.ts'], outfile: 'dist/extension.js', bundle: true, platform: 'node', format: 'cjs', external: ['vscode'], logLevel: 'warning' });
copyFileSync(createRequire(import.meta.url).resolve('mystmd-lsp/dist/server.cjs'), 'dist/server.cjs');
copyFileSync('../../LICENSE', 'LICENSE'); // vsce wants a license in the package
