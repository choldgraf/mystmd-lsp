import { spawn } from 'node:child_process';
import { createServer, type AddressInfo } from 'node:net';
import { createInterface } from 'node:readline';

// ponytail: MyST Author (myst-author `packages/mystmd/src/start.ts`) has a copy of this that can also serve the site; port fixes between the two. A launcher exported by mystmd would replace both.

/** Why `exited` rejects when mystmd isn't installed. */
export const mystmdMissing = 'mystmd not found (install it, or set MYST_BIN)';

/** A port that's free on 127.0.0.1 right now. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer().on('error', reject).listen(0, '127.0.0.1', () => {
      const { port } = s.address() as AddressInfo;
      s.close(() => resolve(port));
    });
  });
}

/**
 * Run `myst start --headless` in `root`: the content server the language server reads from, without the site.
 * We pick the port, so `url` is known before the first build.
 * `exited` rejects if mystmd dies, with the message `mystmdMissing` if it isn't installed.
 * mystmd's output goes to the server log, a line at a time.
 */
export async function startMyst(root: string) {
  const port = await freePort();
  // Pin HOST so it doesn't bind IPv6-only `localhost`, which proxies like code-server's miss.
  const env = { ...process.env, HOST: '127.0.0.1' };
  const args = ['start', '--headless', '--server-port', String(port)];
  const child = spawn(process.env.MYST_BIN ?? 'myst', args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  process.on('exit', () => child.kill());
  for (const stream of [child.stdout, child.stderr]) createInterface({ input: stream }).on('line', (line) => console.log(`[myst] ${line}`));

  const exited = new Promise<never>((_, reject) => {
    child.on('error', (err: NodeJS.ErrnoException) => reject(err.code === 'ENOENT' ? new Error(mystmdMissing) : err));
    child.on('exit', (code) => reject(new Error(`myst exited with code ${code}`)));
  });
  exited.catch(() => {}); // callers that don't wait for mystmd mustn't crash when it's missing
  return { url: `http://127.0.0.1:${port}`, exited };
}
