// =====================================================================
// THE LAST CONTRACT — núcleo do jogo: loop, estados, câmera, renderização,
// HUD, pontuação/avaliação, interface de menus e salvamento.
// =====================================================================
'use strict';

const Game = {
  canvas: null, ctx: null, vw: 480, vh: 270, scale: 4, dpr: 1,
  state: 'menu', levelIndex: 0, level: null, world: null, player: null,
  enemies: [], bullets: [], particles: [], items: [], barrels: [], corpses: [], texts: [], flashes: [], timers: [],
  stamps: [],
  cam: { x: 0, y: 0 }, shakeAmt: 0, time: 0, hitstopT: 0,
  stats: null, score: 0, combo: 0, comboT: 0, lastKill: -9,
  exitOpen: false, titleT: 0, toasts: [], deadT: 0, completeT: 0, boss: null, bossT: 0,
  menuWorld: null, menuT: 0,
};

// ---------------------------------------------------------------------
// INICIALIZAÇÃO E REDIMENSIONAMENTO
// ---------------------------------------------------------------------
Game.init = function () {
  Save.load();
  if (!Save.data.v2) {
    // v1 tinha 5 fases (chefe = fase 5). Agora o chefe é a fase 15.
    const b = Save.data.best;
    if (b[5]) { b[15] = b[5]; delete b[5]; }
    Save.data.unlocked = Math.min(Save.data.unlocked, 5);
    Save.data.v2 = true; Save.write();
  }
  const s = Save.data.settings;
  AudioSys.setVolumes(s.master, s.music, s.sfx);
  this.canvas = document.getElementById('game');
  this.ctx = this.canvas.getContext('2d', { alpha: false });
  Input.attach(this.canvas);
  this.resize();
  window.addEventListener('resize', () => this.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
  // cria o ambiente de fundo do menu (boate)
  this.menuWorld = new World(LEVELS[1], THEMES.club, 1);
  this.buildGlowSprites();
  Sprites.warm(['player']);
  UI.init();
  UI.show('menu');
  // libera o áudio no primeiro toque/clique (exigência dos navegadores)
  const unlock = () => { AudioSys.init(); AudioSys.setVolumes(s.master, s.music, s.sfx); if (this.state === 'menu') AudioSys.playMusic('menu'); };
  window.addEventListener('pointerdown', unlock, { once: false });
  window.addEventListener('keydown', unlock, { once: false });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.Capacitor) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  let last = performance.now();
  const loop = (t) => {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    this.frame(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
};

Game.resize = function () {
  const dpr = window.devicePixelRatio || 1;
  const pw = Math.round(window.innerWidth * dpr), ph = Math.round(window.innerHeight * dpr);
  let scale = Math.max(1, Math.round(ph / 265));
  while (scale > 1 && pw / scale < 380) scale--;
  this.scale = scale; this.dpr = dpr;
  this.canvas.width = Math.floor(pw / scale);
  this.canvas.height = Math.floor(ph / scale);
  this.vw = this.canvas.width; this.vh = this.canvas.height;
  this.ctx.imageSmoothingEnabled = false;
  Input.computeLayout(this.vw, this.vh, dpr / scale);
};

Game.buildGlowSprites = function () {
  const mk = (col, r) => {
    const [c, x] = makeCanvas(r * 2, r * 2);
    const g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, rgba(col, 0.9)); g.addColorStop(0.35, rgba(col, 0.35)); g.addColorStop(1, rgba(col, 0));
    x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2);
    return c;
  };
  this.glowMuzzle = mk('#ffb040', 40);
  this.glowBlast = mk('#ff6a20', 90);
  this.glowRed = mk('#ff2040', 30);
};

// ---------------------------------------------------------------------
// FASES
// ---------------------------------------------------------------------
Game.startLevel = function (i) {
  this.levelIndex = i;
  const L = LEVELS[i];
  const theme = THEMES[L.theme];
  this.level = L; this.theme = theme;
  this.world = new World(L, theme, Save.data.settings.quality);
  const sp = this.world.spawn;
  this.player = new Player(sp.player.x, sp.player.y);
  if (Save.data.pencil) this.player.guns.pencil = { mag: 0, reserve: 0 };
  this.dog = new Dog(sp.player.x - 12, sp.player.y + 4);
  this.world.pushOut(this.dog, this.dog.r);
  this.dogKills = 0; this.dogCand = null; this.dogCandT = 0; this.legendT = 0;
  this.finZoom = 0; this.finFx = null; this.finFlash = 0; this.finText = 0;
  this.enemies = []; this.bullets.length = 0; this.particles.length = 0; this.items = []; this.barrels = [];
  this.corpses = []; this.texts = []; this.flashes = []; this.timers = []; this.toasts = []; this.stamps = [];
  const pals = new Set(['player']);
  this.boss = null;
  for (const e of sp.enemies) {
    let en;
    if (e.t === 'B') { en = new Boss(e.x, e.y); this.boss = en; }
    else en = new Enemy(e.t, e.x, e.y, theme.enemyPal[e.t]);
    pals.add(en.pal);
    this.enemies.push(en);
  }
  ['elite', 'rifleman'].forEach((p) => pals.add(p));
  const map = { '1': 'pistol', '2': 'shotgun', '3': 'rifle', '4': 'knife', '5': 'pencil', 'a': 'ammo', '+': 'medkit' };
  for (const it of sp.items) if (!(it.t === '5' && Save.data.pencil)) this.addItem(map[it.t], it.x, it.y, it.t === '1' ? 12 : it.t === '2' ? 6 : it.t === '3' ? 30 : 0, true);
  for (const b of sp.barrels) this.barrels.push(new Barrel(b.x, b.y));
  Sprites.warm([...pals]);
  this.stats = { kills: 0, shots: 0, hits: 0, damage: 0, maxCombo: 0, melee: 0, total: this.enemies.length };
  this.score = 0; this.combo = 0; this.comboT = 0; this.lastKill = -9;
  this.time = 0; this.exitOpen = false; this.titleT = 3.2; this.deadT = 0; this.completeT = 0; this.bossT = 0;
  this.cam.x = this.player.x - this.vw / 2; this.cam.y = this.player.y - this.vh / 2;
  this.shakeAmt = 0;
  Input.clearEdges(); Input.resetTouch();
  this.state = 'playing';
  UI.hideAll();
  AudioSys.playMusic(L.music);
  this.tryFullscreen();
};

Game.tryFullscreen = function () {
  if (Input.state.device !== 'touch') return;
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) {
    el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
    }).catch(() => {});
  }
};

// ---------------------------------------------------------------------
// LOOP PRINCIPAL
// ---------------------------------------------------------------------
Game.frame = function (dt) {
  Input.update();
  if (this.state === 'playing') {
    if (Input.consume('pause')) { this.pause(); }
    else {
      let sdt = dt;
      if (this.hitstopT > 0) { this.hitstopT -= dt; sdt = dt * 0.08; }
      if (this.completeT > 0) sdt *= 0.35; // câmera lenta após o chefe
      this.update(sdt, dt);
    }
    this.render();
  } else if (this.state === 'paused' || this.state === 'over' || this.state === 'results') {
    this.render();
    UI.navUpdate();
  } else {
    this.renderMenuBg(dt);
    UI.navUpdate();
  }
  // as bordas (toques rápidos) são consumidas por quadro
  Input.clearEdges();
};

Game.update = function (dt, realDt) {
  const p = this.player, w = this.world;
  this.time += dt;
  if (this.titleT > 0) this.titleT -= realDt;
  for (const t of this.toasts) t.t -= realDt;
  this.toasts = this.toasts.filter((t) => t.t > 0);

  if (p.alive) p.update(dt, Input.state);
  else {
    this.deadT += realDt;
    if (this.deadT > 1.6 && this.state === 'playing') this.gameOver();
  }
  for (const e of this.enemies) if (e.alive) e.update(dt);
  // cão
  if (Input.consume('dog') && p.alive) this.commandDog();
  this.dog.update(dt);
  this.dogCandT -= dt;
  if (this.dogCandT <= 0) { this.dogCandT = 0.15; this.dogCand = this.dogKills >= 3 ? this.findDogTarget() : null; }
  // efeitos de finalização
  this.finZoom += ((p.fin ? 1 : 0) - this.finZoom) * Math.min(1, realDt * (p.fin ? 10 : 5));
  if (this.finFlash > 0) this.finFlash -= realDt * 3;
  if (this.finText > 0) this.finText -= realDt;
  if (this.legendT > 0) this.legendT -= realDt;
  this.separate();
  this.updateBullets(dt);
  this.updateParticles(dt);
  this.updateCorpses(dt);
  // itens
  for (const it of this.items) {
    if (!it.alive) continue;
    it.bob += dt;
    if (p.alive && dist2(p.x, p.y, it.x, it.y) < 13 * 13) this.collect(it);
  }
  this.items = this.items.filter((i) => i.alive);
  for (const b of this.barrels) b.flashT -= dt;
  this.barrels = this.barrels.filter((b) => b.alive);
  // temporizadores
  for (const t of this.timers) { t.t -= dt; if (t.t <= 0 && !t.done) { t.done = true; t.fn(); } }
  this.timers = this.timers.filter((t) => !t.done);
  for (const f of this.flashes) f.t -= dt;
  this.flashes = this.flashes.filter((f) => f.t > 0);
  for (const t of this.texts) { t.t -= dt; t.y -= 14 * dt; }
  this.texts = this.texts.filter((t) => t.t > 0);
  // combo
  if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
  // saída
  if (this.exitOpen && p.alive) {
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    if (w.spawn.exits.some((e) => e.x === tx && e.y === ty)) this.completeLevel();
  }
  if (this.completeT > 0) { this.completeT -= realDt; if (this.completeT <= 0) this.completeLevel(); }
  if (this.boss) this.bossT += realDt;
  this.flushStamps();
  this.updateCamera(realDt);
};

