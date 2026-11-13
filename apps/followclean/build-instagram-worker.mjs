import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const html = await readFile(join(root, 'index.html'), 'utf8');
const template = await readFile(join(root, 'worker.instagram-template.mjs'), 'utf8');
const marker = 'const FOLLOWCLEAN_HTML = __FOLLOWCLEAN_HTML__;';
if (template.split(marker).length !== 2) throw new Error('Unexpected Worker HTML placeholder count');
if (!html.includes('id="fc-live-panel"')) throw new Error('Instagram live panel missing');
const bundled = template.replace(marker, 'const FOLLOWCLEAN_HTML = ' + JSON.stringify(html) + ';');
const out = join(root, 'dist', 'worker.mjs');
await mkdir(dirname(out), { recursive: true });
await writeFile(out, bundled, 'utf8');
console.log('FollowClean Worker ready: ' + out + ' (' + bundled.length + ' chars)');
