// THE LAST CONTRACT — mundo: mapa em tiles, renderização pré-calculada, colisão, linha de visão,
// busca de caminho (BFS) e iluminação neon.
'use strict';

const SOLID_CHARS = '#WCKSVOTp';
const ENTITY_CHARS = 'PXgnfmeBR12345a+%*^&';

class World {
  constructor(level, theme, quality) {
    this.level = level; this.theme = theme; this.quality = quality;
    const rows = level.map;
    this.h = rows.length; this.w = Math.max(...rows.map((r) => r.length));
    this.pw = this.w * TILE; this.ph = this.h * TILE;
    this.chars = [];
    this.grid = new Uint8Array(this.w * this.h); // 0 chão, 1 parede, 2 objeto sólido (cobertura)
    this.spawn = { player: null, enemies: [], items: [], barrels: [], exits: [], reinf: [], lights: [], dance: [] };
    for (let y = 0; y < this.h; y++) {
      const row = [];
      for (let x = 0; x < this.w; x++) row.push(rows[y][x] || '#');
      this.chars.push(row);
    }
    // processa entidades e decide o piso sob elas
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.chars[y][x];
        const cx = x * TILE + 8, cy = y * TILE + 8;
        if (ENTITY_CHARS.includes(c)) {
          if (c === 'P') this.spawn.player = { x: cx, y: cy };
          else if (c === 'X') this.spawn.exits.push({ x, y });
          else if ('gnfmeB'.includes(c)) this.spawn.enemies.push({ t: c, x: cx, y: cy });
          else if (c === 'R') this.spawn.reinf.push({ x: cx, y: cy });
          else if ('12345a+'.includes(c)) this.spawn.items.push({ t: c, x: cx, y: cy });
          else if (c === '%') this.spawn.barrels.push({ x: cx, y: cy });
          else if ('*^&'.includes(c)) this.spawn.lights.push({ x: cx, y: cy, c });
          this.chars[y][x] = this.floorAround(x, y);
        }
      }
    }
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.chars[y][x];
        this.grid[y * this.w + x] = c === '#' || c === 'W' ? 1 : (SOLID_CHARS.includes(c) ? 2 : 0);
        if (c === ':' && theme.floors[':'] && theme.floors[':'].k === 'dance') this.spawn.dance.push(x, y);
      }
    }
    // buffers de busca de caminho
    this._prev = new Int32Array(this.w * this.h);
    this._mark = new Uint32Array(this.w * this.h);
    this._stamp = 1;
    this._queue = new Int32Array(this.w * this.h);
    this.render();
  }

  floorAround(x, y) {
    const cnt = {};
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const r = this.chars[y + dy]; if (!r) continue;
      const c = r[x + dx];
      if (c && '.,:_'.includes(c)) cnt[c] = (cnt[c] || 0) + 1;
    }
    let best = '.', bn = 0;
    for (const k in cnt) if (cnt[k] > bn) { bn = cnt[k]; best = k; }
    return best;
  }

  // ---------------- consultas ----------------
  tile(tx, ty) { if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return 1; return this.grid[ty * this.w + tx]; }
  solid(tx, ty) { return this.tile(tx, ty) !== 0; }
  solidAt(px, py) { return this.tile(Math.floor(px / TILE), Math.floor(py / TILE)) !== 0; }
  isWall(tx, ty) { return this.tile(tx, ty) === 1; }

  pushOut(e, r) {
    const x0 = Math.floor((e.x - r) / TILE), x1 = Math.floor((e.x + r) / TILE);
    const y0 = Math.floor((e.y - r) / TILE), y1 = Math.floor((e.y + r) / TILE);
    let hit = false;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!this.solid(tx, ty)) continue;
        const bx = tx * TILE, by = ty * TILE;
        const nx = clamp(e.x, bx, bx + TILE), ny = clamp(e.y, by, by + TILE);
        let dx = e.x - nx, dy = e.y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          hit = true;
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            e.x += dx / d * (r - d); e.y += dy / d * (r - d);
          } else {
            // centro dentro do tile: empurra pelo eixo mais curto
            const l = e.x - bx, rr = bx + TILE - e.x, t = e.y - by, b = by + TILE - e.y;
            const m = Math.min(l, rr, t, b);
            if (m === l) e.x = bx - r; else if (m === rr) e.x = bx + TILE + r; else if (m === t) e.y = by - r; else e.y = by + TILE + r;
          }
        }
      }
    }
    return hit;
  }
  move(e, dx, dy, r) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
    let hit = false;
    for (let i = 0; i < steps; i++) {
      e.x += dx / steps; if (this.pushOut(e, r)) hit = true;
      e.y += dy / steps; if (this.pushOut(e, r)) hit = true;
    }
    return hit;
  }

  // linha de visão / trajetória livre (paredes e objetos bloqueiam)
  los(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const d = Math.sqrt(dx * dx + dy * dy);
    const n = Math.ceil(d / 4);
    for (let i = 1; i < n; i++) {
      if (this.solidAt(ax + dx * i / n, ay + dy * i / n)) return false;
    }
    return true;
  }
  // caminho livre considerando a largura do corpo
  clearPath(ax, ay, bx, by, r) {
    const nx = -(by - ay), ny = bx - ax; const l = Math.hypot(nx, ny) || 1;
    const ox = nx / l * r, oy = ny / l * r;
    return this.los(ax + ox, ay + oy, bx + ox, by + oy) && this.los(ax - ox, ay - oy, bx - ox, by - oy);
  }

  // BFS 8 direções (sem cortar quinas). Retorna lista de pontos (px) ou null
  findPath(sx, sy, gx, gy, maxNodes) {
    const w = this.w;
    let s = Math.floor(sx / TILE) + Math.floor(sy / TILE) * w;
    let g = Math.floor(gx / TILE) + Math.floor(gy / TILE) * w;
    if (this.grid[g] !== 0) g = this.nearestFree(g);
    if (g < 0) return null;
    if (this.grid[s] !== 0) s = this.nearestFree(s);
    if (s === g) return [[gx, gy]];
    const stamp = ++this._stamp;
    const mark = this._mark, prev = this._prev, q = this._queue;
    let head = 0, tail = 0;
    q[tail++] = s; mark[s] = stamp; prev[s] = -1;
    maxNodes = maxNodes || 4000;
    let found = false;
    const D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    while (head < tail && head < maxNodes) {
      const cur = q[head++];
      if (cur === g) { found = true; break; }
      const cx = cur % w, cy = (cur / w) | 0;
      for (let k = 0; k < 8; k++) {
        const nx = cx + D[k][0], ny = cy + D[k][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= this.h) continue;
        const ni = ny * w + nx;
        if (mark[ni] === stamp || this.grid[ni] !== 0) continue;
        if (k >= 4 && (this.grid[cy * w + nx] !== 0 || this.grid[ny * w + cx] !== 0)) continue;
        mark[ni] = stamp; prev[ni] = cur; q[tail++] = ni;
      }
    }
    if (!found) return null;
    const path = [];
    let c = g;
    while (c !== -1 && c !== s) { path.push([(c % w) * TILE + 8, ((c / w) | 0) * TILE + 8]); c = prev[c]; }
    path.reverse();
    return path;
  }
  nearestFree(i) {
    const w = this.w, x = i % w, y = (i / w) | 0;
    for (let r = 1; r < 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (this.tile(x + dx, y + dy) === 0) return (y + dy) * w + x + dx;
    }
    return -1;
  }
  // BFS genérica limitada; cb(tx,ty,depth) retorna true para parar
  flood(sx, sy, maxDepth, cb) {
    const w = this.w;
    const s = Math.floor(sx / TILE) + Math.floor(sy / TILE) * w;
    if (this.grid[s] !== 0) return null;
    const stamp = ++this._stamp;
    const mark = this._mark, q = this._queue, depth = this._prev;
    let head = 0, tail = 0;
    q[tail++] = s; mark[s] = stamp; depth[s] = 0;
    while (head < tail) {
      const cur = q[head++];
      const cx = cur % w, cy = (cur / w) | 0;
      if (cb(cx, cy, depth[cur])) return [cx * TILE + 8, cy * TILE + 8];
      if (depth[cur] >= maxDepth) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= this.h) continue;
        const ni = ny * w + nx;
        if (mark[ni] === stamp || this.grid[ni] !== 0) continue;
        mark[ni] = stamp; depth[ni] = depth[cur] + 1; q[tail++] = ni;
      }
    }
    return null;
  }
  randomNear(x, y, radius) {
    const target = randi(2, radius);
    let best = null;
    this.flood(x, y, radius, (tx, ty, d) => {
      if (d >= target && Math.random() < 0.25) { best = [tx * TILE + 8, ty * TILE + 8]; return true; }
      return false;
    });
    return best;
  }
  // procura um tile protegido do ameaçador, junto a parede/objeto
  findCover(x, y, tx, ty, maxDepth) {
    return this.flood(x, y, maxDepth, (cx, cy, d) => {
      if (d < 1) return false;
      let adj = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.tile(cx + dx, cy + dy) === 2) adj = true;
      if (!adj) return false;
      return !this.los(cx * TILE + 8, cy * TILE + 8, tx, ty);
    });
  }

  // ---------------- renderização pré-calculada ----------------
  render() {
    const T = this.theme;
    const [mc, m] = makeCanvas(this.pw, this.ph);
    this.mapCanvas = mc; this.mapCtx = m;
    for (let ty = 0; ty < this.h; ty++) {
      for (let tx = 0; tx < this.w; tx++) {
        const c = this.chars[ty][tx];
        const px = tx * TILE, py = ty * TILE;
        if (c === '#' || c === 'W') { this.drawWall(m, tx, ty, px, py); continue; }
        // chão por baixo de objetos
        let f = c;
        if (!'.,:_'.includes(c)) f = this.floorAround(tx, ty);
        this.drawFloor(m, T.floors[f] || T.floors['.'], tx, ty, px, py);
      }
    }
    // sombras de paredes no chão
    m.fillStyle = 'rgba(0,0,0,0.28)';
    for (let ty = 0; ty < this.h; ty++) for (let tx = 0; tx < this.w; tx++) {
      if (this.grid[ty * this.w + tx] !== 0) continue;
      if (this.tile(tx, ty - 1) === 1) m.fillRect(tx * TILE, ty * TILE, TILE, 4);
      if (this.tile(tx - 1, ty) === 1) m.fillRect(tx * TILE, ty * TILE, 3, TILE);
    }
    this.drawProps(m);
    // marcadores das luzes (luminárias neon)
    for (const l of this.spawn.lights) {
      const col = T.lights[l.c];
      if (T.lamp === 'post') {
        Sprites.E(m, '#0a0a0c', l.x, l.y, 3.5, 3.5); Sprites.E(m, '#3a3a44', l.x, l.y, 2.5, 2.5);
        m.fillStyle = col; m.fillRect(l.x - 1, l.y - 1, 2, 2);
      } else {
        m.fillStyle = rgba(col, 0.35); m.fillRect(l.x - 3, l.y - 3, 6, 6);
        m.fillStyle = col; m.fillRect(l.x - 2, l.y - 2, 4, 4);
        m.fillStyle = '#ffffff'; m.fillRect(l.x - 1, l.y - 1, 2, 2);
      }
    }
    this.buildLights();
  }

  drawWall(m, tx, ty, px, py) {
    const W = this.theme.wall;
    m.fillStyle = W.a; m.fillRect(px, py, TILE, TILE);
    if (W.k === 'brick') {
      m.fillStyle = shade(W.a, -0.25);
      for (let r = 0; r < 4; r++) {
        m.fillRect(px, py + r * 4 + 3, TILE, 1);
        const off = ((r + ty) % 2) * 4;
        m.fillRect(px + off, py + r * 4, 1, 3); m.fillRect(px + off + 8, py + r * 4, 1, 3);
      }
    } else if (W.k === 'metal') {
      m.fillStyle = shade(W.a, -0.2);
      for (let i = 1; i < 16; i += 3) m.fillRect(px + i, py, 1, TILE);
      m.fillStyle = shade(W.a, 0.12);
      for (let i = 2; i < 16; i += 3) m.fillRect(px + i, py, 1, TILE);
    } else if (W.k === 'hedge') {
      for (let i = 0; i < 22; i++) {
        const r = hash2(tx * 7 + i, ty * 5, 9);
        m.fillStyle = r > 0.66 ? shade(W.a, 0.35) : (r > 0.33 ? shade(W.a, -0.25) : shade(W.a, 0.15));
        m.fillRect(px + ((hash2(tx, ty, i + 3) * 15) | 0), py + ((hash2(tx, ty, i + 60) * 15) | 0), 2, 2);
      }
    } else {
      const h = hash2(tx, ty, 3);
      if (h > 0.7) { m.fillStyle = shade(W.a, 0.08); m.fillRect(px + 3, py + 4, 6, 1); }
    }
    const up = this.isWall(tx, ty - 1), dn = this.isWall(tx, ty + 1), lf = this.isWall(tx - 1, ty), rt = this.isWall(tx + 1, ty);
    if (!dn) { m.fillStyle = W.face; m.fillRect(px, py + TILE - 5, TILE, 5); m.fillStyle = shade(W.face, 0.2); m.fillRect(px, py + TILE - 5, TILE, 1); m.fillStyle = '#000'; m.fillRect(px, py + TILE - 1, TILE, 1); }
    if (!up) { m.fillStyle = W.top; m.fillRect(px, py, TILE, 2); }
    if (!lf) { m.fillStyle = W.top; m.fillRect(px, py, 1, TILE - (dn ? 0 : 5)); }
    if (!rt) { m.fillStyle = shade(W.a, -0.4); m.fillRect(px + TILE - 1, py, 1, TILE); }
    if (W.trim && !dn) { m.fillStyle = W.trim; m.fillRect(px, py + TILE - 6, TILE, 1); }
  }

  drawFloor(m, F, tx, ty, px, py) {
    const a = F.a, b = F.b;
    const h = (i) => hash2(tx, ty, i);
    m.fillStyle = a; m.fillRect(px, py, TILE, TILE);
    switch (F.k) {
      case 'concrete':
      case 'asphalt': {
        m.fillStyle = b;
        const n = F.k === 'asphalt' ? 14 : 7;
        for (let i = 0; i < n; i++) m.fillRect(px + ((h(i) * 16) | 0), py + ((h(i + 40) * 16) | 0), 1, 1);
        m.fillStyle = shade(a, 0.12);
        for (let i = 0; i < 3; i++) m.fillRect(px + ((h(i + 80) * 16) | 0), py + ((h(i + 90) * 16) | 0), 1, 1);
        if (h(7) > 0.93) { m.fillStyle = shade(a, -0.3); m.fillRect(px + 3, py + 8, 7, 1); m.fillRect(px + 9, py + 9, 4, 1); }
        if (F.lane && ty % 1 === 0 && h(9) > 0.0 && (tx % 4 === 0) && F.laneRow && F.laneRow.includes(ty)) { m.fillStyle = '#b8a040'; m.fillRect(px + 2, py + 7, 10, 2); }
        if (F.laneCol && F.laneCol.includes(tx) && ty % 4 === 0) { m.fillStyle = '#b8a040'; m.fillRect(px + 7, py + 2, 2, 10); }
        break;
      }
      case 'carpet':
        m.fillStyle = b;
        for (let y = 0; y < 16; y += 2) for (let x = (y / 2) % 2 ? 1 : 0; x < 16; x += 4) m.fillRect(px + x, py + y, 1, 1);
        break;
      case 'tiles':
        m.fillStyle = b; m.fillRect(px, py, 8, 8); m.fillRect(px + 8, py + 8, 8, 8);
        m.fillStyle = shade(a, -0.3); m.fillRect(px, py + 15, 16, 1); m.fillRect(px + 15, py, 1, 16);
        m.fillStyle = shade(a, 0.15); m.fillRect(px + 1, py + 1, 2, 1);
        break;
      case 'wood':
        for (let r = 0; r < 4; r++) {
          m.fillStyle = hash2(tx, ty * 4 + r, 2) > 0.5 ? a : b; m.fillRect(px, py + r * 4, 16, 4);
          m.fillStyle = shade(a, -0.35); m.fillRect(px, py + r * 4 + 3, 16, 1);
          const off = ((hash2(tx, ty * 4 + r, 5) * 16) | 0);
          m.fillRect(px + off, py + r * 4, 1, 3);
        }
        break;
      case 'brick':
        for (let r = 0; r < 4; r++) {
          const off = ((ty * 4 + r) % 2) * 4;
          for (let bx = -1; bx < 3; bx++) {
            const xx = px + off + bx * 8;
            m.fillStyle = hash2(tx * 3 + bx, ty * 4 + r, 1) > 0.5 ? a : b;
            const x0 = Math.max(px, xx), x1 = Math.min(px + 16, xx + 7);
            if (x1 > x0) m.fillRect(x0, py + r * 4, x1 - x0, 3);
          }
        }
        m.fillStyle = shade(a, -0.45);
        for (let r = 0; r < 4; r++) m.fillRect(px, py + r * 4 + 3, 16, 1);
        break;
      case 'sidewalk':
        m.fillStyle = shade(a, -0.25); m.fillRect(px, py + 15, 16, 1); m.fillRect(px + 15, py, 1, 16);
        m.fillStyle = b; for (let i = 0; i < 4; i++) m.fillRect(px + ((h(i) * 15) | 0), py + ((h(i + 9) * 15) | 0), 1, 1);
        break;
      case 'alley':
        m.fillStyle = b;
        for (let i = 0; i < 10; i++) m.fillRect(px + ((h(i) * 15) | 0), py + ((h(i + 20) * 15) | 0), 2, 1);
        if (h(50) > 0.9) { m.fillStyle = 'rgba(70,90,140,0.45)'; m.fillRect(px + 3, py + 5, 9, 5); m.fillRect(px + 5, py + 4, 5, 7); }
        if (h(51) > 0.92) { m.fillStyle = '#3a3628'; m.fillRect(px + 9, py + 2, 3, 2); }
        break;
      case 'hotelcarpet':
        m.fillStyle = b;
        m.fillRect(px + 7, py + 2, 2, 1); m.fillRect(px + 6, py + 3, 4, 1); m.fillRect(px + 5, py + 4, 6, 1);
        m.fillRect(px + 6, py + 5, 4, 1); m.fillRect(px + 7, py + 6, 2, 1);
        m.fillStyle = shade(a, -0.25); m.fillRect(px, py + 11, 16, 1); m.fillRect(px, py + 13, 16, 1);
        break;
      case 'marble': {
        if ((tx + ty) % 2) { m.fillStyle = b; m.fillRect(px, py, 16, 16); }
        m.fillStyle = shade(a, 0.18);
        let x = (h(1) * 16) | 0;
        for (let y = 0; y < 16; y++) { x += h(y + 30) > 0.5 ? 1 : -1; if (x >= 0 && x < 16 && h(y + 60) > 0.3) m.fillRect(px + x, py + y, 1, 1); }
        m.fillStyle = shade(a, -0.2); m.fillRect(px, py + 15, 16, 1); m.fillRect(px + 15, py, 1, 16);
        break;
      }
      case 'metal':
        m.fillStyle = b;
        for (let y = 1; y < 16; y += 4) for (let x = ((y >> 2) % 2) * 2 + 1; x < 16; x += 4) { m.fillRect(px + x, py + y, 2, 1); }
        m.fillStyle = shade(a, -0.35); m.fillRect(px, py + 15, 16, 1); m.fillRect(px + 15, py, 1, 16);
        if (h(3) > 0.9) { m.fillStyle = 'rgba(20,16,10,0.5)'; m.fillRect(px + 4, py + 5, 7, 5); }
        break;
      case 'grass':
        for (let i = 0; i < 16; i++) {
          m.fillStyle = h(i) > 0.5 ? b : shade(a, -0.2);
          m.fillRect(px + ((h(i + 20) * 16) | 0), py + ((h(i + 40) * 15) | 0), 1, 2);
        }
        if (h(70) > 0.93) { m.fillStyle = pick(['#e04060', '#f0e040', '#ffffff']); m.fillRect(px + 7, py + 7, 2, 2); }
        break;
      case 'dance':
        m.fillStyle = '#120e18'; m.fillRect(px, py, 16, 16);
        m.fillStyle = '#2a2236'; m.fillRect(px, py + 15, 16, 1); m.fillRect(px + 15, py, 1, 16); m.fillRect(px, py + 7, 16, 1); m.fillRect(px + 7, py, 1, 16);
        break;
    }
  }

  // objetos sólidos: desenhados por componente conectado
  drawProps(m) {
    const T = this.theme;
    const seen = new Uint8Array(this.w * this.h);
    for (let ty = 0; ty < this.h; ty++) {
      for (let tx = 0; tx < this.w; tx++) {
        const i = ty * this.w + tx;
        const c = this.chars[ty][tx];
        if (seen[i] || this.grid[i] !== 2) continue;
        // componente
        let x0 = tx, x1 = tx, y0 = ty, y1 = ty;
        const st = [[tx, ty]]; seen[i] = 1; const cells = [];
        while (st.length) {
          const [cx, cy] = st.pop(); cells.push([cx, cy]);
          x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
            const ni = ny * this.w + nx;
            if (!seen[ni] && this.chars[ny][nx] === c) { seen[ni] = 1; st.push([nx, ny]); }
          }
        }
        const P = T.props[c] || { k: 'crate', a: '#6a4a2a' };
        if (P.k === 'crate' || P.k === 'dumpster' || P.k === 'plant') {
          for (const [cx, cy] of cells) this.drawProp(m, P, cx * TILE, cy * TILE, TILE, TILE, cx, cy);
        } else {
          this.drawProp(m, P, x0 * TILE, y0 * TILE, (x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE, x0, y0);
        }
      }
    }
  }
  drawProp(m, P, x, y, w, h, tx, ty) {
    const O = '#07070a';
    const a = P.a || '#555';
    const sh = (dx, dy) => { m.fillStyle = 'rgba(0,0,0,0.35)'; m.fillRect(x + dx, y + dy, w, h); };
    switch (P.k) {
      case 'crate':
        sh(2, 2);
        m.fillStyle = O; m.fillRect(x, y, w, h);
        m.fillStyle = a; m.fillRect(x + 1, y + 1, w - 2, h - 2);
        m.fillStyle = shade(a, 0.2); m.fillRect(x + 1, y + 1, w - 2, 1);
        m.fillStyle = shade(a, -0.3); m.fillRect(x + 2, y + 5, w - 4, 1); m.fillRect(x + 2, y + 10, w - 4, 1);
        m.fillRect(x + 3, y + 2, 1, h - 4); m.fillRect(x + w - 4, y + 2, 1, h - 4);
        break;
      case 'dumpster':
        sh(2, 2);
        m.fillStyle = O; m.fillRect(x, y, w, h);
        m.fillStyle = a; m.fillRect(x + 1, y + 1, w - 2, h - 2);
        m.fillStyle = shade(a, -0.3); m.fillRect(x + 1, y + 7, w - 2, 2);
        m.fillStyle = shade(a, 0.25); m.fillRect(x + 1, y + 1, w - 2, 1);
        break;
      case 'plant':
        Sprites.E(m, 'rgba(0,0,0,0.35)', x + 9, y + 9, 6, 6);
        Sprites.E(m, O, x + 8, y + 8, 5, 5); Sprites.E(m, '#5a3a22', x + 8, y + 8, 4, 4);
        Sprites.E(m, '#1e5a2a', x + 8, y + 8, 6, 3); Sprites.E(m, '#2a7a38', x + 8, y + 8, 3, 6);
        Sprites.E(m, '#3a9a48', x + 7, y + 7, 2, 2);
        break;
      case 'desk': case 'bar': case 'rack': {
        sh(2, 3);
        m.fillStyle = O; m.fillRect(x, y, w, h);
        m.fillStyle = a; m.fillRect(x + 1, y + 1, w - 2, h - 2);
        m.fillStyle = shade(a, 0.25); m.fillRect(x + 1, y + 1, w - 2, 2);
        m.fillStyle = shade(a, -0.3); m.fillRect(x + 1, y + h - 3, w - 2, 2);
        const horiz = w >= h;
        const n = Math.floor((horiz ? w : h) / 6);
        for (let i = 0; i < n; i++) {
          const r = hash2(tx + i, ty, 4);
          const ix = horiz ? x + 3 + i * 6 : x + 4 + ((r * 6) | 0);
          const iy = horiz ? y + 4 + ((r * 5) | 0) : y + 3 + i * 6;
          if (P.k === 'bar') {
            m.fillStyle = pick(['#38d070', '#d04848', '#e0c040', '#60a0ff', '#e070e0']);
            m.fillRect(ix, iy, 2, 2); m.fillStyle = '#fff'; m.fillRect(ix, iy, 1, 1);
          } else if (P.k === 'desk' && r > 0.45) {
            m.fillStyle = '#111'; m.fillRect(ix, iy, 4, 3); m.fillStyle = '#4ab0ff'; m.fillRect(ix + 1, iy + 1, 2, 1);
          } else if (P.k === 'rack') {
            m.fillStyle = '#111'; m.fillRect(ix, iy, 3, 3); m.fillStyle = r > 0.5 ? '#40ff70' : '#ff4040'; m.fillRect(ix + 1, iy + 1, 1, 1);
          } else if (r > 0.75) {
            m.fillStyle = '#e8e4d8'; m.fillRect(ix, iy, 4, 3);
          }
        }
        break;
      }
      case 'sofa': {
        sh(2, 2);
        m.fillStyle = O; m.fillRect(x, y, w, h);
        m.fillStyle = shade(a, -0.25); m.fillRect(x + 1, y + 1, w - 2, h - 2);
        const horiz = w >= h;
        if (horiz) {
          m.fillStyle = shade(a, -0.4); m.fillRect(x + 1, y + 1, w - 2, 4);
          for (let i = 0; i < w / 16; i++) { m.fillStyle = a; m.fillRect(x + i * 16 + 2, y + 5, 12, h - 7); m.fillStyle = shade(a, 0.2); m.fillRect(x + i * 16 + 2, y + 5, 12, 1); }
        } else {
          m.fillStyle = shade(a, -0.4); m.fillRect(x + w - 5, y + 1, 4, h - 2);
          for (let i = 0; i < h / 16; i++) { m.fillStyle = a; m.fillRect(x + 2, y + i * 16 + 2, w - 7, 12); m.fillStyle = shade(a, 0.2); m.fillRect(x + 2, y + i * 16 + 2, w - 7, 1); }
        }
        break;
      }
      case 'bed':
        sh(2, 2);
        m.fillStyle = O; m.fillRect(x, y, w, h);
        m.fillStyle = '#4a2c1a'; m.fillRect(x + 1, y + 1, w - 2, h - 2);
        m.fillStyle = '#e4e2ea'; m.fillRect(x + 2, y + 2, w - 4, h - 4);
        m.fillStyle = '#ffffff'; m.fillRect(x + 3, y + 3, w - 6, 5);
        m.fillStyle = a; m.fillRect(x + 2, y + 11, w - 4, h - 13);
        m.fillStyle = shade(a, 0.2); m.fillRect(x + 2, y + 11, w - 4, 1);
        break;
      case 'table':
        sh(2, 2);
        m.fillStyle = O; m.fillRect(x, y, w, h);
        m.fillStyle = a; m.fillRect(x + 1, y + 1, w - 2, h - 2);
        m.fillStyle = shade(a, 0.2); m.fillRect(x + 2, y + 2, w - 4, 1); m.fillRect(x + 2, y + 2, 1, h - 4);
        m.fillStyle = shade(a, -0.25); m.fillRect(x + 2, y + h - 3, w - 4, 1);
        if (hash2(tx, ty, 8) > 0.4) { m.fillStyle = '#e8e4d8'; m.fillRect(x + w / 2 - 2, y + h / 2 - 1, 4, 3); }
        break;
      case 'pillar':
        sh(3, 3);
        m.fillStyle = O; m.fillRect(x, y, w, h);
        m.fillStyle = a; m.fillRect(x + 1, y + 1, w - 2, h - 2);
        m.fillStyle = shade(a, 0.3); m.fillRect(x + 1, y + 1, w - 2, 2); m.fillRect(x + 1, y + 1, 2, h - 2);
        m.fillStyle = shade(a, -0.35); m.fillRect(x + 1, y + h - 3, w - 2, 2); m.fillRect(x + w - 3, y + 1, 2, h - 2);
        m.fillStyle = shade(a, 0.1); m.fillRect(x + 5, y + 5, w - 10, h - 10);
        break;
      case 'container': {
        const cols = ['#8a2a1e', '#1e4a7a', '#2a6a3a', '#a07018', '#5a2a6a', '#4a4e56'];
        const col = cols[(hash2(tx, ty, 13) * cols.length) | 0];
        sh(3, 3);
        m.fillStyle = O; m.fillRect(x, y, w, h);
        m.fillStyle = col; m.fillRect(x + 1, y + 1, w - 2, h - 2);
        m.fillStyle = shade(col, -0.3);
        if (w >= h) for (let i = x + 3; i < x + w - 2; i += 3) m.fillRect(i, y + 2, 1, h - 4);
        else for (let i = y + 3; i < y + h - 2; i += 3) m.fillRect(x + 2, i, w - 4, 1);
        m.fillStyle = shade(col, 0.3); m.fillRect(x + 1, y + 1, w - 2, 1);
        m.fillStyle = '#d8d8d8'; m.fillRect(x + 3, y + 3, 4, 2);
        break;
      }
      case 'train': {
        sh(3, 3);
        m.fillStyle = O; m.fillRect(x, y, w, h);
        m.fillStyle = '#9aa0a8'; m.fillRect(x + 1, y + 1, w - 2, h - 2);
        m.fillStyle = '#c8ccd2'; m.fillRect(x + 1, y + 1, w - 2, 3);
        m.fillStyle = '#c02a2a'; m.fillRect(x + 1, y + h - 5, w - 2, 2);
        m.fillStyle = '#1a2a40';
        for (let i = x + 4; i < x + w - 8; i += 12) m.fillRect(i, y + 6, 7, h - 13 > 3 ? h - 13 : 4);
        m.fillStyle = '#5a6068';
        for (let i = x + 13; i < x + w - 4; i += 24) m.fillRect(i, y + 1, 2, h - 2);
        break;
      }
      case 'slot': {
        sh(2, 2);
        m.fillStyle = O; m.fillRect(x, y, w, h);
        const horiz = w >= h, n = (horiz ? w : h) / 8;
        for (let i = 0; i < n; i++) {
          const bx = horiz ? x + i * 8 : x, by = horiz ? y : y + i * 8;
          const bw = horiz ? 8 : w, bh = horiz ? h : 8;
          m.fillStyle = shade(a, (i % 2) * 0.15); m.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
          m.fillStyle = pick(['#ff2a8a', '#29c8ff', '#ffd040', '#40ff90']); m.fillRect(bx + 2, by + 3, 4, 3);
          m.fillStyle = '#ffffff'; m.fillRect(bx + 3, by + 4, 1, 1);
        }
        break;
      }
      case 'pedestal': {
        sh(2, 3);
        m.fillStyle = O; m.fillRect(x + 1, y + 1, w - 2, h - 2);
        m.fillStyle = a; m.fillRect(x + 2, y + 2, w - 4, h - 4);
        m.fillStyle = shade(a, -0.25); m.fillRect(x + 2, y + h - 4, w - 4, 2);
        const art = ['#e02a4a', '#2a8aff', '#ffd040', '#40c070', '#a040ff'][(hash2(tx, ty, 5) * 5) | 0];
        Sprites.E(m, O, x + w / 2, y + h / 2 - 1, 3.5, 3.5); Sprites.E(m, art, x + w / 2, y + h / 2 - 1, 2.5, 2.5);
        m.fillStyle = '#fff'; m.fillRect(x + w / 2 - 1, y + h / 2 - 3, 1, 1);
        break;
      }
      case 'fountain': {
        sh(3, 3);
        Sprites.E(m, O, x + w / 2, y + h / 2, w / 2, h / 2);
        Sprites.E(m, a, x + w / 2, y + h / 2, w / 2 - 1, h / 2 - 1);
        Sprites.E(m, '#2a5a9a', x + w / 2, y + h / 2, w / 2 - 4, h / 2 - 4);
        Sprites.E(m, '#5aa0e0', x + w / 2 - 3, y + h / 2 - 3, w / 5, h / 6);
        Sprites.E(m, a, x + w / 2, y + h / 2, 3, 3);
        break;
      }
      case 'car': {
        const cols = ['#8a1c24', '#1e3c6e', '#2a2a30', '#c8c8cc', '#3a5a2a', '#a07018'];
        const col = cols[(hash2(tx, ty, 11) * cols.length) | 0];
        const horiz = w >= h;
        sh(3, 3);
        m.fillStyle = O; m.fillRect(x + 1, y, w - 2, h); m.fillRect(x, y + 1, w, h - 2);
        m.fillStyle = col; m.fillRect(x + 1, y + 1, w - 2, h - 2);
        m.fillStyle = shade(col, 0.25); m.fillRect(x + 2, y + 1, w - 4, 1);
        if (horiz) {
          m.fillStyle = '#1a2a40'; m.fillRect(x + w * 0.28, y + 3, 4, h - 6); m.fillRect(x + w * 0.68, y + 3, 3, h - 6);
          m.fillStyle = shade(col, -0.2); m.fillRect(x + w * 0.28 + 4, y + 3, w * 0.4 - 4, h - 6);
          m.fillStyle = '#ffe9a0'; m.fillRect(x + w - 2, y + 2, 1, 3); m.fillRect(x + w - 2, y + h - 5, 1, 3);
          m.fillStyle = '#c02020'; m.fillRect(x + 1, y + 2, 1, 3); m.fillRect(x + 1, y + h - 5, 1, 3);
        } else {
          m.fillStyle = '#1a2a40'; m.fillRect(x + 3, y + h * 0.28, w - 6, 4); m.fillRect(x + 3, y + h * 0.68, w - 6, 3);
          m.fillStyle = shade(col, -0.2); m.fillRect(x + 3, y + h * 0.28 + 4, w - 6, h * 0.4 - 4);
          m.fillStyle = '#ffe9a0'; m.fillRect(x + 2, y + 1, 3, 1); m.fillRect(x + w - 5, y + 1, 3, 1);
          m.fillStyle = '#c02020'; m.fillRect(x + 2, y + h - 2, 3, 1); m.fillRect(x + w - 5, y + h - 2, 3, 1);
        }
        break;
      }
    }
  }

  buildLights() {
    const T = this.theme;
    // mapa de luz (multiplicação) e brilho (aditivo) em meia resolução para economizar memória
    const S = 2;
    const [lc, l] = makeCanvas(this.pw / S, this.ph / S);
    l.imageSmoothingEnabled = true;
    l.fillStyle = T.ambient; l.fillRect(0, 0, lc.width, lc.height);
    l.globalCompositeOperation = 'lighter';
    const [gc, g] = makeCanvas(this.pw / S, this.ph / S);
    g.globalCompositeOperation = 'lighter';
    for (const li of this.spawn.lights) {
      const col = T.lights[li.c];
      const r = (T.lightR || 90) / S;
      const x = li.x / S, y = li.y / S;
      let grd = l.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, rgba(col, 0.95)); grd.addColorStop(0.5, rgba(col, 0.35)); grd.addColorStop(1, rgba(col, 0));
      l.fillStyle = grd; l.fillRect(x - r, y - r, r * 2, r * 2);
      grd = l.createRadialGradient(x, y, 0, x, y, r * 0.5);
      grd.addColorStop(0, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      l.fillStyle = grd; l.fillRect(x - r, y - r, r * 2, r * 2);
      const gr = r * 0.8;
      grd = g.createRadialGradient(x, y, 0, x, y, gr);
      grd.addColorStop(0, rgba(col, 0.55)); grd.addColorStop(1, rgba(col, 0));
      g.fillStyle = grd; g.fillRect(x - gr, y - gr, gr * 2, gr * 2);
    }
    this.lightCanvas = lc; this.glowCanvas = gc; this.lightScale = S;
    if (this.quality === 0) {
      // qualidade baixa: ilumina o mapa uma única vez (sem custo por quadro)
      const m = this.mapCtx;
      m.save(); m.imageSmoothingEnabled = true; m.globalCompositeOperation = 'multiply';
      m.drawImage(lc, 0, 0, this.pw, this.ph); m.restore();
    }
  }

  // pinta manchas permanentes (sangue, cápsulas, marcas de explosão) no chão
  stamp(fn) {
    const m = this.mapCtx;
    m.save(); fn(m); m.restore();
  }
}