Game.separate = function () {
  const es = this.enemies, p = this.player;
  for (let i = 0; i < es.length; i++) {
    const a = es[i]; if (!a.alive || a.state === 'down') continue;
    for (let j = i + 1; j < es.length; j++) {
      const b = es[j]; if (!b.alive || b.state === 'down') continue;
      const dx = b.x - a.x, dy = b.y - a.y, r = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r && d2 > 0.01) {
        const d = Math.sqrt(d2), push = (r - d) / 2;
        a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push;
        this.world.pushOut(a, a.r); this.world.pushOut(b, b.r);
      }
    }
    if (p.alive && p.dodgeT <= 0) {
      const dx = p.x - a.x, dy = p.y - a.y, r = a.r + p.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r && d2 > 0.01) {
        const d = Math.sqrt(d2), push = (r - d) / 2;
        p.x += dx / d * push; p.y += dy / d * push; a.x -= dx / d * push; a.y -= dy / d * push;
        this.world.pushOut(p, p.r); this.world.pushOut(a, a.r);
      }
    }
  }
  // barris como obstáculos
  for (const b of this.barrels) {
    for (const e of [p, ...es]) {
      if (!e.alive) continue;
      const dx = e.x - b.x, dy = e.y - b.y, r = b.r + e.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r && d2 > 0.01) { const d = Math.sqrt(d2); e.x += dx / d * (r - d); e.y += dy / d * (r - d); }
    }
  }
};

Game.updateCamera = function (dt) {
  const p = this.player;
  let lx = 0, ly = 0;
  const inp = Input.state;
  if (p.alive) {
    if (inp.aimMode === 'mouse' && inp.device === 'kb') {
      lx = clamp((inp.mouseX - this.vw / 2) * 0.3, -70, 70);
      ly = clamp((inp.mouseY - this.vh / 2) * 0.3, -50, 50);
    } else {
      lx = Math.cos(p.angle) * 36; ly = Math.sin(p.angle) * 26;
    }
  }
  const tx = p.x + lx - this.vw / 2, ty = p.y + ly - this.vh / 2;
  const k = 1 - Math.exp(-7 * dt);
  this.cam.x += (tx - this.cam.x) * k;
  this.cam.y += (ty - this.cam.y) * k;
  const w = this.world;
  if (w.pw > this.vw) this.cam.x = clamp(this.cam.x, -8, w.pw - this.vw + 8); else this.cam.x = (w.pw - this.vw) / 2;
  if (w.ph > this.vh) this.cam.y = clamp(this.cam.y, -8, w.ph - this.vh + 8); else this.cam.y = (w.ph - this.vh) / 2;
  this.shakeAmt = Math.max(0, this.shakeAmt - dt * 30);
};
Game.shake = function (a) { if (Save.data.settings.shake) this.shakeAmt = Math.min(12, Math.max(this.shakeAmt, a)); };
Game.hitstop = function (t) { this.hitstopT = Math.max(this.hitstopT, t); };
Game.toast = function (text, col) { this.toasts.push({ text, t: 1.8, col: col || '#ffffff' }); if (this.toasts.length > 3) this.toasts.shift(); };
Game.after = function (t, fn) { this.timers.push({ t, fn, done: false }); };

// ---------------------------------------------------------------------
// PROJÉTEIS
// ---------------------------------------------------------------------
Game.spawnBullet = function (x, y, a, speed, dmg, owner, range, kind) {
  let b = null;
  for (const o of this.bullets) if (!o.active) { b = o; break; }
  if (!b) { if (this.bullets.length > 700) return; b = {}; this.bullets.push(b); }
  b.active = true; b.x = x; b.y = y; b.px = x; b.py = y;
  b.vx = Math.cos(a) * speed; b.vy = Math.sin(a) * speed; b.a = a;
  b.dmg = dmg; b.owner = owner; b.range = range; b.trav = 0; b.kind = kind;
  // não nascer dentro da parede
  if (this.world.solidAt(x, y)) { b.active = false; this.sparks(x - Math.cos(a) * 3, y - Math.sin(a) * 3, a + Math.PI, 3); }
};
Game.updateBullets = function (dt) {
  const w = this.world, p = this.player;
  for (const b of this.bullets) {
    if (!b.active) continue;
    b.px = b.x; b.py = b.y;
    const sp = Math.hypot(b.vx, b.vy);
    const steps = Math.max(1, Math.ceil(sp * dt / 4));
    const sx = b.vx * dt / steps, sy = b.vy * dt / steps, sl = sp * dt / steps;
    for (let s = 0; s < steps && b.active; s++) {
      b.x += sx; b.y += sy; b.trav += sl;
      if (w.solidAt(b.x, b.y)) {
        b.active = false;
        this.sparks(b.x - sx, b.y - sy, b.a + Math.PI, 4);
        if (Math.random() < 0.25) AudioSys.sfx('ric', clamp(1 - dist(b.x, b.y, p.x, p.y) / 300, 0, 0.8));
        break;
      }
      for (const br of this.barrels) {
        if (br.alive && dist2(b.x, b.y, br.x, br.y) < br.r * br.r) { br.hurt(b.dmg); b.active = false; this.sparks(b.x, b.y, b.a + Math.PI, 3); break; }
      }
      if (!b.active) break;
      if (b.owner === 'player') {
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const r = e.r + 1.5;
          if (dist2(b.x, b.y, e.x, e.y) < r * r) {
            this.stats.hits++;
            e.hurt(b.dmg, b.a, b.kind);
            b.active = false; break;
          }
        }
      } else if (p.alive) {
        const r = p.r + 0.5;
        if (dist2(b.x, b.y, p.x, p.y) < r * r) {
          if (p.iframes > 0 && p.dodgeT > 0) continue; // esquiva atravessa o disparo
          if (p.hurt(b.dmg, b.a)) b.active = false;
        }
      }
      if (b.trav > b.range) b.active = false;
    }
  }
};

