// `npm run docs:videos`: download the demo video into docs/videos/, unless it's already there.
// It's an attachment on a GitHub issue, so it stays out of git.
// mystmd can't show a remote video in a figure yet: https://github.com/jupyter-book/mystmd/issues/3100
// Delete the video to download it again.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const videos = {
  'vscode.mp4': 'https://github.com/user-attachments/assets/a26eeda2-b251-4a7d-82ad-b5f20c3609b8',
};

for (const [name, url] of Object.entries(videos)) {
  const file = join(import.meta.dirname, name);
  if (existsSync(file)) continue;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`couldn't download ${name}: ${res.status} from ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}
