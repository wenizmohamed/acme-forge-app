import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const pairs = [
  ['static/main-ui/index.html', 'index.html'],
  ['static/main-ui/forge-bridge-adapter.js', 'forge-bridge-adapter.js'],
  ['static/main-ui/support.js', 'support.js']
];

for (const [srcRel, dstRel] of pairs) {
  const src = path.join(root, srcRel);
  const dst = path.join(root, dstRel);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing source UI file: ${srcRel}`);
  }
  fs.copyFileSync(src, dst);
  console.log(`Synced ${srcRel} -> ${dstRel}`);
}