// ---------------------------------------------------------------------
// PARTÍCULAS, SANGUE E MARCAS
// ---------------------------------------------------------------------
Game.particle = function (x, y, vx, vy, life, color, size, drag, kind, stamp) {
  let o = null;
  for (const q of this.particles) if (!q.active) { o = q; break; }
  if (!o) { if (this.particles.length > (Save.data.settings.quality ? 500 : 250)) return; o = {}; this.particles.push(o); }
  o.active = true; o.x = x; o.y = y; o.vx = vx; o.vy = vy; o.life = life; o.max = life;
  o.color = color; o.size = size || 1; o.drag = drag === undefined ? 4 : drag; o.kind = kind || 'px'; o.stamp = !!stamp;
};
Game.updateParticles = function (dt) {
  for (const q of this.particles) {
    if (!q.active) continue;
    q.life -= dt;
    q.x += q.vx * dt; q.y += q.vy * dt;
    const f = Math.max(0, 1 - q.drag * dt);
    q.vx *= f; q.vy *= f;
    if (q.kind === 'smoke' || q.kind === 'fire') q.size += dt * 6;
    if (q.life <= 0) {
      q.active = false;
      if (q.stamp) this.stamps.push(q.x, q.y, q.color, q.kind === 'shell' ? 2 : q.size);
    } else if (q.stamp && q.kind === 'blood' && this.world.solidAt(q.x, q.y)) { q.active = false; }
  }
};
Game.flushStamps = function () {
  if (!this.stamps.length) return;
  const s = this.stamps, w = this.world;
  w.stamp((m) => {
    for (let i = 0; i < s.length; i += 4) {
      const x = s[i], y = s[i + 1];
      if (w.solidAt(x, y)) continue;
      m.fillStyle = s[i + 2];
      if (s[i + 3] === 2 && s[i + 2] === '#c8a038') m.fillRect(x | 0, y | 0, 2, 1);
      else m.fillRect(x | 0, y | 0, s[i + 3] | 0 || 1, s[i + 3] | 0 || 1);
    }
  });
  this.stamps.length = 0;
};
// pinta no chão recortando para não manchar paredes
Game.stampFloor = function (x, y, r, fn) {
  const w = this.world;
  w.stamp((m) => {
    m.beginPath();
    const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE), y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (w.tile(tx, ty) === 0) m.rect(tx * TILE, ty * TILE, TILE, TILE);
    m.clip();
    fn(m);
  });
};
Game.sparks = function (x, y, a, n) {
  for (let i = 0; i < n; i++) {
    const aa = a + rand(-0.9, 0.9), s = rand(40, 140);
    this.particle(x, y, Math.cos(aa) * s, Math.sin(aa) * s, rand(0.1, 0.25), pick(['#ffe080', '#ffb040', '#ffffff']), 1, 6);
  }
  this.particle(x, y, 0, 0, 0.3, '#5a5a66', 2, 0, 'smoke');
};
Game.blood = function (x, y, a, n) {
  for (let i = 0; i < n; i++) {
    const aa = a + rand(-0.6, 0.6), s = rand(30, 130);
    this.particle(x, y, Math.cos(aa) * s, Math.sin(aa) * s, rand(0.15, 0.4), pick(['#a00818', '#7a0410', '#c81020']), randi(1, 2), 5, 'blood', true);
  }
};
Game.bloodPool = function (x, y, r) {
  this.stampFloor(x, y, r + 6, (m) => {
    m.fillStyle = 'rgba(110,4,14,0.85)';
    for (let i = 0; i < 6; i++) {
      Sprites.E(m, i % 2 ? '#6a0410' : '#86081a', x + rand(-r * 0.5, r * 0.5), y + rand(-r * 0.5, r * 0.5), r * rand(0.4, 0.8), r * rand(0.35, 0.7));
    }
  });
};
Game.spawnDust = function (x, y, n) {
  for (let i = 0; i < n; i++) this.particle(x + rand(-4, 4), y + rand(-4, 4), rand(-20, 20), rand(-20, 20), rand(0.3, 0.5), '#4a4652', 2, 3, 'smoke');
};
Game.muzzle = function (x, y, a, s) {
  this.flashes.push({ x, y, a, t: 0.05, s: s || 1 });
  for (let i = 0; i < 3; i++) {
    const aa = a + rand(-0.3, 0.3), sp = rand(60, 160);
    this.particle(x, y, Math.cos(aa) * sp, Math.sin(aa) * sp, 0.08, '#fff2b0', 1, 8);
  }
  this.particle(x, y, Math.cos(a) * 20, Math.sin(a) * 20, 0.35, '#6a6670', 2, 2, 'smoke');
};
Game.shell = function (x, y, a) {
  const aa = a + Math.PI / 2 + rand(-0.3, 0.3), s = rand(40, 70);
  this.particle(x, y, Math.cos(aa) * s, Math.sin(aa) * s, rand(0.3, 0.5), '#c8a038', 2, 6, 'shell', true);
};
Game.explode = function (x, y) {
  AudioSys.sfx('explosion', clamp(1 - dist(x, y, this.player.x, this.player.y) / 600, 0.3, 1));
  this.shake(11); this.hitstop(0.05);
  this.flashes.push({ x, y, a: 0, t: 0.25, s: 4, blast: true });
  for (let i = 0; i < 28; i++) {
    const a = rand(0, TAU), s = rand(30, 180);
    this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.25, 0.6), pick(['#ffe070', '#ff8a20', '#ff4010']), rand(2, 4), 3, 'fire');
  }
  for (let i = 0; i < 18; i++) {
    const a = rand(0, TAU), s = rand(10, 70);
    this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.6, 1.2), pick(['#2a2a30', '#3a3a40', '#1a1a1e']), rand(3, 5), 2, 'smoke');
  }
  for (let i = 0; i < 10; i++) {
    const a = rand(0, TAU), s = rand(80, 220);
    this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 0.5), '#5a1a14', 2, 5, 'px', true);
  }
  this.stampFloor(x, y, 22, (m) => {
    Sprites.E(m, 'rgba(10,8,8,0.55)', x, y, 16, 14);
    Sprites.E(m, 'rgba(10,8,8,0.6)', x, y, 9, 8);
  });
  const R = 60;
  for (const e of this.enemies) {
    if (!e.alive) continue;
    const d = dist(x, y, e.x, e.y);
    if (d < R && this.world.los(x, y, e.x, e.y)) e.hurt(e.boss ? 160 * (1 - d / R) + 40 : 220 * (1 - d / (R + 20)), Math.atan2(e.y - y, e.x - x), 'explosion');
  }
  const p = this.player, dp = dist(x, y, p.x, p.y);
  if (p.alive && dp < R && this.world.los(x, y, p.x, p.y)) p.hurt(65 * (1 - dp / (R + 10)), Math.atan2(p.y - y, p.x - x));
  for (const b of this.barrels) if (b.alive && dist(x, y, b.x, b.y) < 52) this.after(0.12, () => b.hurt(99));
  this.noise(x, y, 460);
};
Game.noise = function (x, y, radius, src) {
  for (const e of this.enemies) {
    if (!e.alive || e === src) continue;
    const d = dist(x, y, e.x, e.y);
    const r = this.world.los(x, y, e.x, e.y) ? radius : radius * 0.6;
    if (d < r) e.hear(src ? this.player.x : x, src ? this.player.y : y);
  }
};

// ---------------------------------------------------------------------
// CORPOS, ITENS
// ---------------------------------------------------------------------
Game.addCorpse = function (x, y, a, pal, force) {
  this.corpses.push({ x, y, a, pal, vx: Math.cos(a) * force, vy: Math.sin(a) * force, r: 4, t: 0 });
};
Game.updateCorpses = function (dt) {
  for (const c of this.corpses) {
    c.t += dt;
    if (Math.abs(c.vx) + Math.abs(c.vy) > 2) {
      this.world.move(c, c.vx * dt, c.vy * dt, c.r);
      const f = Math.max(0, 1 - 7 * dt); c.vx *= f; c.vy *= f;
      if (Math.random() < 0.5) this.stamps.push(c.x + rand(-2, 2), c.y + rand(-2, 2), '#7a0410', 2);
    } else if (c.t > 0.6 && c.pal !== 'player') {
      // fixa o corpo no chão (desenho permanente, sem custo por quadro)
      const spr = Sprites.corpse(c.pal);
      this.world.stamp((m) => { m.translate(Math.round(c.x), Math.round(c.y)); m.rotate(c.a); m.drawImage(spr, -16, -16); });
      c.done = true;
    }
  }
  this.corpses = this.corpses.filter((c) => !c.done);
};
Game.addItem = function (type, x, y, ammo, placed) {
  this.items.push({ type, x: x + (placed ? 0 : rand(-3, 3)), y: y + (placed ? 0 : rand(-3, 3)), ammo, bob: rand(0, 6), alive: true });
};
Game.collect = function (it) {
  const p = this.player;
  const W = WEAPONS[it.type];
  if (it.type === 'medkit') {
    if (p.hp >= p.maxHp) return;
    p.hp = Math.min(p.maxHp, p.hp + 40); this.toast('+40 VIDA', '#60ff90'); AudioSys.sfx('heal');
  } else if (it.type === 'ammo') {
    for (const k in p.guns) { if (!WEAPONS[k].melee) p.guns[k].reserve = Math.min(WEAPONS[k].maxReserve, p.guns[k].reserve + WEAPONS[k].mag * 2); }
    this.toast('+ MUNIÇÃO', '#ffd060'); AudioSys.sfx('pickup');
  } else if (it.type === 'pencil') {
    p.guns.pencil = { mag: 0, reserve: 0 };
    Save.data.pencil = true; Save.write();
    p.select('pencil'); this.toasts = []; this.titleT = 0;
    this.legendT = 5; this.hitstop(0.25); this.shake(6);
    AudioSys.sfx('legend');
    for (let i = 0; i < 30; i++) { const a = rand(0, TAU), sp = rand(40, 160); this.particle(it.x, it.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.4, 0.9), pick(['#ffd040', '#fff2a0', '#ffffff']), 2, 3, 'fire'); }
  } else if (it.type === 'knife') {
    if (p.guns.knife) return;
    p.guns.knife = { mag: 0, reserve: 0 }; this.toast('+ FACA (tecla 4)', '#ffffff'); AudioSys.sfx('pickup');
  } else if (W) {
    const g = p.guns[it.type];
    if (!g) {
      p.guns[it.type] = { mag: Math.min(W.mag, it.ammo || W.mag), reserve: Math.max(0, (it.ammo || W.mag) - W.mag) + Math.floor(W.startReserve / 2) };
      p.select(it.type); this.toast('+ ' + W.name, '#ffffff'); AudioSys.sfx('pickup');
    } else {
      if (g.reserve >= W.maxReserve) return;
      g.reserve = Math.min(W.maxReserve, g.reserve + Math.max(2, it.ammo));
      this.toast(`+${Math.max(2, it.ammo)} ${W.name}`, '#ffd060'); AudioSys.sfx('pickup', 0.7);
    }
  }
  it.alive = false;
};

