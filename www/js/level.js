/* ============================================================
   THE LAST CONTRACT - level.js
   Mapa em tiles: parse do ASCII, pré-renderização do cenário,
   mapa de luz (neon), decalques, colisão, linha de visão,
   campo de fluxo (navegação dos inimigos) e portas.
   ============================================================ */
'use strict';

const TILE_FLOOR = 0, TILE_WALL = 1, TILE_COVER = 2, TILE_LOW = 3; // LOW: bloqueia só movimento

const FURNITURE_CHARS = {
  T: 'table', O: 'round', C: 'crate', S: 'sofa', B: 'bar', b: 'bed', P: 'plant', M: 'dj', m: 'speaker',
  U: 'dumpster', Q: 'vending', K: 'desk', R: 'counter', L: 'pool'
};
const SOLID_FURNITURE = { I: 'pillar', F: 'shelf' }; // bloqueiam visão (tipo parede)
const LIGHT_CHARS = { r: '#ff2a5a', u: '#2a6cff', p: '#b24bff', y: '#ffb347', g: '#3dff8a', c: '#2ad8ff', w: '#e8e8ff' };
const ENEMY_CHARS = { e: 'thug', h: 'heavy', s: 'soldier', k: 'knifer', z: 'elite', t: 'target', X: 'boss' };
const PICKUP_CHARS = { '+': 'medkit', a: 'ammo', '1': 'pistol', '2': 'shotgun', '3': 'rifle', '4': 'knife' };

class Level {
  constructor(def) {
    this.def = def;
    this.theme = def.theme;
    this.T = CONFIG.TILE;
    this.rng = U.seeded(def.id * 7919 + 13);
    this.parse();
    this.prerender();
    this.buildLightmap();
    this.flowCache = Object.create(null);
    this.decalCount = 0;
  }

