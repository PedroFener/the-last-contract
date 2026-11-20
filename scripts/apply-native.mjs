#!/usr/bin/env node
/*
 * Aplica as partes nativas do THE LAST CONTRACT ao projeto Android gerado pelo Capacitor.
 * Idempotente. Uso: node scripts/apply-native.mjs   (depois de `npx cap add android`)
 *  1. MainActivity com tela cheia imersiva e tela sempre ligada
 *  2. Ícones (mipmap) e splash
 *  3. Orientação paisagem no AndroidManifest
 *  4. versionName/versionCode
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
const androidMain = path.join(root, 'android', 'app', 'src', 'main');
if (!fs.existsSync(androidMain)) { console.error('Pasta android/ não encontrada. Rode antes: npx cap add android'); process.exit(1); }

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

// 1. MainActivity
const javaDst = path.join(androidMain, 'java', ...config.appId.split('.'));
fs.mkdirSync(javaDst, { recursive: true });
fs.copyFileSync(path.join(root, 'native', 'android', 'java', 'MainActivity.java'), path.join(javaDst, 'MainActivity.java'));
console.log('java  -> MainActivity.java');

// 2. Ícones e splash
const resDst = path.join(androidMain, 'res');
// ícone adaptativo do template usa a arte do Capacitor: removemos para valerem os PNGs do jogo
fs.rmSync(path.join(resDst, 'mipmap-anydpi-v26'), { recursive: true, force: true });
for (const stale of ['drawable-v24/ic_launcher_foreground.xml', 'drawable/ic_launcher_background.xml']) {
  fs.rmSync(path.join(resDst, stale), { force: true });
}
for (const d of fs.readdirSync(resDst)) {
  if (d.startsWith('mipmap-')) for (const f of fs.readdirSync(path.join(resDst, d))) {
    if (f.startsWith('ic_launcher_foreground') || f.startsWith('ic_launcher_background')) fs.rmSync(path.join(resDst, d, f));
  }
}
copyDir(path.join(root, 'native', 'android', 'res'), resDst);
const splash = path.join(root, 'native', 'android', 'splash', 'splash.png');
let n = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else if (e.name === 'splash.png') { fs.copyFileSync(splash, p); n++; }
  }
})(resDst);
console.log(`res   -> ícones copiados, splash em ${n} arquivo(s)`);

// 3. Manifesto: paisagem
const mp = path.join(androidMain, 'AndroidManifest.xml');
let m = fs.readFileSync(mp, 'utf8');
if (!m.includes('android:screenOrientation')) {
  m = m.replace(/<activity(\s)/, '<activity android:screenOrientation="sensorLandscape"$1');
  fs.writeFileSync(mp, m);
  console.log('manifest -> paisagem');
}

// 4. Versão
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const gp = path.join(root, 'android', 'app', 'build.gradle');
if (fs.existsSync(gp)) {
  const code = parseInt(process.env.TLC_VERSION_CODE || '1', 10);
  let g = fs.readFileSync(gp, 'utf8');
  g = g.replace(/versionCode\s+\d+/, `versionCode ${code}`).replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`);
  fs.writeFileSync(gp, g);
  console.log(`gradle -> versionName ${pkg.version}, versionCode ${code}`);
}
console.log('OK: partes nativas aplicadas.');