// ---------------------------------------------------------------------
// PONTUAÇÃO, OBJETIVOS E FIM DE FASE
// ---------------------------------------------------------------------
Game.onKill = function (e, src) {
  const s = this.stats;
  s.kills++;
  if (!e.boss && this.dogKills < 3) {
    this.dogKills++;
    if (this.dogKills === 3) { this.toast('CÃO PRONTO! ' + (Input.state.device === 'touch' ? 'TOQUE EM CÃO' : '[G]'), '#40ff90'); AudioSys.sfx('bark', 0.7); }
  }
  if (this.time - this.lastKill < 3.5) this.combo++; else this.combo = 1;
  this.lastKill = this.time; this.comboT = 3.5;
  s.maxCombo = Math.max(s.maxCombo, this.combo);
  let mult = 1, tag = '';
  if (src === 'knife' || src === 'punch') { mult = 1.5; tag = 'CORPO A CORPO'; s.melee++; }
  if (src === 'pencil') { mult = 2; tag = 'LÁPIS LENDÁRIO'; s.melee++; }
  if (src === 'exec') { mult = 2.5; tag = 'FINALIZAÇÃO'; s.melee++; s.fin = (s.fin || 0) + 1; }
  if (src === 'legend') { mult = 3.5; tag = 'FINALIZAÇÃO LENDÁRIA'; s.melee++; s.fin = (s.fin || 0) + 1; }
  if (src === 'explosion') { mult = 1.5; tag = 'EXPLOSÃO'; }
  const pts = Math.round(e.st.score * mult * Math.min(this.combo, 10));
  this.score += pts;
  this.texts.push({ x: e.x, y: e.y - 10, text: '+' + pts + (this.combo > 1 ? ' X' + this.combo : ''), col: this.combo > 2 ? '#ff40a0' : '#ffe060', t: 1.1 });
  if (tag) this.texts.push({ x: e.x, y: e.y - 18, text: tag, col: '#29d0ff', t: 1.0 });
  if (e.boss) {
    this.toast('O ARQUITETO FOI ELIMINADO', '#ffd060');
    this.completeT = 2.6; this.player.iframes = 99;
    for (const o of this.enemies) if (o.alive && o !== e) { o.alive = false; this.addCorpse(o.x, o.y, rand(0, TAU), o.pal, 40); }
    AudioSys.stopMusic(); AudioSys.sfx('win');
    return;
  }
  const left = this.enemies.filter((o) => o.alive).length;
  if (left === 0 && !this.level.boss && !this.exitOpen) {
    this.exitOpen = true;
    this.toast('ÁREA LIMPA — VÁ PARA A SAÍDA', '#40ff90');
    AudioSys.sfx('exit');
  }
};
Game.findDogTarget = function () {
  const p = this.player;
  let best = null, bs = 1e9;
  for (const e of this.enemies) {
    if (!e.alive || e.state === 'down' || e.state === 'held') continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d > 330) continue;
    const da = Math.abs(angDiff(p.angle, Math.atan2(e.y - p.y, e.x - p.x)));
    const sc = da * 140 + d * 0.35;
    if (sc < bs && this.world.los(p.x, p.y, e.x, e.y)) { bs = sc; best = e; }
  }
  return best;
};
Game.commandDog = function () {
  if (this.dog.state !== 'follow') { this.toast('O CÃO ESTÁ OCUPADO', '#c8a8d8'); return; }
  if (this.dogKills < 3) { this.toast(`CÃO: ${this.dogKills}/3 ABATES`, '#c8a8d8'); return; }
  const t = this.dogCand || this.findDogTarget();
  if (!t) { this.toast('NENHUM ALVO À VISTA', '#c8a8d8'); return; }
  this.dog.command(t);
  this.dogKills = 0; this.dogCand = null;
  this.texts.push({ x: this.player.x, y: this.player.y - 16, text: 'PEGA!', col: '#40ff90', t: 1 });
};
Game.finisherStart = function (e, type) {
  this.finFx = { x: e.x, y: e.y, type };
  AudioSys.sfx('finisher', 0.7);
};
Game.finisherHit = function (e, type, last) {
  this.finFlash = last ? 1 : 0.55;
  if (last) {
    this.finText = 1.4; this.finTextType = type;
    this.bloodPool(e.x, e.y, type === 'shotgun' ? 16 : 12);
    AudioSys.sfx('finisher');
  } else this.bloodPool(e.x + rand(-3, 3), e.y + rand(-3, 3), 5);
};
Game.bossIntro = function (b) {
  this.toast(b.name, '#ff3050');
  this.shake(6);
};
Game.spawnReinforcements = function (n) {
  const pts = this.world.spawn.reinf.slice().sort((a, b) => dist2(b.x, b.y, this.player.x, this.player.y) - dist2(a.x, a.y, this.player.x, this.player.y));
  for (let i = 0; i < n && i < pts.length; i++) {
    const s = pts[i];
    const e = new Enemy(i % 2 ? 'f' : 'e', s.x, s.y, i % 2 ? 'rifleman' : 'elite');
    e.state = 'chase'; e.lastX = this.player.x; e.lastY = this.player.y; e.alertIcon = 1.5;
    this.enemies.push(e); this.stats.total++;
    for (let k = 0; k < 10; k++) this.particle(s.x + rand(-6, 6), s.y + rand(-6, 6), rand(-30, 30), rand(-30, 30), 0.6, '#3a2040', 3, 2, 'smoke');
  }
};
Game.completeLevel = function () {
  if (this.state !== 'playing') return;
  this.state = 'results';
  const L = this.level, s = this.stats;
  const acc = s.shots ? Math.min(1, s.hits / s.shots) : 1;
  const timeBonus = Math.max(0, Math.round((L.par - this.time) * 10));
  const accBonus = Math.round(acc * 1000);
  const hpBonus = Math.round(this.player.hp * 8);
  const total = this.score + timeBonus + accBonus + hpBonus;
  // pontuação de referência para a avaliação
  let base = 0; for (const e of this.enemies) base += e.st.score;
  const ideal = base * 2.6 + L.par * 4 + 700 + 500;
  const ratio = total / ideal;
  const rating = ratio >= 1 ? 'S' : ratio >= 0.78 ? 'A' : ratio >= 0.58 ? 'B' : ratio >= 0.4 ? 'C' : 'D';
  const sv = Save.data;
  const prev = sv.best[L.id];
  const isNew = !prev || total > prev.score;
  if (isNew) sv.best[L.id] = { score: total, rating, time: Math.round(this.time) };
  sv.unlocked = Math.max(sv.unlocked, Math.min(LEVELS.length, L.id + 1));
  if (L.id === LEVELS.length) sv.finished = true;
  Save.write();
  AudioSys.playMusic('win');
  AudioSys.sfx('win');
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  UI.showResults({
    title: L.name,
    rows: [
      ['Tempo', fmt(this.time)], ['Abates', `${s.kills}/${s.total}`], ['Combo máximo', 'x' + s.maxCombo], ['Finalizações', s.fin || 0],
      ['Precisão', Math.round(acc * 100) + '%'], ['Dano sofrido', Math.round(s.damage)],
      ['Pontos de combate', this.score], ['Bônus de tempo', timeBonus], ['Bônus de precisão', accBonus], ['Bônus de vida', hpBonus],
    ],
    total, rating, isNew, last: L.id === LEVELS.length,
  });
};
Game.onPlayerDeath = function () { this.shake(8); AudioSys.stopMusic(); };
Game.gameOver = function () {
  this.state = 'over';
  AudioSys.sfx('lose');
  const left = this.enemies.filter((e) => e.alive).length;
  UI.showGameOver(`Você caiu em ${this.level.name}. Restavam ${left} inimigo(s). Pontuação: ${this.score}.`);
};
Game.pause = function () {
  if (this.state !== 'playing') return;
  this.state = 'paused';
  Input.resetTouch();
  UI.show('pause');
};
Game.resume = function () {
  this.state = 'playing'; Input.clearEdges(); Input.resetTouch(); UI.hideAll();
};