  /* ---------------- PARSE ---------------- */
  parse() {
    const rows = this.def.map;
    this.h = rows.length;
    this.w = Math.max(...rows.map(r => r.length));
    const n = this.w * this.h;
    this.type = new Uint8Array(n);
    this.chars = new Array(n);
    this.floorKind = new Array(n);
    this.enemies = []; this.pickups = []; this.barrels = []; this.doors = []; this.lights = []; this.exitTiles = [];
    this.cars = []; this.decor = [];
    this.playerStart = { x: 32, y: 32 };
    const floors = this.theme.floors || { '.': 'concrete' };
    const defaultFloor = floors['.'] || 'concrete';
    for (let y = 0; y < this.h; y++) {
      const row = rows[y];
      for (let x = 0; x < this.w; x++) {
        const ch = row[x] === undefined ? '#' : row[x];
        const i = y * this.w + x;
        this.chars[i] = ch;
        let type = TILE_FLOOR, fk = defaultFloor;
        const cx = x * this.T + 8, cy = y * this.T + 8;
        if (ch === '#') type = TILE_WALL;
        else if (ch === '=') type = TILE_LOW;
        else if (ch === '|') type = TILE_LOW;
        else if (floors[ch]) fk = floors[ch];
        else if (FURNITURE_CHARS[ch]) type = TILE_COVER;
        else if (SOLID_FURNITURE[ch]) type = TILE_WALL;
        else if (ch === 'V' || ch === 'v') { this.cars.push({ x, y, vertical: ch === 'v' }); type = TILE_COVER; }
        else if (ch === 'D') { this.doors.push({ tx: x, ty: y, x: cx, y: cy, open: false, t: 0, timer: 0, horizontal: true }); }
        else if (LIGHT_CHARS[ch]) this.lights.push({ x: cx, y: cy, color: LIGHT_CHARS[ch] });
        else if (ENEMY_CHARS[ch]) this.enemies.push({ type: ENEMY_CHARS[ch], x: cx, y: cy });
        else if (PICKUP_CHARS[ch]) this.pickups.push({ kind: PICKUP_CHARS[ch], x: cx, y: cy });
        else if (ch === 'o') this.barrels.push({ x: cx, y: cy });
        else if (ch === '@') this.playerStart = { x: cx, y: cy };
        else if (ch === '>') this.exitTiles.push({ tx: x, ty: y });
        else if (ch === 'x') this.decor.push({ x, y, kind: 'trash' });
        this.type[i] = type; this.floorKind[i] = fk;
      }
    }
    // carros ocupam 4x2 (ou 2x4)
    for (const c of this.cars) {
      const w = c.vertical ? 2 : 4, h = c.vertical ? 4 : 2;
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) this.type[(c.y + yy) * this.w + c.x + xx] = TILE_COVER;
    }
    // orientação das portas: paredes à esquerda/direita => folha horizontal
    for (const d of this.doors) {
      const l = this.tileAt(d.tx - 1, d.ty), r = this.tileAt(d.tx + 1, d.ty);
      d.horizontal = (l === TILE_WALL && r === TILE_WALL);
    }
    this.pw = this.w * this.T; this.ph = this.h * this.T;
  }

  tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return TILE_WALL;
    return this.type[ty * this.w + tx];
  }
  charAt(tx, ty) { if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return '#'; return this.chars[ty * this.w + tx]; }
  isSolidAt(x, y) { const t = this.tileAt((x / this.T) | 0, (y / this.T) | 0); return t === TILE_WALL || t === TILE_COVER; }
  isWalkable(tx, ty) { return this.tileAt(tx, ty) === TILE_FLOOR; }
  doorAt(tx, ty) { for (const d of this.doors) if (d.tx === tx && d.ty === ty) return d; return null; }

  /* ---------------- PRÉ-RENDERIZAÇÃO ---------------- */
  prerender() {
    const T = this.T, th = this.theme;
    this.canvas = document.createElement('canvas'); this.canvas.width = this.pw; this.canvas.height = this.ph;
    const ctx = this.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const rng = this.rng;
    // chão em todos os tiles (para que móveis/paredes se apoiem em algo)
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = y * this.w + x;
      Tiles.floor(this.floorKind[i], ctx, x * T, y * T, rng, th);
    }
    // decorações de chão
    for (const d of this.decor) Tiles.furniture(d.kind, ctx, d.x * T, d.y * T, rng, th);
    // saída
    for (const e of this.exitTiles) Tiles.exit(ctx, e.tx * T, e.ty * T);
    // luzes (luminárias)
    for (const l of this.lights) Tiles.lamp(ctx, l.x - 8, l.y - 8, l.color, th.lampKind || 'neon');
    // móveis / paredes
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = y * this.w + x, ch = this.chars[i];
      if (ch === '#') {
        const below = this.tileAt(x, y + 1) === TILE_WALL, above = this.tileAt(x, y - 1) === TILE_WALL;
        const left = this.tileAt(x - 1, y) === TILE_WALL, right = this.tileAt(x + 1, y) === TILE_WALL;
        Tiles.wall(ctx, x * T, y * T, rng, th, below, above, left, right);
      } else if (ch === '=') {
        Tiles.window(ctx, x * T, y * T, rng, th, this.tileAt(x, y + 1) === TILE_WALL);
      } else if (ch === '|') {
        Tiles.fence(ctx, x * T, y * T, rng, th);
      } else if (FURNITURE_CHARS[ch]) {
        Tiles.furniture(FURNITURE_CHARS[ch], ctx, x * T, y * T, rng, th);
      } else if (SOLID_FURNITURE[ch]) {
        Tiles.furniture(SOLID_FURNITURE[ch], ctx, x * T, y * T, rng, th);
      }
    }
    for (const c of this.cars) Tiles.car(ctx, c.x * T, c.y * T, rng, c.vertical);
    // sombras das paredes sobre o chão (lado inferior) para profundidade
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.type[y * this.w + x] !== TILE_WALL) continue;
      if (this.tileAt(x, y + 1) === TILE_FLOOR) ctx.fillRect(x * T, (y + 1) * T, T, 3);
      if (this.tileAt(x + 1, y) === TILE_FLOOR) ctx.fillRect((x + 1) * T, y * T, 2, T);
    }
    // camada de decalques (sangue, furos)
    this.decals = document.createElement('canvas'); this.decals.width = this.pw; this.decals.height = this.ph;
    this.dctx = this.decals.getContext('2d');
  }

  buildLightmap() {
    const th = this.theme;
    this.lightmap = document.createElement('canvas'); this.lightmap.width = this.pw; this.lightmap.height = this.ph;
    const ctx = this.lightmap.getContext('2d');
    const amb = th.ambient || [80, 76, 100];
    ctx.fillStyle = `rgb(${amb[0]},${amb[1]},${amb[2]})`; ctx.fillRect(0, 0, this.pw, this.ph);
    ctx.globalCompositeOperation = 'lighter';
    const R = th.lightRadius || 78;
    for (const l of this.lights) {
      const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, R);
      const [r, gg, b] = U.hexToRgb(l.color);
      g.addColorStop(0, `rgba(${r},${gg},${b},0.95)`);
      g.addColorStop(0.35, `rgba(${r},${gg},${b},0.55)`);
      g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(l.x, l.y, R, 0, 7); ctx.fill();
    }
    // saída: luz verde
    for (const e of this.exitTiles) {
      const x = e.tx * this.T + 8, y = e.ty * this.T + 8;
      const g = ctx.createRadialGradient(x, y, 2, x, y, 40);
      g.addColorStop(0, 'rgba(60,255,140,0.6)'); g.addColorStop(1, 'rgba(60,255,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 40, 0, 7); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------------- DECALQUES ---------------- */
  addDecal(p) {
    if (this.decalCount > 6000) return;
    this.decalCount++;
    const c = this.dctx;
    if (p.type === 'blood') { c.fillStyle = U.chance(0.5) ? '#6e0c16' : '#8a1020'; c.fillRect(Math.round(p.x), Math.round(p.y), Math.ceil(p.size), Math.ceil(p.size)); }
    else if (p.type === 'shell') { c.fillStyle = '#b8902c'; c.fillRect(Math.round(p.x), Math.round(p.y), 2, 1); }
    else if (p.type === 'debris') { c.fillStyle = '#1e1e22'; c.fillRect(Math.round(p.x), Math.round(p.y), Math.ceil(p.size), Math.ceil(p.size)); }
  }
  addBloodPool(x, y) {
    const img = Sprites.bloodPool[U.randInt(0, 3)];
    this.dctx.save(); this.dctx.translate(x, y); this.dctx.rotate(U.rand(0, 6.28));
    this.dctx.drawImage(img, -7, -7); this.dctx.restore();
  }
  addBulletHole(x, y) { this.dctx.drawImage(Sprites.bulletHole, Math.round(x) - 1, Math.round(y) - 1); }
  addScorch(x, y, r) {
    const g = this.dctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, 'rgba(10,10,10,0.8)'); g.addColorStop(1, 'rgba(10,10,10,0)');
    this.dctx.fillStyle = g; this.dctx.beginPath(); this.dctx.arc(x, y, r, 0, 7); this.dctx.fill();
  }

  /* ---------------- COLISÃO ---------------- */
  /* Move um círculo (x,y,r) por (dx,dy) resolvendo colisão com tiles. Retorna [x,y,colidiu] */
  moveCircle(x, y, r, dx, dy, allowCover) {
    const T = this.T;
    let hit = false;
    const solid = (tx, ty) => {
      const t = this.tileAt(tx, ty);
      if (t === TILE_FLOOR) return false;
      if (allowCover && t === TILE_COVER) return false;
      return true;
    };
    const collides = (px, py) => {
      const x0 = Math.floor((px - r) / T), x1 = Math.floor((px + r - 0.01) / T);
      const y0 = Math.floor((py - r) / T), y1 = Math.floor((py + r - 0.01) / T);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty)) return true;
      return false;
    };
    // eixo X
    let nx = x + dx;
    if (collides(nx, y)) {
      hit = true;
      if (dx > 0) nx = Math.floor((x + r) / T) * T + T - r - 0.01; else if (dx < 0) nx = Math.floor((x - r) / T) * T + r + 0.01;
      // fallback caso o ajuste ainda colida
      if (collides(nx, y)) nx = x;
    }
    let ny = y + dy;
    if (collides(nx, ny)) {
      hit = true;
      if (dy > 0) ny = Math.floor((y + r) / T) * T + T - r - 0.01; else if (dy < 0) ny = Math.floor((y - r) / T) * T + r + 0.01;
      if (collides(nx, ny)) ny = y;
    }
    return [nx, ny, hit];
  }

  /* Linha de visão entre dois pontos (bloqueada por paredes e portas fechadas) */
  lineOfSight(x1, y1, x2, y2) {
    const T = this.T;
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(dist / 6);
    let ltx = -1, lty = -1;
    for (let i = 1; i < steps; i++) {
      const x = x1 + dx * i / steps, y = y1 + dy * i / steps;
      const tx = (x / T) | 0, ty = (y / T) | 0;
      if (tx === ltx && ty === lty) continue;
      ltx = tx; lty = ty;
      const t = this.tileAt(tx, ty);
      if (t === TILE_WALL) return false;
      if (t === TILE_FLOOR) { const d = this.doorAt(tx, ty); if (d && d.t < 0.5) return false; }
    }
    return true;
  }

  /* Verifica se um projétil é bloqueado no ponto (x,y). Retorna null ou 'wall'/'cover'/'door' */
  bulletBlock(x, y, traveled) {
    const tx = (x / this.T) | 0, ty = (y / this.T) | 0;
    const t = this.tileAt(tx, ty);
    if (t === TILE_WALL) return 'wall';
    if (t === TILE_COVER) return traveled > 22 ? 'cover' : null;
    if (t === TILE_FLOOR) { const d = this.doorAt(tx, ty); if (d && d.t < 0.5) return 'door'; }
    return null;
  }

  /* ---------------- NAVEGAÇÃO (campo de fluxo via BFS) ---------------- */
  flowField(tx, ty) {
    const key = tx + ',' + ty;
    const cached = this.flowCache[key];
    if (cached) return cached;
    const n = this.w * this.h;
    const dist = new Int16Array(n).fill(-1);
    if (!this.isWalkable(tx, ty)) {
      // procura tile caminhável mais próximo
      let best = null, bd = 1e9;
      for (let r = 1; r <= 3 && !best; r++) for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
        if (this.isWalkable(tx + xx, ty + yy)) { const d = xx * xx + yy * yy; if (d < bd) { bd = d; best = [tx + xx, ty + yy]; } }
      }
      if (!best) return dist;
      tx = best[0]; ty = best[1];
    }
    const queue = new Int32Array(n); let qh = 0, qt = 0;
    const start = ty * this.w + tx;
    dist[start] = 0; queue[qt++] = start;
    const w = this.w;
    while (qh < qt) {
      const cur = queue[qh++];
      const cx = cur % w, cy = (cur / w) | 0, d = dist[cur] + 1;
      if (cx > 0 && this.type[cur - 1] === TILE_FLOOR && dist[cur - 1] < 0) { dist[cur - 1] = d; queue[qt++] = cur - 1; }
      if (cx < w - 1 && this.type[cur + 1] === TILE_FLOOR && dist[cur + 1] < 0) { dist[cur + 1] = d; queue[qt++] = cur + 1; }
      if (cy > 0 && this.type[cur - w] === TILE_FLOOR && dist[cur - w] < 0) { dist[cur - w] = d; queue[qt++] = cur - w; }
      if (cy < this.h - 1 && this.type[cur + w] === TILE_FLOOR && dist[cur + w] < 0) { dist[cur + w] = d; queue[qt++] = cur + w; }
    }
    // cache limitado
    const keys = Object.keys(this.flowCache);
    if (keys.length > 12) delete this.flowCache[keys[0]];
    this.flowCache[key] = dist;
    return dist;
  }
  invalidateFlow() { this.flowCache = Object.create(null); }

  /* Próximo passo (direção) a partir de (x,y) seguindo o campo até o alvo. Retorna [dx,dy] normalizado ou null */
  flowStep(field, x, y) {
    const T = this.T, w = this.w;
    const tx = (x / T) | 0, ty = (y / T) | 0;
    const cur = field[ty * w + tx];
    if (cur < 0) return null;
    if (cur === 0) return [0, 0];
    let bx = tx, by = ty, bd = cur;
    for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) {
      if (!xx && !yy) continue;
      const nx = tx + xx, ny = ty + yy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= this.h) continue;
      const d = field[ny * w + nx];
      if (d < 0) continue;
      if (xx && yy) { // diagonal: só se ambos ortogonais estiverem livres
        if (this.type[ty * w + nx] !== TILE_FLOOR || this.type[ny * w + tx] !== TILE_FLOOR) continue;
      }
      const dd = d + (xx && yy ? 0.4 : 0);
      if (dd < bd) { bd = dd; bx = nx; by = ny; }
    }
    if (bx === tx && by === ty) return [0, 0];
    const gx = bx * T + 8, gy = by * T + 8;
    const dx = gx - x, dy = gy - y, l = Math.sqrt(dx * dx + dy * dy) || 1;
    return [dx / l, dy / l];
  }

  /* Procura uma posição de cobertura perto de (x,y) em relação à ameaça (px,py) */
  findCover(x, y, px, py, radius) {
    const T = this.T;
    const tx = (x / T) | 0, ty = (y / T) | 0;
    const R = radius || 6;
    let best = null, bestScore = -1e9;
    for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) {
      const nx = tx + xx, ny = ty + yy;
      if (!this.isWalkable(nx, ny)) continue;
      const cx = nx * T + 8, cy = ny * T + 8;
      // direção da ameaça
      const ax = px - cx, ay = py - cy, al = Math.sqrt(ax * ax + ay * ay) || 1;
      const ux = Math.round(ax / al), uy = Math.round(ay / al);
      const front = this.tileAt(nx + ux, ny + uy);
      if (front !== TILE_COVER && front !== TILE_WALL) continue;
      // precisa ainda ver o jogador para poder atirar? (cobertura baixa deixa ver)
      let score = -Math.sqrt(xx * xx + yy * yy) * 2;
      if (front === TILE_COVER) score += 6; // cobertura baixa permite atirar por cima
      const dToThreat = U.dist(cx, cy, px, py);
      if (dToThreat < 40) score -= 10;
      if (dToThreat > 60 && dToThreat < 220) score += 3;
      if (score > bestScore) { bestScore = score; best = { x: cx, y: cy, tx: nx, ty: ny }; }
    }
    return best;
  }

  /* ---------------- PORTAS ---------------- */
  updateDoors(dt, entities, audio) {
    for (const d of this.doors) {
      let near = false;
      for (const e of entities) {
        if (e.dead) continue;
        if (Math.abs(e.x - d.x) < 20 && Math.abs(e.y - d.y) < 20) { near = true; break; }
      }
      if (near) { d.timer = 0.6; if (!d.open) { d.open = true; if (audio) audio.play('door', d.x, d.y); } }
      else if (d.open) { d.timer -= dt; if (d.timer <= 0) d.open = false; }
      d.t = U.approach(d.t, d.open ? 1 : 0, dt * 6);
    }
  }
  drawDoors(ctx) {
    for (const d of this.doors) {
      const px = d.tx * this.T, py = d.ty * this.T;
      const closed = d.t < 0.5;
      const img = d.horizontal ? (closed ? Sprites.doorH : Sprites.doorOpenH) : (closed ? Sprites.doorV : Sprites.doorOpenV);
      ctx.drawImage(img, px, py);
    }
  }
  drawExit(ctx, time, active) {
    if (!this.exitTiles.length) return;
    const a = active ? 0.35 + Math.sin(time * 6) * 0.2 : 0.08;
    ctx.fillStyle = `rgba(60,255,140,${a})`;
    for (const e of this.exitTiles) ctx.fillRect(e.tx * this.T + 2, e.ty * this.T + 2, 12, 12);
    if (active) {
      ctx.fillStyle = `rgba(200,255,220,${0.5 + Math.sin(time * 6) * 0.3})`;
      for (const e of this.exitTiles) { const x = e.tx * this.T + 8, y = e.ty * this.T + 8; ctx.fillRect(x - 1, y - 4, 2, 8); ctx.fillRect(x - 3, y - 2, 6, 2); }
    }
  }
  isOnExit(x, y) {
    const tx = (x / this.T) | 0, ty = (y / this.T) | 0;
    for (const e of this.exitTiles) if (e.tx === tx && e.ty === ty) return true;
    return false;
  }
}
