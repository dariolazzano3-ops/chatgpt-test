// Baut public/index.html aus src/game.html.
//   node tools/build.mjs --face=neutral    erfundenes Zombie-Gesicht (Standard für die öffentliche Seite)
//   node tools/build.mjs --face=original   Gesicht aus dem Foto (braucht src/face-original.png; nur mit Einwilligung der abgebildeten Person veröffentlichen)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv.find(a => a.startsWith('--face=')); const face = arg ? arg.slice(7) : 'neutral';
if (!['neutral', 'original'].includes(face)) { console.error('--face=neutral oder --face=original'); process.exit(1); }
let html = fs.readFileSync(path.join(root, 'src', 'game.html'), 'utf8').replace('/*@test-hooks*/', '');
const re = /const faceTex=new THREE\.TextureLoader\(\)\.load\('data:image\/png;base64,[A-Za-z0-9+/=]+'\)/;
if (!re.test(html)) { console.error('Gesichtstextur nicht gefunden'); process.exit(1); }
// src/game.html enthält bereits das neutrale Gesicht. Das Original liegt nur im privaten Paket (src/face-original.png, nicht im Repo).
const facePng = face === 'neutral' ? 'face-neutral.png' : 'face-original.png';
if (!fs.existsSync(path.join(root, 'src', facePng))) { console.error('src/' + facePng + ' fehlt (das Original ist absichtlich nicht im öffentlichen Repo).'); process.exit(1); }
const b64 = fs.readFileSync(path.join(root, 'src', facePng)).toString('base64');
html = html.replace(re, `const faceTex=new THREE.TextureLoader().load('data:image/png;base64,${b64}')`);
for (const f of ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png']) if (!fs.existsSync(path.join(root, 'public', f))) { console.error('public/' + f + ' fehlt (python3 tools/icons.py)'); process.exit(1); }
if (!fs.existsSync(path.join(root, 'public', 'vendor', 'three.min.js'))) { console.error('public/vendor/three.min.js fehlt'); process.exit(1); }
const head = '<!doctype html>\n<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  // PWA / Home-Bildschirm: Manifest, Icons, iOS-Angaben. Bewusst KEIN Service Worker (kein veraltetes Caching nach Updates).
  + '<title>Ziegenalarm</title><link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#1a1028">'
  + '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">'
  + '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Ziegenalarm">'
  + '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png"><link rel="icon" type="image/png" href="icons/favicon-64.png">'
  + '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html,body{background:#1a1028}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>\n';
fs.writeFileSync(path.join(root, 'public', 'index.html'), head + html + '\n</body></html>\n');
fs.writeFileSync(path.join(root, 'public', 'build.txt'), `face=${face}\nbuilt=${new Date().toISOString()}\n`);
console.log(`public/index.html gebaut (Gesicht: ${face})`);
