// THE LAST CONTRACT — sprites em pixel art gerados por código (spritesheets em cache)
// Todos os personagens, armas e itens são desenhados pixel a pixel na inicialização/sob demanda.
'use strict';

const Sprites = (() => {
  const cache = new Map();
  const silCache = new WeakMap();

  // ---------- primitivas de pixel ----------
  function P(x, c, px, py) { x.fillStyle = c; x.fillRect(px | 0, py | 0, 1, 1); }
  function R(x, c, px, py, w, h) { x.fillStyle = c; x.fillRect(px | 0, py | 0, w | 0, h | 0); }
  function E(x, c, cx, cy, rx, ry) {
    x.fillStyle = c;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
        const dx = (xx + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) x.fillRect(xx, y, 1, 1);
      }
    }
  }
  function L(x, c, x0, y0, x1, y1, th) {
    th = th || 1;
    const dx = x1 - x0, dy = y1 - y0;
    const n = Math.max(Math.abs(dx), Math.abs(dy), 1);
    x.fillStyle = c;
    const o = Math.floor(th / 2);
    for (let i = 0; i <= n; i++) {
      const px = Math.round(x0 + dx * i / n), py = Math.round(y0 + dy * i / n);
      x.fillRect(px - o, py - o, th, th);
    }
  }

  // ---------- paletas ----------
  const PALS = {
    player: { suit: '#16161e', suit2: '#2c2c3a', shirt: '#ece8e0', tie: '#08080b', hair: '#2a1b12', hair2: '#4a3220', skin: '#d9a27c', pants: '#111117', shoe: '#040405', head: 'long', beard: true },
    grunt: { suit: '#4a5637', suit2: '#68764c', shirt: '#2a2a2a', hair: '#1b1410', hair2: '#33261c', skin: '#c58d66', pants: '#2c2d28', shoe: '#14120f', head: 'short' },
    shotgunner: { suit: '#7a2121', suit2: '#a5392d', shirt: '#151515', hair: '#0e0e0e', hair2: '#262626', skin: '#b07850', pants: '#202024', shoe: '#0d0d0d', head: 'short' },
    rifleman: { suit: '#343a41', suit2: '#4e5763', shirt: '#222', hair: '#1a1a1a', hair2: '#2e2e2e', skin: '#d0a07c', pants: '#24282c', shoe: '#0c0c0c', head: 'mask' },
    brute: { suit: '#d6d1c4', suit2: '#f2efe6', shirt: '#d6d1c4', hair: '#000', skin: '#8a5a3c', pants: '#2b3140', shoe: '#111', head: 'bald', bulky: true },
    elite: { suit: '#cfd0d8', suit2: '#f0f0f5', shirt: '#151515', tie: '#b0102a', hair: '#d6bd73', hair2: '#f0dc9a', skin: '#e0b08c', pants: '#b8b9c2', shoe: '#1a1a1a', head: 'short' },
    boss: { suit: '#5e0e1c', suit2: '#8c2232', shirt: '#0d0d0d', tie: '#d4af37', hair: '#cfcfcf', hair2: '#ffffff', skin: '#d8a888', pants: '#3c0a14', shoe: '#050505', head: 'long', bulky: true, beard: true },
    // variações de tema
    club: { suit: '#3d1d63', suit2: '#5c2f8f', shirt: '#0f0f0f', hair: '#0c0c0c', hair2: '#e03aa0', skin: '#c08a64', pants: '#1c1428', shoe: '#0a0a0a', head: 'short' },
    clubBrute: { suit: '#141414', suit2: '#2a2a2a', shirt: '#141414', hair: '#000', skin: '#6e4630', pants: '#141414', shoe: '#000', head: 'bald', bulky: true },
    street: { suit: '#2b3b55', suit2: '#40577c', shirt: '#151515', hair: '#141414', hair2: '#2a2a2a', skin: '#a8724c', pants: '#1f2430', shoe: '#e8e8e8', head: 'hood' },
    hotel: { suit: '#1d2742', suit2: '#2f3d66', shirt: '#e0e0e0', tie: '#7a1020', hair: '#2b2018', hair2: '#463324', skin: '#d4a07a', pants: '#161d33', shoe: '#0a0a0a', head: 'short' },
  };

  // ---------- personagem (vista de cima, virado para +x) ----------
  const OUT = '#060608';
  function drawHead(x, p, hx, hy) {
    const head = p.head;
    E(x, OUT, hx, hy, 4, 4);
    if (head === 'long') {
      E(x, OUT, hx - 2.5, hy, 4.2, 4.6);
      E(x, p.hair, hx - 2.5, hy, 3.4, 3.8);
      E(x, p.hair, hx, hy, 3.2, 3.2);
      P(x, p.hair2, hx - 1, hy - 2); P(x, p.hair2, hx - 2, hy - 1); P(x, p.hair2, hx - 4, hy + 1); P(x, p.hair2, hx - 4, hy - 2);
      P(x, p.skin, hx + 2, hy - 1); P(x, p.skin, hx + 2, hy); P(x, p.skin, hx + 3, hy); P(x, p.skin, hx + 2, hy + 1);
      if (p.beard) { P(x, p.hair, hx + 3, hy + 1); P(x, p.hair, hx + 3, hy - 1); }
    } else if (head === 'short') {
      E(x, p.skin, hx, hy, 3.2, 3.2);
      E(x, p.hair, hx - 0.8, hy, 2.8, 3.1);
      P(x, p.hair2, hx - 1, hy - 1); P(x, p.hair2, hx, hy - 2);
      P(x, shade(p.skin, -0.2), hx + 2, hy + 2); P(x, shade(p.skin, -0.2), hx + 2, hy - 2);
    } else if (head === 'bald') {
      E(x, p.skin, hx, hy, 3.4, 3.4);
      E(x, shade(p.skin, -0.25), hx - 1.2, hy + 0.6, 2.2, 2.6);
      P(x, shade(p.skin, 0.3), hx, hy - 1); P(x, shade(p.skin, 0.3), hx + 1, hy - 1);
    } else if (head === 'mask') {
      E(x, '#1b1b1d', hx, hy, 3.3, 3.3);
      P(x, '#333338', hx - 1, hy - 1);
      P(x, p.skin, hx + 2, hy - 1); P(x, p.skin, hx + 2, hy + 1);
    } else if (head === 'hood') {
      E(x, p.suit, hx - 0.5, hy, 3.6, 3.6);
      E(x, shade(p.suit, -0.3), hx - 1.2, hy, 2.4, 2.8);
      P(x, p.skin, hx + 2, hy); P(x, p.skin, hx + 3, hy);
    }
  }
  function arm(x, p, sx, sy, hx, hy) {
    L(x, OUT, sx, sy, hx, hy, 3);
    L(x, p.suit, sx, sy, hx, hy, 2);
  }
  function hand(x, p, hx, hy) {
    R(x, OUT, hx - 1, hy - 1, 3, 3);
    R(x, p.skin, hx - 1, hy - 1, 2, 2);
  }
  function drawGun(x, w, gx, gy) {
    if (w === 'pistol') {
      R(x, OUT, gx - 1, gy - 1, 7, 4);
      R(x, '#2b2b30', gx, gy, 5, 2); R(x, '#5a5a64', gx, gy, 5, 1);
    } else if (w === 'shotgun') {
      R(x, OUT, gx - 6, gy - 1, 18, 4);
      R(x, '#6b4220', gx - 5, gy, 5, 2); R(x, '#8b5a2e', gx - 5, gy, 5, 1);
      R(x, '#2a2a2e', gx, gy, 11, 2); R(x, '#62626c', gx, gy, 11, 1);
      R(x, '#7b4c26', gx + 4, gy, 3, 2);
    } else if (w === 'rifle') {
      R(x, OUT, gx - 6, gy - 1, 19, 4);
      R(x, '#1d1d21', gx - 5, gy, 17, 2); R(x, '#4a4a54', gx - 5, gy, 17, 1);
      R(x, OUT, gx + 1, gy + 2, 3, 3); R(x, '#2a2a30', gx + 1, gy + 2, 2, 2);
      R(x, '#7a7a86', gx + 10, gy, 2, 1);
    } else if (w === 'knife') {
      R(x, OUT, gx - 1, gy - 1, 8, 3);
      R(x, '#3a2a1a', gx, gy, 2, 1); R(x, '#d8dce4', gx + 2, gy, 4, 1); P(x, '#ffffff', gx + 5, gy);
    } else if (w === 'pencil') {
      R(x, OUT, gx - 1, gy - 1, 9, 3);
      R(x, '#f2a8b8', gx, gy, 1, 1); R(x, '#b0b0b8', gx + 1, gy, 1, 1);
      R(x, '#f0c020', gx + 2, gy, 4, 1); R(x, '#e8d0a0', gx + 6, gy, 1, 1); P(x, '#202020', gx + 7, gy);
    } else if (w === 'bat') {
      L(x, OUT, gx - 1, gy, gx + 10, gy - 1, 4);
      L(x, '#8a6436', gx, gy, gx + 9, gy - 1, 2);
    }
  }

  function buildChar(palKey, weapon, pose) {
    const p = PALS[palKey] || PALS.grunt;
    const [c, x] = makeCanvas(32, 32);
    const bulky = p.bulky ? 1 : 0;
    const ry = 6 + bulky, rx = 3.6 + bulky * 0.6;
    const cx = 15, cy = 16;
    const sTop = [cx, cy - ry + 1], sBot = [cx, cy + ry - 1];
    let lh, rh, gun = null, gx = 0, gy = 0, gunAfter = true;
    const rec = pose === 'recoil' ? -2 : 0;
    const bash = pose === 'bash' ? 3 : 0;
    if (weapon === 'pistol') {
      lh = [22 + rec + bash, 15]; rh = [22 + rec + bash, 17]; gun = 'pistol'; gx = 23 + rec + bash; gy = 15;
    } else if (weapon === 'shotgun' || weapon === 'rifle') {
      rh = [21 + rec + bash, 19]; lh = [26 + rec + bash, 17]; gun = weapon; gx = 21 + rec + bash; gy = 17;
    } else if (weapon === 'knife' || weapon === 'pencil') {
      lh = [19, 10]; rh = [21, 21]; gun = weapon; gx = 22; gy = 21;
      if (pose === 'slash1') { rh = [25, 23]; gx = 26; gy = 23; }
      if (pose === 'slash2') { rh = [25, 11]; gx = 26; gy = 10; }
    } else if (weapon === 'bat') {
      lh = [20, 12]; rh = [21, 20]; gun = 'bat'; gx = 21; gy = 19;
      if (pose === 'slash1') { rh = [24, 24]; lh = [22, 22]; gx = 24; gy = 26; }
      if (pose === 'slash2') { rh = [25, 9]; lh = [23, 11]; gx = 25; gy = 8; }
    } else { // desarmado
      lh = [19, 11]; rh = [19, 21];
      if (pose === 'punch' || pose === 'bash' || pose === 'slash1') rh = [26, 18];
      if (pose === 'slash2') lh = [26, 14];
    }
    if (pose === 'reload' && gun && gun !== 'knife' && gun !== 'pencil') { lh = [17, 21]; rh = [rh[0] - 2, rh[1]]; gx -= 3; }
    arm(x, p, sTop[0], sTop[1], lh[0], lh[1]);
    arm(x, p, sBot[0], sBot[1], rh[0], rh[1]);
    // corpo / ombros
    E(x, OUT, cx, cy, rx + 1, ry + 1);
    E(x, p.suit, cx, cy, rx, ry);
    R(x, p.suit2, cx + 1, cy - ry + 2, 1, 3); R(x, p.suit2, cx + 1, cy + ry - 4, 1, 3);
    P(x, shade(p.suit, -0.35), cx - 3, cy - 2); P(x, shade(p.suit, -0.35), cx - 3, cy + 2);
    // camisa e gravata (frente)
    if (p.shirt && p.shirt !== p.suit) { R(x, p.shirt, cx + rx - 1, cy - 1, 2, 3); }
    if (p.tie) { P(x, p.tie, cx + rx, cy); P(x, p.tie, cx + rx - 1, cy); }
    drawHead(x, p, cx + 1, cy);
    if (gun && gunAfter) drawGun(x, gun, gx, gy);
    hand(x, p, lh[0], lh[1]);
    hand(x, p, rh[0], rh[1]);
    return c;
  }

  function buildLegs(palKey, frame) {
    const p = PALS[palKey] || PALS.grunt;
    const [c, x] = makeCanvas(32, 32);
    const s = frame < 0 ? 0 : Math.sin(frame / 8 * TAU);
    const f1 = 15 + Math.round(s * 4), f2 = 15 - Math.round(s * 4);
    const bulky = p.bulky ? 1 : 0;
    const y1 = 13 - bulky, y2 = 19 + bulky;
    L(x, OUT, 14, y1, f1, y1, 4); L(x, OUT, 14, y2, f2, y2, 4);
    L(x, p.pants, 14, y1, f1, y1, 2); L(x, p.pants, 14, y2, f2, y2, 2);
    R(x, OUT, f1, y1 - 2, 5, 4); R(x, p.shoe, f1 + 1, y1 - 1, 3, 2);
    R(x, OUT, f2, y2 - 2, 5, 4); R(x, p.shoe, f2 + 1, y2 - 1, 3, 2);
    return c;
  }

  function buildCorpse(palKey) {
    const p = PALS[palKey] || PALS.grunt;
    const [c, x] = makeCanvas(32, 32);
    // pernas
    L(x, OUT, 13, 13, 5, 10, 4); L(x, OUT, 13, 19, 5, 22, 4);
    L(x, p.pants, 13, 13, 5, 10, 2); L(x, p.pants, 13, 19, 5, 22, 2);
    R(x, p.shoe, 3, 9, 3, 2); R(x, p.shoe, 3, 22, 3, 2);
    // braços abertos
    L(x, OUT, 19, 11, 22, 4, 3); L(x, OUT, 19, 21, 24, 27, 3);
    L(x, p.suit, 19, 11, 22, 4, 2); L(x, p.suit, 19, 21, 24, 27, 2);
    R(x, p.skin, 22, 3, 2, 2); R(x, p.skin, 24, 27, 2, 2);
    // tronco
    E(x, OUT, 16, 16, 6, 6.5); E(x, p.suit, 16, 16, 5, 5.5);
    if (p.shirt && p.shirt !== p.suit) R(x, p.shirt, 15, 15, 6, 2);
    if (p.tie) R(x, p.tie, 15, 16, 5, 1);
    // cabeça
    E(x, OUT, 24, 16, 3.8, 3.8);
    if (p.head === 'bald') E(x, p.skin, 24, 16, 3, 3);
    else if (p.head === 'mask') E(x, '#1b1b1d', 24, 16, 3, 3);
    else { E(x, p.head === 'hood' ? p.suit : p.hair, 24, 16, 3, 3); if (p.head === 'long') { E(x, p.hair, 26, 16, 3, 4); } P(x, p.skin, 23, 16); }
    return c;
  }

  // ---------- itens ----------
  function outline(src, col) {
    const [c, x] = makeCanvas(src.width, src.height);
    const s = silhouette(src, col);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) x.drawImage(s, dx, dy);
    x.drawImage(src, 0, 0);
    return c;
  }
  function buildItem(type) {
    const [c, x] = makeCanvas(20, 20);
    if (type === 'pistol') drawGun(x, 'pistol', 7, 9), R(x, '#2b2b30', 7, 11, 2, 3);
    else if (type === 'shotgun') drawGun(x, 'shotgun', 7, 9);
    else if (type === 'rifle') drawGun(x, 'rifle', 6, 8);
    else if (type === 'knife') drawGun(x, 'knife', 6, 9), R(x, '#d8dce4', 8, 9, 6, 1);
    else if (type === 'bat') drawGun(x, 'bat', 4, 11);
    else if (type === 'ammo') {
      R(x, OUT, 4, 6, 12, 9); R(x, '#4f5a2c', 5, 7, 10, 7); R(x, '#6d7a3c', 5, 7, 10, 2);
      R(x, '#d8b040', 7, 10, 1, 3); R(x, '#d8b040', 9, 10, 1, 3); R(x, '#d8b040', 11, 10, 1, 3); R(x, '#d8b040', 13, 10, 1, 3);
    } else if (type === 'pencil') {
      L(x, OUT, 3, 15, 16, 4, 4);
      L(x, '#f0c020', 4, 14, 14, 6, 2);
      L(x, '#f2a8b8', 3, 15, 4, 14, 2); P(x, '#b0b0b8', 5, 13);
      P(x, '#e8d0a0', 15, 5); P(x, '#e8d0a0', 14, 5); P(x, '#202020', 16, 4);
      const o = outline(c, '#ffd040');
      return outline(o, '#7a4a00');
    } else if (type === 'medkit') {
      R(x, OUT, 4, 5, 12, 10); R(x, '#e8e8e8', 5, 6, 10, 8); R(x, '#d01830', 9, 7, 2, 6); R(x, '#d01830', 7, 9, 6, 2);
    }
    return outline(c, '#ffffff');
  }
  function buildBarrel() {
    const [c, x] = makeCanvas(16, 16);
    E(x, OUT, 8, 8, 7, 7); E(x, '#a3201a', 8, 8, 6, 6); E(x, '#c63a26', 7.5, 7.5, 4.6, 4.6);
    E(x, '#8a1a14', 8, 8, 2.5, 2.5);
    R(x, '#f0c020', 7, 4, 2, 1); R(x, '#f0c020', 7, 11, 2, 1);
    P(x, '#ff7a5a', 5, 5); P(x, '#ff7a5a', 6, 4);
    return c;
  }
  // pitbull companheiro (vista de cima, virado para +x)
  function buildDog(frame, pose) {
    const [c, x] = makeCanvas(32, 32);
    const C1 = '#6e7480', C2 = '#8c929e', C3 = '#4a4e58', W = '#d8d8dc';
    const s = frame < 0 ? 0 : Math.sin(frame / 6 * TAU);
    const f = Math.round(s * 2);
    // patas
    for (const [px, py, k] of [[19, 11, 1], [19, 21, -1], [9, 12, -1], [9, 20, 1]]) {
      R(x, OUT, px + f * k - 1, py - 1, 4, 3); R(x, '#3a3c44', px + f * k, py, 2, 1);
    }
    // cauda
    const wag = pose === 'idle' ? Math.round(Math.sin(frame * 2) * 2) : 0;
    L(x, OUT, 7, 16, 3, 16 + wag, 2); L(x, C1, 7, 16, 4, 16 + wag, 1);
    // corpo
    E(x, OUT, 13.5, 16, 7.6, 5.2); E(x, C1, 13.5, 16, 6.6, 4.2);
    R(x, C2, 9, 15, 8, 1); P(x, C2, 12, 14);
    R(x, W, 18, 15, 2, 3);
    // coleira
    R(x, OUT, 19, 12, 2, 9); R(x, '#d01830', 19, 13, 1, 7); P(x, '#ffd040', 20, 16);
    // cabeça
    const hx = pose === 'bite' ? 24 : 23;
    E(x, OUT, hx, 16, 4.6, 4.6); E(x, C1, hx, 16, 3.7, 3.7);
    E(x, C3, hx - 1, 12.6, 1.6, 1.4); E(x, C3, hx - 1, 19.4, 1.6, 1.4);
    E(x, '#9aa0aa', hx + 2.5, 16, 2.4, 2.2);
    P(x, '#101014', hx + 4, 16); P(x, '#101014', hx + 1, 14); P(x, '#101014', hx + 1, 18);
    P(x, W, hx - 1, 15);
    if (pose === 'bite') { R(x, '#c01828', hx + 4, 15, 2, 3); P(x, '#ffffff', hx + 5, 15); P(x, '#ffffff', hx + 5, 17); }
    return c;
  }
  function buildShell() { const [c, x] = makeCanvas(2, 1); R(x, '#d8b040', 0, 0, 2, 1); return c; }

  // ---------- API ----------
  function get(key, fn) { let s = cache.get(key); if (!s) { s = fn(); cache.set(key, s); } return s; }
  function char(pal, weapon, pose) { return get(`c|${pal}|${weapon}|${pose}`, () => buildChar(pal, weapon, pose)); }
  function legs(pal, frame) { return get(`l|${pal}|${frame}`, () => buildLegs(pal, frame)); }
  function corpse(pal) { return get(`d|${pal}`, () => buildCorpse(pal)); }
  function item(type) { return get(`i|${type}`, () => buildItem(type)); }
  function barrel() { return get('barrel', buildBarrel); }
  function dog(frame, pose) { return get(`dog|${frame}|${pose}`, () => buildDog(frame, pose)); }
  function silhouette(src, col) {
    let m = silCache.get(src); if (!m) { m = {}; silCache.set(src, m); }
    if (m[col]) return m[col];
    const [c, x] = makeCanvas(src.width, src.height);
    x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    m[col] = c; return c;
  }
  // pré-gera os sprites mais usados (evita travadas durante o jogo)
  function warm(palKeys) {
    const ws = ['none', 'pistol', 'shotgun', 'rifle', 'knife', 'bat', 'pencil'];
    const poses = ['idle', 'recoil', 'bash', 'reload', 'slash1', 'slash2'];
    for (const pk of palKeys) {
      for (const w of ws) for (const po of poses) char(pk, w, po);
      for (let f = -1; f < 8; f++) legs(pk, f);
      corpse(pk);
    }
    ['pistol', 'shotgun', 'rifle', 'knife', 'bat', 'ammo', 'medkit', 'pencil'].forEach(item);
    barrel();
    for (let f = -1; f < 6; f++) { dog(f, 'idle'); dog(f, 'run'); }
    dog(-1, 'bite'); dog(0, 'bite');
  }
  // exporta uma folha de sprites (usado para gerar assets/sprites/spritesheet.png)
  function sheet(palKeys) {
    const ws = ['none', 'pistol', 'shotgun', 'rifle', 'knife'];
    const cols = ws.length + 4, rows = palKeys.length;
    const [c, x] = makeCanvas(cols * 32, rows * 32 + 30);
    x.fillStyle = '#120c18'; x.fillRect(0, 0, c.width, c.height);
    palKeys.forEach((pk, r) => {
      ws.forEach((w, i) => { x.drawImage(legs(pk, 2), i * 32, r * 32); x.drawImage(char(pk, w, 'idle'), i * 32, r * 32); });
      x.drawImage(char(pk, 'knife', 'slash1'), ws.length * 32, r * 32);
      x.drawImage(char(pk, 'pistol', 'recoil'), (ws.length + 1) * 32, r * 32);
      x.drawImage(legs(pk, 2), (ws.length + 2) * 32, r * 32);
      x.drawImage(corpse(pk), (ws.length + 3) * 32, r * 32);
    });
    ['pistol', 'shotgun', 'rifle', 'knife', 'ammo', 'medkit'].forEach((t, i) => x.drawImage(item(t), i * 22, rows * 32 + 2));
    x.drawImage(barrel(), 6 * 22 + 2, rows * 32 + 4);
    x.drawImage(item('pencil'), 7 * 22 + 4, rows * 32 + 2);
    x.drawImage(dog(1, 'run'), 8 * 22 + 6, rows * 32 - 6); x.drawImage(dog(0, 'bite'), 8 * 22 + 36, rows * 32 - 6);
    return c;
  }
  return { PALS, char, legs, corpse, item, barrel, dog, silhouette, warm, sheet, shell: () => get('shell', buildShell), E, R, P, L };
})();
