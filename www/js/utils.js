// THE LAST CONTRACT — utilitários, fonte pixel e salvamento
'use strict';

const TAU = Math.PI * 2;
const TILE = 16;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function randi(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function dist(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }
function dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
  return d;
}
function approachAngle(a, target, step) {
  const d = angDiff(a, target);
  if (Math.abs(d) <= step) return target;
  return a + Math.sign(d) * step;
}
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return [c, x];
}
// hash determinístico para variações de tiles
function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function shade(hex, amt) {
  // amt -1..1 escurece/clareia
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return '#' + ((1 << 24) | ((r | 0) << 16) | ((g | 0) << 8) | (b | 0)).toString(16).slice(1);
}
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------------------------------------------------------------
// Fonte bitmap 5x7 (renderizada e cacheada em canvas)
// ---------------------------------------------------------------
const PixelFont = (() => {
  const G = {
    'A': '01110100011000111111100011000110001', 'B': '11110100011000111110100011000111110',
    'C': '01110100011000010000100001000101110', 'D': '11110100011000110001100011000111110',
    'E': '11111100001000011110100001000011111', 'F': '11111100001000011110100001000010000',
    'G': '01110100011000010111100011000101111', 'H': '10001100011000111111100011000110001',
    'I': '01110001000010000100001000010001110', 'J': '00111000100001000010000101001001100',
    'K': '10001100101010011000101001001010001', 'L': '10000100001000010000100001000011111',
    'M': '10001110111010110101100011000110001', 'N': '10001100011100110101100111000110001',
    'O': '01110100011000110001100011000101110', 'P': '11110100011000111110100001000010000',
    'Q': '01110100011000110001101011001001101', 'R': '11110100011000111110101001001010001',
    'S': '01111100001000001110000010000111110', 'T': '11111001000010000100001000010000100',
    'U': '10001100011000110001100011000101110', 'V': '10001100011000110001100010101000100',
    'W': '10001100011000110101101011010101010', 'X': '10001100010101000100010101000110001',
    'Y': '10001100011000101010001000010000100', 'Z': '11111000010001000100010001000011111',
    '0': '01110100011001110101110011000101110', '1': '00100011000010000100001000010001110',
    '2': '01110100010000100010001000100011111', '3': '11111000100010000010000011000101110',
    '4': '00010001100101010010111110001000010', '5': '11111100001111000001000011000101110',
    '6': '00110010001000011110100011000101110', '7': '11111000010001000100010000100001000',
    '8': '01110100011000101110100011000101110', '9': '01110100011000101111000010001001100',
    ' ': '00000000000000000000000000000000000', '.': '00000000000000000000000000110001100',
    ',': '00000000000000000000011000010001000', ':': '00000011000110000000011000110000000',
    '!': '00100001000010000100001000000000100', '?': '01110100010000100010001000000000100',
    '/': '00001000100001000100010000100010000', '-': '00000000000000011111000000000000000',
    '+': '00000001000010011111001000010000000', '%': '11000110010001000100010001001100011',
    '(': '00010001000100001000010000010000010', ')': '01000001000001000010000100010001000',
    "'": '00100001000100000000000000000000000', '*': '00000101010111011111011101010100000',
    '<': '00010001000100010000010000010000010', '>': '01000001000001000001000100010001000',
    '=': '00000000001111100000111110000000000', '#': '01010010101111101010111110101001010',
  };
  const cache = new Map();
  function norm(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  }
  function width(text, scale) { return Math.max(0, norm(text).length * 6 - 1) * (scale || 1); }
  function render(text, color, scale, shadow) {
    const key = text + '|' + color + '|' + scale + '|' + shadow;
    let c = cache.get(key);
    if (c) return c;
    const t = norm(text);
    const w = Math.max(1, t.length * 6 * scale) + scale, h = 7 * scale + scale;
    const [cv, x] = makeCanvas(w, h);
    const draw = (col, ox, oy) => {
      x.fillStyle = col;
      for (let i = 0; i < t.length; i++) {
        const g = G[t[i]] || G['?'];
        for (let p = 0; p < 35; p++) {
          if (g.charCodeAt(p) === 49) {
            x.fillRect(ox + (i * 6 + (p % 5)) * scale, oy + ((p / 5) | 0) * scale, scale, scale);
          }
        }
      }
    };
    if (shadow) draw(shadow, scale, scale);
    draw(color, 0, 0);
    if (cache.size > 400) cache.clear();
    cache.set(key, cv);
    return cv;
  }
  function draw(ctx, text, x, y, color, scale, align, shadow) {
    scale = scale || 1;
    const c = render(text, color || '#fff', scale, shadow === undefined ? '#000' : shadow);
    let dx = x;
    if (align === 'center') dx = x - (c.width - scale) / 2;
    else if (align === 'right') dx = x - (c.width - scale);
    ctx.drawImage(c, Math.round(dx), Math.round(y));
    return c.width;
  }
  return { draw, width };
})();

// ---------------------------------------------------------------
// Salvamento local (localStorage)
// ---------------------------------------------------------------
const Save = (() => {
  const KEY = 'tlc_save_v1';
  const def = () => ({
    unlocked: 1,
    best: {},
    settings: { master: 0.8, music: 0.6, sfx: 0.8, difficulty: 1, quality: 1, shake: true, aimAssist: true, touch: 0 },
  });
  let data = def();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        data = Object.assign(def(), d);
        data.settings = Object.assign(def().settings, d.settings || {});
      }
    } catch (e) { data = def(); }
    return data;
  }
  function write() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* armazenamento indisponível */ }
  }
  function reset() { data = def(); write(); }
  return { load, write, reset, get data() { return data; } };
})();
