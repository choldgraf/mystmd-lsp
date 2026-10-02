import { spawn } from 'node:child_process';
import { createServer, type AddressInfo } from 'node:net';
import { createInterface } from 'node:readline';

/** Why `ready` rejects when mystmd isn't installed. */
export const mystmdMissing = 'mystmd not found';

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
 * We pick the port, so `url` is known before the first build; `ready` resolves once it's serving.
 * `ready` rejects with the message `mystmdMissing` if mystmd isn't installed.
 * `exited` rejects if mystmd dies.
 * mystmd's output goes to `log`, a line at a time.
 */
export async function startMyst(root: string, log = console.log) {
  const port = await freePort();
  // Pin HOST so it doesn't bind IPv6-only `localhost`, which proxies like code-server's miss.
  const env = { ...process.env, HOST: '127.0.0.1' };
  const args = ['start', '--headless', '--server-port', String(port)];
  const child = spawn(process.env.MYST_BIN ?? 'myst', args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  process.on('exit', () => child.kill());

  // Rejects if mystmd dies, even after `ready` has resolved.
  const exited = new Promise<never>((_, reject) => child.on('exit', (code) => reject(new Error(`myst exited with code ${code}`))));
  exited.catch(() => {});

  const ready = new Promise<void>((resolve, reject) => {
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') return reject(err);
      log('mystmd not found; built preview disabled (install mystmd or set MYST_BIN)');
      reject(new Error(mystmdMissing));
    });
    exited.catch(reject);
    for (const stream of [child.stdout, child.stderr]) {
      createInterface({ input: stream }).on('line', (line) => {
        log(`[myst] ${line}`);
        if (line.includes('Content server started')) resolve();
      });
    }
  });
  ready.catch(() => {}); // callers that don't wait for mystmd mustn't crash when it's missing
  return { url: `http://127.0.0.1:${port}`, ready, exited };
}