// ---------------------------------------------------------------------
// RENDERIZAÇÃO
// ---------------------------------------------------------------------
Game.render = function () {
  const ctx = this.ctx, w = this.world, vw = this.vw, vh = this.vh;
  let sx = 0, sy = 0;
  if (this.shakeAmt > 0) { sx = rand(-1, 1) * this.shakeAmt; sy = rand(-1, 1) * this.shakeAmt; }
  const cx = Math.round(this.cam.x + sx), cy = Math.round(this.cam.y + sy);
  ctx.fillStyle = '#050308'; ctx.fillRect(0, 0, vw, vh);
  this.drawWorldLayer(ctx, w, cx, cy);
  // pista de dança animada
  if (w.spawn.dance.length) this.drawDance(ctx, w, cx, cy);
  // saída
  if (this.exitOpen || !this.level.boss) this.drawExit(ctx, cx, cy);
  for (const it of this.items) {
    const spr = Sprites.item(it.type);
    const by = Math.sin(it.bob * 4) * 1.5;
    if (it.type === 'pencil') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 + Math.sin(it.bob * 5) * 0.3; ctx.drawImage(this.glowMuzzle, it.x - cx - 30, it.y - cy - 30, 60, 60); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    ctx.drawImage(spr, Math.round(it.x - cx - 10), Math.round(it.y - cy - 10 + by));
  }
  for (const b of this.barrels) b.draw(ctx, cx, cy);
  for (const c of this.corpses) drawRot(ctx, Sprites.corpse(c.pal), Math.round(c.x - cx), Math.round(c.y - cy), c.a);
  // iluminação do cenário (personagens ficam por cima para manter a leitura)
  if (Save.data.settings.quality) this.drawLighting(ctx, w, cx, cy, false);
  for (const e of this.enemies) if (e.alive && (e.state === 'down' || e.state === 'held')) e.draw(ctx, cx, cy);
  this.dog.draw(ctx, cx, cy);
  this.player.draw(ctx, cx, cy);
  for (const e of this.enemies) if (e.alive && e.state !== 'down' && e.state !== 'held') e.draw(ctx, cx, cy);
  const mk = this.dog.state === 'attack' ? this.dog.target : this.dogCand;
  if (mk && mk.alive) this.drawMark(ctx, mk.x - cx, mk.y - cy, this.dog.state === 'attack');
  this.drawBullets(ctx, cx, cy);
  this.drawParticles(ctx, cx, cy, false);
  if (Save.data.settings.quality) this.drawLighting(ctx, w, cx, cy, true);
  this.drawParticles(ctx, cx, cy, true);
  // clarões de disparo (aditivo)
  ctx.globalCompositeOperation = 'lighter';
  for (const f of this.flashes) {
    const g = f.blast ? this.glowBlast : this.glowMuzzle;
    const s = f.blast ? 1 + (0.25 - f.t) * 3 : f.s;
    const r = g.width / 2 * s;
    ctx.globalAlpha = f.blast ? Math.min(1, f.t * 5) : 0.9;
    ctx.drawImage(g, f.x - cx - r, f.y - cy - r, r * 2, r * 2);
    if (!f.blast) {
      ctx.fillStyle = '#fff6c0';
      const fx = f.x - cx + Math.cos(f.a) * 3, fy = f.y - cy + Math.sin(f.a) * 3;
      ctx.fillRect(Math.round(fx) - 1, Math.round(fy) - 1, 3, 3);
      ctx.fillRect(Math.round(fx + Math.cos(f.a) * 3), Math.round(fy + Math.sin(f.a) * 3), 2, 2);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if (this.theme && this.theme.rain) this.drawRain(ctx);
  for (const t of this.texts) PixelFont.draw(ctx, t.text, t.x - cx, t.y - cy, t.col, 1, 'center');
  // zoom dramático durante a finalização
  if (this.finZoom > 0.02 && this.finFx) {
    const vw = this.vw, vh = this.vh;
    if (!this.zbuf || this.zbuf.width !== vw || this.zbuf.height !== vh) [this.zbuf, this.zctx] = makeCanvas(vw, vh);
    this.zctx.drawImage(this.canvas, 0, 0);
    const z = 1 + 0.22 * this.finZoom, sw = vw / z, sh = vh / z;
    const fx = this.finFx.x - cx, fy = this.finFx.y - cy;
    const zx = clamp(fx - sw / 2, 0, vw - sw), zy = clamp(fy - sh / 2, 0, vh - sh);
    ctx.drawImage(this.zbuf, zx, zy, sw, sh, 0, 0, vw, vh);
    ctx.fillStyle = `rgba(0,0,0,${0.5 * this.finZoom})`;
    const bar = Math.round(vh * 0.09 * this.finZoom);
    ctx.fillRect(0, 0, vw, bar); ctx.fillRect(0, vh - bar, vw, bar);
  }
  if (this.finFlash > 0) { ctx.fillStyle = `rgba(255,20,40,${Math.min(0.35, this.finFlash * 0.35)})`; ctx.fillRect(0, 0, this.vw, this.vh); }
  this.drawHUD(ctx);
};

Game.drawWorldLayer = function (ctx, w, cx, cy) {
  const sx = Math.max(0, cx), sy = Math.max(0, cy);
  const ex = Math.min(w.pw, cx + this.vw), ey = Math.min(w.ph, cy + this.vh);
  if (ex > sx && ey > sy) ctx.drawImage(w.mapCanvas, sx, sy, ex - sx, ey - sy, sx - cx, sy - cy, ex - sx, ey - sy);
};
Game.drawLighting = function (ctx, w, cx, cy, glowPass) {
  const S = w.lightScale;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if (glowPass === false || glowPass === undefined) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(w.lightCanvas, cx / S, cy / S, this.vw / S, this.vh / S, 0, 0, this.vw, this.vh);
    if (glowPass === false) { ctx.restore(); return; }
  }
  ctx.globalCompositeOperation = 'lighter';
  let flick = 0.5;
  if (this.level && this.level.theme === 'club') flick = 0.42 + Math.sin(this.time * 7) * 0.12 + (Math.random() < 0.02 ? 0.2 : 0);
  ctx.globalAlpha = flick;
  ctx.drawImage(w.glowCanvas, cx / S, cy / S, this.vw / S, this.vh / S, 0, 0, this.vw, this.vh);
  ctx.restore();
};
Game.drawDance = function (ctx, w, cx, cy) {
  const d = w.spawn.dance, t = Math.floor(this.time * 4);
  const cols = ['#ff2a8a', '#29c8ff', '#a040ff', '#ffd040', '#40ff90'];
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < d.length; i += 2) {
    const tx = d[i], ty = d[i + 1];
    const x = tx * TILE - cx, y = ty * TILE - cy;
    if (x < -16 || y < -16 || x > this.vw || y > this.vh) continue;
    const k = (tx * 3 + ty * 5 + t) % 7;
    if (k > 4) continue;
    ctx.fillStyle = cols[(tx + ty + t) % cols.length];
    ctx.fillRect(x + 1, y + 1, 6, 6); ctx.fillRect(x + 9, y + 9, 6, 6);
    if (k < 2) { ctx.fillRect(x + 9, y + 1, 6, 6); ctx.fillRect(x + 1, y + 9, 6, 6); }
  }
  ctx.globalAlpha = 1;
};
Game.drawExit = function (ctx, cx, cy) {
  const ex = this.world.spawn.exits; if (!ex.length) return;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const e of ex) { x0 = Math.min(x0, e.x); y0 = Math.min(y0, e.y); x1 = Math.max(x1, e.x); y1 = Math.max(y1, e.y); }
  const x = x0 * TILE - cx, y = y0 * TILE - cy, w = (x1 - x0 + 1) * TILE, h = (y1 - y0 + 1) * TILE;
  const pulse = 0.5 + Math.sin(this.time * 5) * 0.3;
  ctx.fillStyle = this.exitOpen ? rgba('#30ff80', 0.18 + pulse * 0.2) : 'rgba(255,40,60,0.12)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = this.exitOpen ? '#40ff90' : '#7a2030'; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  PixelFont.draw(ctx, this.exitOpen ? 'SAÍDA' : 'TRANCADA', x + w / 2, y + h / 2 - 3, this.exitOpen ? '#40ff90' : '#c04050', 1, 'center');
};
Game.drawBullets = function (ctx, cx, cy) {
  ctx.lineCap = 'square';
  for (const b of this.bullets) {
    if (!b.active) continue;
    const x = b.x - cx, y = b.y - cy;
    const tl = b.owner === 'player' ? 0.014 : 0.02;
    ctx.strokeStyle = b.owner === 'player' ? '#fff2a0' : (b.kind === 'boss' ? '#ff40c0' : '#ff7a3a');
    ctx.lineWidth = b.kind === 'boss' ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(x - b.vx * tl, y - b.vy * tl); ctx.lineTo(x, y); ctx.stroke();
    if (b.owner !== 'player') { ctx.fillStyle = '#ffd0a0'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2); }
  }
};
Game.drawParticles = function (ctx, cx, cy, additive) {
  if (additive) ctx.globalCompositeOperation = 'lighter';
  for (const q of this.particles) {
    if (!q.active) continue;
    const isAdd = q.kind === 'fire';
    if (isAdd !== additive) continue;
    const x = q.x - cx, y = q.y - cy;
    if (x < -10 || y < -10 || x > this.vw + 10 || y > this.vh + 10) continue;
    const a = q.life / q.max;
    if (q.kind === 'smoke' || q.kind === 'fire') {
      ctx.globalAlpha = a * (q.kind === 'smoke' ? 0.5 : 0.9);
      ctx.fillStyle = q.color;
      const s = q.size;
      ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), Math.ceil(s), Math.ceil(s));
    } else {
      ctx.globalAlpha = 1;
      ctx.fillStyle = q.color;
      ctx.fillRect(Math.round(x), Math.round(y), q.kind === 'shell' ? 2 : q.size, q.size);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};

// ---------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------
Game.drawHUD = function (ctx) {
  const p = this.player, vw = this.vw, vh = this.vh;
  const big = vw >= 420 ? 2 : 1;
  // dano / vida baixa
  if (p.hurtT > 0 || (p.alive && p.hp < 30)) {
    const a = p.hurtT > 0 ? p.hurtT * 1.2 : 0.12 + Math.sin(this.time * 6) * 0.08;
    ctx.fillStyle = `rgba(200,0,20,${Math.min(0.4, a)})`;
    ctx.fillRect(0, 0, vw, 6); ctx.fillRect(0, vh - 6, vw, 6); ctx.fillRect(0, 0, 6, vh); ctx.fillRect(vw - 6, 0, 6, vh);
  }
  // vida
  const hx = 6, hy = 6;
  PixelFont.draw(ctx, 'VIDA', hx, hy, '#ff3050');
  ctx.fillStyle = '#000'; ctx.fillRect(hx + 27, hy - 1, 64, 9);
  ctx.fillStyle = '#3a0810'; ctx.fillRect(hx + 28, hy, 62, 7);
  const hpw = Math.round(62 * p.hp / p.maxHp);
  ctx.fillStyle = p.hp < 30 ? '#ff2020' : '#e8204a'; ctx.fillRect(hx + 28, hy, hpw, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(hx + 28, hy, hpw, 2);
  PixelFont.draw(ctx, String(Math.ceil(p.hp)), hx + 96, hy, '#ffffff');
  // arma e munição (estilo grande)
  const W = p.w, gun = p.gun;
  const ay = vh - 10 - 7 * big;
  if (W.melee) PixelFont.draw(ctx, W.name, hx, ay, W.legendary ? '#ffd040' : '#ffffff', big);
  else {
    const txt = `${gun.mag}/${gun.reserve}`;
    const col = gun.mag === 0 ? '#ff4050' : '#29d0ff';
    const wdt = PixelFont.draw(ctx, txt, hx, ay, col, big, 'left', '#3a0a40');
    PixelFont.draw(ctx, 'BAL', hx + wdt + 2, ay + 7 * big - 7, '#29d0ff');
    if (p.reloadT > 0) {
      const f = 1 - p.reloadT / W.reload;
      ctx.fillStyle = '#000'; ctx.fillRect(hx, ay - 6, 52, 4);
      ctx.fillStyle = '#ffd060'; ctx.fillRect(hx + 1, ay - 5, Math.round(50 * f), 2);
      PixelFont.draw(ctx, 'RECARREGANDO', hx + 56, ay - 8, '#ffd060');
    }
  }
  PixelFont.draw(ctx, W.name, hx, ay - 18 + (p.reloadT > 0 ? -2 : 6), '#c8a8d8');
  // lista de armas
  let ix = hx;
  const iy = 18;
  for (const k of WEAPON_ORDER) {
    if (!p.guns[k]) continue;
    const sel = k === p.cur;
    ctx.fillStyle = sel ? 'rgba(255,42,106,0.5)' : 'rgba(0,0,0,0.45)';
    ctx.fillRect(ix, iy, 22, 14);
    if (sel) { ctx.strokeStyle = '#ff2a6a'; ctx.strokeRect(ix + 0.5, iy + 0.5, 21, 13); }
    ctx.drawImage(Sprites.item(k), ix + 1, iy - 3);
    PixelFont.draw(ctx, String(WEAPONS[k].slot), ix + 1, iy + 1, '#ffffff', 1, 'left', null);
    ix += 24;
  }
  // indicador do cão
  {
    const dy = iy + 17, ready = this.dogKills >= 3;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(hx, dy, 72, 12);
    ctx.drawImage(Sprites.dog(-1, 'idle'), hx - 7, dy - 10);
    if (this.dog.state === 'attack' || this.dog.state === 'hold') PixelFont.draw(ctx, 'ATACANDO', hx + 20, dy + 3, '#ff3050', 1, 'left', null);
    else if (ready) PixelFont.draw(ctx, Input.state.device === 'touch' ? 'PRONTO' : 'PRONTO [G]', hx + 20, dy + 3, Math.floor(this.time * 4) % 2 ? '#40ff90' : '#c0ffd8', 1, 'left', null);
    else { for (let i = 0; i < 3; i++) { ctx.fillStyle = i < this.dogKills ? '#40ff90' : '#2a3a30'; ctx.fillRect(hx + 21 + i * 9, dy + 3, 7, 6); } }
  }
  // prompt de finalização
  if (p.alive && !p.fin) {
    const dn = p.findGrounded(30);
    if (dn) {
      const blade = p.cur === 'knife' || p.cur === 'pencil';
      const txt = Input.state.device === 'touch' ? 'GOLPE: FINALIZAR' : (Input.state.device === 'pad' ? 'B: FINALIZAR' : (blade ? 'E: FINALIZAR' : 'E / CLIQUE: FINALIZAR'));
      PixelFont.draw(ctx, txt, dn.x - this.cam.x, dn.y - this.cam.y - 20, Math.floor(this.time * 6) % 2 ? '#ff3050' : '#ffffff', 1, 'center');
    }
  }
  // pontuação
  const sx = this.scoreDisplay = lerp(this.scoreDisplay || 0, this.score, 0.15);
  PixelFont.draw(ctx, Math.round(sx) + ' PTS', vw - 8 - Game.hudPad(), 6, '#ff40a0', big, 'right', '#3a0414');
  if (this.combo > 1 && this.comboT > 0) {
    const cy = 8 + 8 * big;
    PixelFont.draw(ctx, 'X' + this.combo + ' COMBO', vw - 8 - Game.hudPad(), cy, '#ffe060', 1, 'right');
    ctx.fillStyle = '#ffe060'; ctx.fillRect(vw - 8 - 50 - Game.hudPad(), cy + 9, Math.round(50 * this.comboT / 3.5), 2);
  }
  // objetivo
  const left = this.enemies.filter((e) => e.alive).length;
  let obj;
  if (this.level.boss) obj = this.boss && this.boss.alive ? 'DERROTE O ARQUITETO' : 'CONTRATO CUMPRIDO';
  else obj = this.exitOpen ? 'VÁ PARA A SAÍDA' : `INIMIGOS: ${left}`;
  PixelFont.draw(ctx, obj, vw / 2, 6, this.exitOpen ? '#40ff90' : '#ffffff', 1, 'center');
  PixelFont.draw(ctx, `FASE ${this.level.id}`, vw / 2, 15, '#8a6a9a', 1, 'center');
  // barra do chefe
  const b = this.boss;
  if (b && b.awake && b.alive) {
    const bw = Math.min(220, vw * 0.5), bx = (vw - bw) / 2, by = 28;
    PixelFont.draw(ctx, b.name, vw / 2, by - 1, '#ff3050', 1, 'center');
    ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by + 8, bw + 2, 7);
    ctx.fillStyle = '#3a0810'; ctx.fillRect(bx, by + 9, bw, 5);
    ctx.fillStyle = '#ff2040'; ctx.fillRect(bx, by + 9, Math.round(bw * b.hp / b.maxHp), 5);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + Math.round(bw * 0.65), by + 9, 1, 5); ctx.fillRect(bx + Math.round(bw * 0.3), by + 9, 1, 5);
  }
  // setas indicando inimigos restantes ou a saída
  const targets = [];
  if (this.exitOpen) { const e = this.world.spawn.exits[0]; if (e) targets.push([e.x * TILE + 8, e.y * TILE + 8, '#40ff90']); }
  else if (left > 0 && left <= 3) for (const e of this.enemies) if (e.alive) targets.push([e.x, e.y, '#ff3050']);
  for (const [tx, ty, col] of targets) this.drawArrow(ctx, tx, ty, col);
  // avisos
  let ty2 = vh * 0.24;
  for (const t of this.toasts) {
    ctx.globalAlpha = Math.min(1, t.t * 2);
    PixelFont.draw(ctx, t.text, vw / 2, ty2, t.col, 1, 'center');
    ty2 += 11;
  }
  ctx.globalAlpha = 1;
  // texto da finalização
  if (this.finText > 0) {
    const lg = this.finTextType === 'pencil';
    ctx.globalAlpha = Math.min(1, this.finText * 2);
    PixelFont.draw(ctx, lg ? 'FINALIZAÇÃO LENDÁRIA' : 'FINALIZAÇÃO', vw / 2, vh * 0.33, lg ? '#ffd040' : '#ff3050', big, 'center', '#2a0414');
    ctx.globalAlpha = 1;
  }
  // banner do acessório lendário
  if (this.legendT > 0) {
    const a = Math.min(1, this.legendT, (5 - this.legendT) * 4);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(20,10,0,0.75)'; ctx.fillRect(0, vh / 2 - 34, vw, 62);
    ctx.fillStyle = '#ffd040'; ctx.fillRect(0, vh / 2 - 34, vw, 1); ctx.fillRect(0, vh / 2 + 27, vw, 1);
    ctx.drawImage(Sprites.item('pencil'), vw / 2 - 10, vh / 2 - 31);
    const s1 = vw >= 420 ? 2 : 1;
    PixelFont.draw(ctx, 'VOCÊ DESBLOQUEOU O ACESSÓRIO LENDÁRIO', vw / 2, vh / 2 - 9, '#ffffff', 1, 'center');
    PixelFont.draw(ctx, 'DE ' + LEGEND_OWNER, vw / 2, vh / 2 + 3, Math.floor(this.time * 8) % 2 ? '#ffd040' : '#fff2a0', s1, 'center', '#5a3000');
    PixelFont.draw(ctx, 'LÁPIS: ABATE COM UM GOLPE (TECLA 5)', vw / 2, vh / 2 + 18, '#c8a8d8', 1, 'center');
    ctx.globalAlpha = 1;
  }
  // título da fase
  if (this.titleT > 0) {
    const a = Math.min(1, this.titleT, (3.2 - this.titleT) * 3);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, vh / 2 - 26, vw, 50);
    PixelFont.draw(ctx, `FASE ${this.level.id}`, vw / 2, vh / 2 - 20, '#29d0ff', 1, 'center');
    PixelFont.draw(ctx, this.level.name, vw / 2, vh / 2 - 9, '#ff2a6a', big + 1 > 3 ? 3 : big + 1, 'center', '#2a0414');
    ctx.globalAlpha = 1;
  }
  // mira do mouse
  const inp = Input.state;
  if (inp.device === 'kb' && p.alive) {
    const mx = Math.round(inp.mouseX), my = Math.round(inp.mouseY);
    ctx.fillStyle = '#000'; ctx.fillRect(mx - 4, my - 1, 9, 3); ctx.fillRect(mx - 1, my - 4, 3, 9);
    ctx.fillStyle = '#ff2a6a'; ctx.fillRect(mx - 3, my, 7, 1); ctx.fillRect(mx, my - 3, 1, 7);
    ctx.fillStyle = '#fff'; ctx.fillRect(mx, my, 1, 1);
  } else if (p.alive && (inp.device !== 'kb')) {
    // linha de mira no celular/gamepad
    const cx = Math.round(p.x - this.cam.x), cy = Math.round(p.y - this.cam.y);
    ctx.fillStyle = 'rgba(255,42,106,0.8)';
    for (let i = 3; i < 9; i++) ctx.fillRect(Math.round(cx + Math.cos(p.angle) * i * 6), Math.round(cy + Math.sin(p.angle) * i * 6), 1, 1);
  }
  if (inp.device === 'touch' || Save.data.settings.touch === 1) this.drawTouch(ctx);
};
Game.hudPad = function () { const L = Input.layout; return (Input.state.device === 'touch' || Save.data.settings.touch === 1) && L ? Math.round(L.buttons.pause.r * 2 + 6) : 0; };
Game.drawMark = function (ctx, x, y, locked) {
  const t = this.time, r = 10 + (locked ? 0 : Math.sin(t * 10) * 2);
  ctx.fillStyle = locked ? '#ff3050' : (Math.floor(t * 6) % 2 ? '#40ff90' : '#20a060');
  const X = Math.round(x), Y = Math.round(y);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    ctx.fillRect(X + sx * r - (sx > 0 ? 3 : 0), Y + sy * r, 4, 1);
    ctx.fillRect(X + sx * r, Y + sy * r - (sy > 0 ? 3 : 0), 1, 4);
  }
  if (!locked) PixelFont.draw(ctx, 'CÃO', X, Y - r - 9, '#40ff90', 1, 'center');
};
Game.drawRain = function (ctx) {
  ctx.fillStyle = 'rgba(150,170,230,0.35)';
  const t = this.time, vw = this.vw, vh = this.vh;
  for (let i = 0; i < 90; i++) {
    const sx = (hash2(i, 1, 3) * (vw + 60) + t * 60) % (vw + 60) - 30;
    const sy = (hash2(i, 2, 4) * vh + t * (260 + hash2(i, 3, 5) * 120)) % vh;
    ctx.fillRect(Math.round(sx), Math.round(sy), 1, 5);
    if (i % 9 === 0) ctx.fillRect(Math.round(hash2(i, Math.floor(t * 4), 7) * vw), Math.round(hash2(i, Math.floor(t * 4), 8) * vh), 2, 1);
  }
};
Game.drawArrow = function (ctx, tx, ty, col) {
  const sx = tx - this.cam.x, sy = ty - this.cam.y;
  if (sx > 8 && sy > 8 && sx < this.vw - 8 && sy < this.vh - 8) return;
  const cx = this.vw / 2, cy = this.vh / 2;
  const a = Math.atan2(sy - cy, sx - cx);
  const m = 16;
  const k = Math.min((this.vw / 2 - m) / Math.abs(Math.cos(a) || 0.001), (this.vh / 2 - m) / Math.abs(Math.sin(a) || 0.001));
  const x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(a);
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
};
Game.drawTouch = function (ctx) {
  const L = Input.layout; if (!L) return;
  const t = Input.touch;
  const pressed = new Set(Object.values(t.buttons));
  ctx.lineWidth = 1;
  const stick = (s, home, col) => {
    const ox = s ? s.ox : home.x, oy = s ? s.oy : home.y;
    ctx.globalAlpha = s ? 0.55 : 0.22;
    ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(ox, oy, L.R, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
    const kx = s ? s.x : ox, ky = s ? s.y : oy;
    ctx.globalAlpha = s ? 0.8 : 0.3;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(kx, ky, L.r * 0.75, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  };
  stick(t.move, L.moveHome, '#29d0ff');
  stick(t.aim, L.aimHome, '#ff2a6a');
  if (!t.aim) PixelFont.draw(ctx, 'MIRA/TIRO', L.aimHome.x, L.aimHome.y - 3, 'rgba(255,255,255,0.35)', 1, 'center', null);
  if (!t.move) PixelFont.draw(ctx, 'MOVER', L.moveHome.x, L.moveHome.y - 3, 'rgba(255,255,255,0.35)', 1, 'center', null);
  for (const k in L.buttons) {
    const b = L.buttons[k];
    const on = pressed.has(k);
    ctx.globalAlpha = on ? 0.85 : 0.5;
    ctx.fillStyle = on ? '#ff2a6a' : 'rgba(10,4,16,0.75)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = k === 'dodge' ? '#29d0ff' : '#ff2a6a'; ctx.stroke();
    ctx.globalAlpha = 1;
    if (k === 'dog' && this.player) {
      ctx.strokeStyle = '#40ff90'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 1, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, this.dogKills / 3)); ctx.stroke();
      ctx.lineWidth = 1;
    }
    const label = k === 'swap' ? (this.player ? WEAPONS[this.player.cur].name.slice(0, 7) : 'ARMA') : b.label;
    PixelFont.draw(ctx, label, b.x, b.y - 3, '#ffffff', 1, 'center', null);
  }
};

// fundo animado do menu (boate vazia com neon)
Game.renderMenuBg = function (dt) {
  const ctx = this.ctx, w = this.menuWorld;
  this.menuT += dt;
  this.time += dt;
  const cx = Math.round((w.pw - this.vw) / 2 + Math.sin(this.menuT * 0.07) * (w.pw - this.vw) * 0.45);
  const cy = Math.round((w.ph - this.vh) / 2 + Math.cos(this.menuT * 0.05) * (w.ph - this.vh) * 0.4);
  ctx.fillStyle = '#050308'; ctx.fillRect(0, 0, this.vw, this.vh);
  this.drawWorldLayer(ctx, w, cx, cy);
  const keep = this.level; this.level = { theme: 'club' };
  this.drawDance(ctx, w, cx, cy);
  this.drawLighting(ctx, w, cx, cy);
  this.level = keep;
};

// ---------------------------------------------------------------------
// INTERFACE (menus em HTML) com navegação por teclado/gamepad
// ---------------------------------------------------------------------
const UI = {
  current: null, stack: [], focus: 0,
  init() {
    document.querySelectorAll('[data-act]').forEach((b) => {
      b.addEventListener('click', (e) => { e.stopPropagation(); AudioSys.init(); this.act(b.dataset.act, b); });
    });
    this.buildSettings();
  },
  el(id) { return document.getElementById(id); },
  hideAll() { document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active')); this.current = null; },
  show(id, push) {
    if (push && this.current) this.stack.push(this.current);
    if (!push) this.stack = [];
    this.hideAll();
    const s = this.el(id); s.classList.add('active'); this.current = id;
    if (id === 'menu') {
      const c = this.el('btnContinue');
      const u = Save.data.unlocked;
      c.style.display = u > 1 ? '' : 'none';
      c.textContent = `CONTINUAR · FASE ${u}`;
      if (Game.state !== 'menu') { Game.state = 'menu'; }
      if (AudioSys.ready) AudioSys.playMusic('menu');
    }
    if (id === 'levels') this.buildLevels();
    if (id === 'settings') this.refreshSettings();
    this.focus = 0; this.applyFocus();
  },
  back() {
    AudioSys.sfx('ui');
    if (this.current === 'pause') { Game.resume(); return; }
    if (this.stack.length) { const prev = this.stack.pop(); this.hideAll(); this.el(prev).classList.add('active'); this.current = prev; this.focus = 0; this.applyFocus(); if (prev === 'menu') this.show('menu'); return; }
    if (this.current !== 'menu' && Game.state === 'menu') this.show('menu');
  },
  focusables() {
    if (!this.current) return [];
    return [...this.el(this.current).querySelectorAll('button[data-act], .level-card, .setting')].filter((b) => b.offsetParent !== null && !b.disabled);
  },
  applyFocus() {
    const f = this.focusables();
    f.forEach((b, i) => b.classList.toggle('focus', i === this.focus && Input.state.device !== 'touch'));
  },
  navUpdate() {
    if (!this.current) return;
    const f = this.focusables(); if (!f.length) return;
    if (Input.consumeMenu('down')) { this.focus = (this.focus + 1) % f.length; AudioSys.sfx('ui'); this.applyFocus(); f[this.focus].scrollIntoView({ block: 'nearest' }); }
    if (Input.consumeMenu('up')) { this.focus = (this.focus - 1 + f.length) % f.length; AudioSys.sfx('ui'); this.applyFocus(); f[this.focus].scrollIntoView({ block: 'nearest' }); }
    const el = f[this.focus];
    if (el && el.classList.contains('setting')) {
      if (Input.consumeMenu('left')) this.adjust(el.dataset.key, -1);
      if (Input.consumeMenu('right')) this.adjust(el.dataset.key, 1);
    } else if (el && el.classList.contains('level-card')) {
      if (Input.consumeMenu('right')) { this.focus = Math.min(f.length - 1, this.focus + 1); this.applyFocus(); }
      if (Input.consumeMenu('left')) { this.focus = Math.max(0, this.focus - 1); this.applyFocus(); }
    } else if (el && el.parentElement.classList.contains('row')) {
      if (Input.consumeMenu('right')) { this.focus = (this.focus + 1) % f.length; this.applyFocus(); }
      if (Input.consumeMenu('left')) { this.focus = (this.focus - 1 + f.length) % f.length; this.applyFocus(); }
    }
    if (Input.consumeMenu('ok') && el) {
      if (el.classList.contains('setting')) this.adjust(el.dataset.key, 1);
      else el.click();
    }
    if (Input.consumeMenu('back')) this.back();
  },
  act(a, el) {
    AudioSys.sfx('uiOk');
    switch (a) {
      case 'continue': this.briefing(Save.data.unlocked - 1); break;
      case 'new': this.briefing(0); break;
      case 'levels': this.show('levels', true); break;
      case 'settings': this.show('settings', true); break;
      case 'howto': this.show('howto', true); break;
      case 'back': this.back(); break;
      case 'level': this.briefing(+el.dataset.i); break;
      case 'start': Game.startLevel(this.pending); break;
      case 'resume': Game.resume(); break;
      case 'restart': Game.startLevel(Game.levelIndex); break;
      case 'quit': Game.state = 'menu'; this.show('menu'); break;
      case 'next':
        if (Game.levelIndex + 1 < LEVELS.length) this.briefing(Game.levelIndex + 1);
        else this.victory();
        break;
      case 'wipe':
        if (confirm('Apagar todo o progresso e recordes?')) { Save.reset(); this.refreshSettings(); }
        break;
    }
  },
  briefing(i) {
    const L = LEVELS[i];
    this.pending = i;
    this.el('bKicker').textContent = `FASE ${L.id} DE ${LEVELS.length}`;
    this.el('bTitle').textContent = L.name;
    this.el('bText').textContent = L.brief;
    this.el('bObj').textContent = L.objective;
    const best = Save.data.best[L.id];
    this.el('bHint').textContent = best ? `Recorde: ${best.score} pts · avaliação ${best.rating}` : 'Dificuldade: ' + DIFF[Save.data.settings.difficulty].name;
    Game.state = 'menu';
    this.show('briefing', this.current === 'levels' || this.current === 'menu');
  },
  buildLevels() {
    const list = this.el('levelList'); list.innerHTML = '';
    LEVELS.forEach((L, i) => {
      const b = document.createElement('button');
      const locked = L.id > Save.data.unlocked;
      const best = Save.data.best[L.id];
      b.className = 'level-card' + (locked ? ' locked' : '');
      b.dataset.act = 'level'; b.dataset.i = i;
      b.innerHTML = `<span class="num">FASE ${L.id}</span><span class="nm">${L.name}</span><span class="rk">${locked ? '🔒' : (best ? best.rating : '—')}</span><span class="bs">${best ? best.score + ' pts' : (locked ? 'bloqueada' : 'sem recorde')}</span>`;
      if (locked) b.disabled = true;
      b.addEventListener('click', (e) => { e.stopPropagation(); AudioSys.init(); this.act('level', b); });
      list.appendChild(b);
    });
  },
  SETTINGS: [
    { key: 'master', label: 'VOLUME GERAL', type: 'vol' },
    { key: 'music', label: 'MÚSICA', type: 'vol' },
    { key: 'sfx', label: 'EFEITOS SONOROS', type: 'vol' },
    { key: 'difficulty', label: 'DIFICULDADE', type: 'list', opts: ['FÁCIL', 'NORMAL', 'DIFÍCIL'] },
    { key: 'quality', label: 'QUALIDADE GRÁFICA', type: 'list', opts: ['BAIXA', 'ALTA'] },
    { key: 'shake', label: 'TREMOR DE TELA', type: 'bool' },
    { key: 'aimAssist', label: 'ASSIST. DE MIRA (TOQUE/CONTROLE)', type: 'bool' },
    { key: 'touch', label: 'CONTROLES DE TOQUE', type: 'list', opts: ['AUTOMÁTICO', 'SEMPRE'] },
  ],
  buildSettings() {
    const list = this.el('settingsList'); list.innerHTML = '';
    for (const s of this.SETTINGS) {
      const row = document.createElement('div');
      row.className = 'setting'; row.dataset.key = s.key; row.tabIndex = -1;
      row.innerHTML = `<span class="lbl">${s.label}</span><span class="ctl"><button class="m">−</button><span class="val"></span><button class="p">+</button></span>`;
      row.querySelector('.m').addEventListener('click', (e) => { e.stopPropagation(); AudioSys.init(); this.adjust(s.key, -1); });
      row.querySelector('.p').addEventListener('click', (e) => { e.stopPropagation(); AudioSys.init(); this.adjust(s.key, 1); });
      list.appendChild(row);
    }
  },
  refreshSettings() {
    const st = Save.data.settings;
    for (const s of this.SETTINGS) {
      const v = st[s.key];
      let txt;
      if (s.type === 'vol') txt = Math.round(v * 100) + '%';
      else if (s.type === 'bool') txt = v ? 'LIGADO' : 'DESLIGADO';
      else txt = s.opts[v];
      document.querySelector(`.setting[data-key="${s.key}"] .val`).textContent = txt;
    }
  },
  adjust(key, dir) {
    const st = Save.data.settings;
    const s = this.SETTINGS.find((x) => x.key === key);
    if (s.type === 'vol') st[key] = clamp(Math.round((st[key] + dir * 0.1) * 10) / 10, 0, 1);
    else if (s.type === 'bool') st[key] = !st[key];
    else st[key] = (st[key] + dir + s.opts.length) % s.opts.length;
    Save.write();
    AudioSys.setVolumes(st.master, st.music, st.sfx);
    AudioSys.sfx('ui');
    this.refreshSettings();
  },
  showResults(r) {
    this.el('rTitle').textContent = r.title;
    const tb = this.el('rTable');
    tb.innerHTML = r.rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('') + `<tr class="total"><td>TOTAL</td><td>${r.total}</td></tr>`;
    this.el('rRating').textContent = r.rating;
    this.el('rNew').textContent = r.isNew ? 'NOVO RECORDE!' : '';
    this.el('btnNext').textContent = r.last ? 'FINAL' : 'PRÓXIMO CONTRATO';
    setTimeout(() => { if (Game.state === 'results') this.show('results'); }, 400);
  },
  showGameOver(text) {
    this.el('goText').textContent = text;
    this.show('gameover');
  },
  victory() {
    let tot = 0; for (const k in Save.data.best) tot += Save.data.best[k].score;
    this.el('vTotal').textContent = `Soma dos recordes: ${tot} pts`;
    Game.state = 'menu';
    this.show('victory');
    AudioSys.playMusic('win');
  },
};

window.addEventListener('load', () => Game.init());
