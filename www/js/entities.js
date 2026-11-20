// THE LAST CONTRACT — entidades: armas, jogador, inimigos (IA), chefe, projéteis, itens, efeitos
'use strict';

const WEAPONS = {
  pistol: { name: 'PISTOLA', slot: 1, mag: 12, startReserve: 36, maxReserve: 96, dmg: 34, rate: 0.17, spread: 0.035, pellets: 1, speed: 620, reload: 1.0, range: 640, noise: 300, shake: 1.6, sfx: 'pistol' },
  shotgun: { name: 'ESCOPETA', slot: 2, mag: 6, startReserve: 12, maxReserve: 36, dmg: 20, rate: 0.7, spread: 0.12, pellets: 7, speed: 520, reload: 1.5, range: 230, noise: 360, shake: 4.5, sfx: 'shotgun' },
  rifle: { name: 'RIFLE', slot: 3, mag: 30, startReserve: 60, maxReserve: 180, dmg: 26, rate: 0.095, spread: 0.055, pellets: 1, speed: 700, reload: 1.7, range: 700, noise: 340, shake: 2, sfx: 'rifle' },
  knife: { name: 'FACA', slot: 4, melee: true, dmg: 120, rate: 0.3, range: 22 },
  pencil: { name: 'LÁPIS', slot: 5, melee: true, dmg: 999, rate: 0.2, range: 25, legendary: true },
};
const WEAPON_ORDER = ['pistol', 'shotgun', 'rifle', 'knife', 'pencil'];
const FIN_HITS = { stomp: 3, knife: 2, pencil: 4, gun: 1, shotgun: 1 };

// atributos base dos inimigos (multiplicados pela dificuldade)
const ETYPES = {
  g: { name: 'Capanga', hp: 60, speed: 58, run: 92, weapon: 'pistol', react: 0.55, acc: 0.11, dmg: 11, rate: 0.6, burst: 1, burstPause: 0, mag: 10, reload: 1.6, range: 200, pref: 110, cover: 0.35, view: 170, fov: 1.9, score: 100 },
  n: { name: 'Escopeteiro', hp: 85, speed: 58, run: 104, weapon: 'shotgun', react: 0.5, acc: 0.1, spread: 0.2, pellets: 6, dmg: 8, rate: 1.15, burst: 1, burstPause: 0, mag: 5, reload: 2.0, range: 115, pref: 45, cover: 0.15, view: 160, fov: 1.9, score: 150 },
  f: { name: 'Atirador', hp: 70, speed: 54, run: 88, weapon: 'rifle', react: 0.6, acc: 0.085, dmg: 8, rate: 0.11, burst: 4, burstPause: 1.0, mag: 24, reload: 2.0, range: 250, pref: 160, cover: 0.65, view: 220, fov: 1.7, score: 150 },
  m: { name: 'Brutamontes', hp: 140, speed: 66, run: 118, weapon: 'bat', melee: true, react: 0.35, dmg: 26, rate: 0.9, range: 21, pref: 0, cover: 0, view: 160, fov: 2.0, score: 200 },
  e: { name: 'Elite', hp: 115, speed: 64, run: 100, weapon: 'rifle', react: 0.38, acc: 0.06, dmg: 10, rate: 0.1, burst: 5, burstPause: 0.75, mag: 30, reload: 1.8, range: 250, pref: 140, cover: 0.7, view: 230, fov: 2.0, score: 250 },
  B: { name: 'O ARQUITETO', hp: 1500, speed: 72, run: 110, weapon: 'rifle', react: 0.2, acc: 0.055, dmg: 10, rate: 0.09, burst: 6, burstPause: 0.8, mag: 999, reload: 1, range: 320, pref: 150, cover: 0.5, view: 400, fov: 6.3, score: 3000 },
};
const DIFF = [
  { name: 'FÁCIL', dmg: 0.55, react: 1.45, acc: 1.45, hp: 0.85, view: 0.85 },
  { name: 'NORMAL', dmg: 1, react: 1, acc: 1, hp: 1, view: 1 },
  { name: 'DIFÍCIL', dmg: 1.4, react: 0.72, acc: 0.78, hp: 1.15, view: 1.15 },
];

function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }

// =================================================================
// JOGADOR
// =================================================================
class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.r = 5.5;
    this.hp = 100; this.maxHp = 100;
    this.angle = 0; this.moveAngle = 0; this.vx = 0; this.vy = 0;
    this.guns = { pistol: { mag: 12, reserve: 36 } };
    this.cur = 'pistol';
    this.fireCd = 0; this.reloadT = 0; this.dodgeT = 0; this.dodgeCd = 0; this.iframes = 0;
    this.meleeT = 0; this.meleeCd = 0; this.meleePose = 'idle'; this.slashFlip = false;
    this.walk = 0; this.recoilT = 0; this.hurtT = 0; this.alive = true;
    this.dodgeX = 0; this.dodgeY = 0; this.moving = false; this.emptyCd = 0;
    this.pal = 'player';
  }
  get w() { return WEAPONS[this.cur]; }
  get gun() { return this.guns[this.cur]; }

  update(dt, inp) {
    const g = Game;
    this.fireCd -= dt; this.dodgeCd -= dt; this.iframes -= dt; this.meleeCd -= dt; this.recoilT -= dt; this.hurtT -= dt; this.emptyCd -= dt;
    if (this.meleeT > 0) { this.meleeT -= dt; if (this.meleeT <= 0) this.meleePose = 'idle'; }
    if (this.fin) { this.updateFinisher(dt); Input.consume('melee'); Input.consume('dodge'); return; }
    // troca de arma
    const slot = Input.consume('slot');
    if (slot) { const k = WEAPON_ORDER[slot - 1]; if (this.guns[k]) this.select(k); }
    if (Input.consume('swap')) this.cycle();
    // recarga
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.finishReload();
    }
    if (Input.consume('reload')) this.startReload();
    // recarga automática com o pente vazio
    if (!this.w.melee && this.gun.mag === 0 && this.gun.reserve > 0 && this.reloadT <= 0 && this.fireCd <= 0) this.startReload();

    // mira
    if (inp.aimMode === 'mouse' && inp.device === 'kb') {
      const wx = g.cam.x + inp.mouseX, wy = g.cam.y + inp.mouseY;
      this.angle = Math.atan2(wy - this.y, wx - this.x);
    } else if (inp.aimActive) {
      this.angle = inp.aimAngle;
      if (Save.data.settings.aimAssist) this.angle = this.assist(this.angle);
    } else if (Math.hypot(inp.moveX, inp.moveY) > 0.2) {
      this.angle = approachAngle(this.angle, Math.atan2(inp.moveY, inp.moveX), 10 * dt);
    }

    // esquiva
    if (Input.consume('dodge') && this.dodgeCd <= 0 && this.dodgeT <= 0) {
      let dx = inp.moveX, dy = inp.moveY;
      if (Math.hypot(dx, dy) < 0.2) { dx = Math.cos(this.angle); dy = Math.sin(this.angle); }
      const l = Math.hypot(dx, dy); this.dodgeX = dx / l; this.dodgeY = dy / l;
      this.dodgeT = 0.28; this.iframes = 0.34; this.dodgeCd = 0.7;
      AudioSys.sfx('dodge');
      g.spawnDust(this.x, this.y, 6);
    }

    // movimento
    let speed;
    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      this.vx = this.dodgeX * 270; this.vy = this.dodgeY * 270;
      if (Math.random() < 0.5) g.particle(this.x + rand(-3, 3), this.y + rand(-3, 3), 0, 0, 0.3, '#3a3a48', 2, 0, 'smoke');
    } else {
      speed = inp.run ? 128 : 86;
      if (this.reloadT > 0) speed *= 0.85;
      const tx = inp.moveX * speed, ty = inp.moveY * speed;
      const acc = 1100 * dt;
      this.vx += clamp(tx - this.vx, -acc, acc);
      this.vy += clamp(ty - this.vy, -acc, acc);
    }
    g.world.move(this, this.vx * dt, this.vy * dt, this.r);
    const sp = Math.hypot(this.vx, this.vy);
    this.moving = sp > 12;
    if (this.moving) { this.moveAngle = Math.atan2(this.vy, this.vx); this.walk += sp * dt * 0.11; }

    // corpo a corpo
    if (Input.consume('melee') && this.meleeCd <= 0 && this.dodgeT <= 0) this.melee();

    // disparo
    if (inp.fire && this.dodgeT <= 0 && this.meleeT <= 0) this.tryFire();
  }

  assist(a) {
    let best = null, bd = 0.22;
    for (const e of Game.enemies) {
      if (!e.alive) continue;
      const d = dist(this.x, this.y, e.x, e.y);
      if (d > 320) continue;
      const ea = Math.atan2(e.y - this.y, e.x - this.x);
      const df = Math.abs(angDiff(a, ea));
      if (df < bd && Game.world.los(this.x, this.y, e.x, e.y)) { bd = df; best = ea; }
    }
    return best === null ? a : best;
  }

  select(k) {
    if (this.cur === k) return;
    this.cur = k; this.reloadT = 0; this.fireCd = Math.max(this.fireCd, 0.15);
    AudioSys.sfx('reload', 0.6);
    Game.toast(WEAPONS[k].name);
  }
  cycle() {
    const owned = WEAPON_ORDER.filter((k) => this.guns[k]);
    if (owned.length < 2) return;
    const i = owned.indexOf(this.cur);
    this.select(owned[(i + 1) % owned.length]);
  }
  startReload() {
    const w = this.w, gn = this.gun;
    if (w.melee || this.reloadT > 0 || gn.mag >= w.mag || gn.reserve <= 0) return;
    this.reloadT = w.reload;
    AudioSys.sfx('reload');
  }
  finishReload() {
    const w = this.w, gn = this.gun;
    const take = Math.min(w.mag - gn.mag, gn.reserve);
    gn.mag += take; gn.reserve -= take; this.reloadT = 0;
    AudioSys.sfx('reloadEnd');
  }
  tryFire() {
    const w = this.w, gn = this.gun;
    if (w.melee) { if (this.meleeCd <= 0) this.melee(); return; }
    if (this.fireCd > 0 || this.reloadT > 0) return;
    if (gn.mag <= 0) {
      if (gn.reserve > 0) { this.startReload(); return; }
      if (this.emptyCd <= 0) {
        AudioSys.sfx('empty'); this.emptyCd = 0.35;
        // troca automática para uma arma com munição
        const alt = WEAPON_ORDER.find((k) => this.guns[k] && k !== this.cur && (WEAPONS[k].melee || this.guns[k].mag + this.guns[k].reserve > 0));
        if (alt) this.select(alt);
      }
      return;
    }
    // finalização com arma de fogo em inimigo caído à frente
    const dn = this.findGrounded(26);
    if (dn && Math.abs(angDiff(this.angle, Math.atan2(dn.y - this.y, dn.x - this.x))) < 1.3) {
      this.startFinisher(dn, this.cur === 'shotgun' ? 'shotgun' : 'gun'); return;
    }
    gn.mag--;
    this.fireCd = w.rate;
    this.recoilT = 0.06;
    const g = Game;
    const mx = this.x + Math.cos(this.angle) * 11, my = this.y + Math.sin(this.angle) * 11;
    const moveSpread = this.moving ? 1.35 : 1;
    for (let i = 0; i < w.pellets; i++) {
      const a = this.angle + gauss() * w.spread * moveSpread;
      g.spawnBullet(mx, my, a, w.speed * rand(0.92, 1.05), w.dmg, 'player', w.range * rand(0.85, 1.1), this.cur);
    }
    g.stats.shots += 1;
    g.muzzle(mx, my, this.angle, this.cur === 'shotgun' ? 1.4 : 1);
    g.shell(this.x, this.y, this.angle);
    g.shake(w.shake);
    AudioSys.sfx(w.sfx);
    g.noise(this.x, this.y, w.noise);
  }
  findGrounded(range) {
    let best = null, bd = range;
    for (const e of Game.enemies) {
      if (!e.alive || e.boss || !(e.state === 'down' || e.state === 'held')) continue;
      const d = dist(this.x, this.y, e.x, e.y);
      if (d < bd && Game.world.los(this.x, this.y, e.x, e.y)) { bd = d; best = e; }
    }
    return best;
  }
  melee() {
    const g = Game;
    const blade = this.cur === 'knife' || this.cur === 'pencil';
    const down = this.findGrounded(26);
    if (down) { this.startFinisher(down, this.cur === 'pencil' ? 'pencil' : (blade ? 'knife' : 'stomp')); return; }
    this.meleeCd = blade ? WEAPONS[this.cur].rate : 0.42;
    this.meleeT = 0.16;
    this.slashFlip = !this.slashFlip;
    this.meleePose = blade ? (this.slashFlip ? 'slash1' : 'slash2') : 'bash';
    AudioSys.sfx('swing');
    const range = blade ? 24 : 19;
    let target = null, best = 1e9;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const d = dist(this.x, this.y, e.x, e.y) - e.r;
      if (d > range) continue;
      const a = Math.atan2(e.y - this.y, e.x - this.x);
      if (Math.abs(angDiff(this.angle, a)) > 1.15 && d > 4) continue;
      if (!g.world.los(this.x, this.y, e.x, e.y)) continue;
      if (d < best) { best = d; target = e; }
    }
    if (!target) return;
    const a = Math.atan2(target.y - this.y, target.x - this.x);
    if (this.cur === 'pencil') {
      target.hurt(target.boss ? 200 : 999, a, 'pencil');
      AudioSys.sfx('stab'); g.shake(4); g.hitstop(0.06);
      g.texts.push({ x: target.x, y: target.y - 20, text: 'LÁPIS!', col: '#ffd040', t: 0.9 });
    } else if (blade) {
      target.hurt(target.boss ? 90 : WEAPONS.knife.dmg, a, 'knife');
      AudioSys.sfx('stab'); g.shake(3); g.hitstop(0.04);
    } else {
      target.hurt(target.boss ? 30 : 28, a, 'punch');
      if (target.alive) target.stun(a);
      AudioSys.sfx('punch'); g.shake(3); g.hitstop(0.04);
    }
  }
  // ---------- finalizações (estilo Hotline Miami) ----------
  startFinisher(e, type) {
    this.fin = { e, type, hits: 0, next: (type === 'gun' || type === 'shotgun') ? 0.32 : 0.14 };
    e.finishing = true;
    this.vx = this.vy = 0; this.reloadT = 0;
    Game.finisherStart(e, type);
  }
  updateFinisher(dt) {
    const f = this.fin, e = f.e, g = Game;
    if (!e.alive) { this.fin = null; return; }
    const a = Math.atan2(e.y - this.y, e.x - this.x);
    this.angle = approachAngle(this.angle, a, 20 * dt);
    const tx = e.x - Math.cos(a) * 9, ty = e.y - Math.sin(a) * 9;
    const k = Math.min(1, dt * 14);
    this.x += (tx - this.x) * k; this.y += (ty - this.y) * k;
    g.world.pushOut(this, this.r);
    f.next -= dt;
    if (f.next > 0) return;
    f.hits++;
    const last = f.hits >= FIN_HITS[f.type];
    const t = f.type;
    this.meleeT = 0.12;
    if (t === 'stomp') {
      this.meleePose = f.hits % 2 ? 'bash' : 'slash2';
      AudioSys.sfx('punch'); g.blood(e.x, e.y, a, 8); g.shake(4 + f.hits); g.hitstop(0.05);
      f.next = 0.26;
    } else if (t === 'knife' || t === 'pencil') {
      this.meleePose = f.hits % 2 ? 'slash1' : 'slash2';
      AudioSys.sfx('stab'); g.blood(e.x, e.y, a, 10); g.shake(3 + f.hits); g.hitstop(0.045);
      f.next = t === 'pencil' ? 0.13 : 0.22;
      if (t === 'pencil') g.texts.push({ x: e.x + rand(-6, 6), y: e.y - 12 - f.hits * 4, text: 'LÁPIS!', col: '#ffd040', t: 0.7 });
    } else {
      const gn = this.gun, w = this.w;
      gn.mag--; this.recoilT = 0.08;
      const mx = this.x + Math.cos(a) * 11, my = this.y + Math.sin(a) * 11;
      g.muzzle(mx, my, a, t === 'shotgun' ? 1.8 : 1.3);
      AudioSys.sfx(w.sfx); g.noise(this.x, this.y, w.noise);
      g.blood(e.x, e.y, a, t === 'shotgun' ? 26 : 16); g.shake(7); g.hitstop(0.07);
      g.stats.shots++; g.stats.hits++;
    }
    g.finisherHit(e, t, last);
    if (last) {
      e.finishing = false;
      e.hurt(9999, a, t === 'pencil' ? 'legend' : 'exec');
      this.fin = null; this.meleeCd = 0.25; this.fireCd = 0.25; this.iframes = 0.3;
    }
  }
  hurt(dmg, a) {
    if (!this.alive || this.iframes > 0) return false;
    const g = Game;
    dmg *= DIFF[Save.data.settings.difficulty].dmg;
    this.hp -= dmg; this.hurtT = 0.25; this.iframes = 0.08;
    g.stats.damage += dmg;
    this.vx += Math.cos(a) * 60; this.vy += Math.sin(a) * 60;
    g.blood(this.x, this.y, a, 6);
    g.shake(4);
    AudioSys.sfx('hurt');
    if (this.hp <= 0) {
      this.hp = 0; this.alive = false;
      g.addCorpse(this.x, this.y, a, 'player', 90);
      g.bloodPool(this.x, this.y, 12);
      AudioSys.sfx('death');
      g.onPlayerDeath();
    }
    return true;
  }
  draw(ctx, cx, cy) {
    if (!this.alive) return;
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x + 1, y + 2, 7, 6, 0, 0, TAU); ctx.fill();
    const frame = this.moving ? Math.floor(this.walk) % 8 : -1;
    drawRot(ctx, Sprites.legs(this.pal, frame), x, y, this.dodgeT > 0 ? Math.atan2(this.dodgeY, this.dodgeX) : this.moveAngle);
    let pose = 'idle';
    if (this.meleeT > 0) pose = this.meleePose;
    else if (this.reloadT > 0) pose = 'reload';
    else if (this.recoilT > 0) pose = 'recoil';
    const wkey = this.cur;
    let spr = Sprites.char(this.pal, wkey, pose);
    if (this.hurtT > 0.15) spr = Sprites.silhouette(spr, '#ff3040');
    if (this.dodgeT > 0) ctx.globalAlpha = 0.7;
    drawRot(ctx, spr, x, y, this.angle);
    ctx.globalAlpha = 1;
  }
}

function drawRot(ctx, img, x, y, a, s) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(a);
  if (s) ctx.scale(s, s);
  ctx.drawImage(img, -16, -16);
  ctx.restore();
}

// =================================================================
// INIMIGOS (máquina de estados)
// =================================================================
class Enemy {
  constructor(t, x, y, pal) {
    const d = DIFF[Save.data.settings.difficulty];
    const b = ETYPES[t];
    this.t = t; this.st = b; this.pal = pal; this.d = d;
    this.x = x; this.y = y; this.homeX = x; this.homeY = y;
    this.r = t === 'm' ? 6.5 : 5.5;
    this.maxHp = this.hp = Math.round(b.hp * d.hp);
    this.angle = rand(0, TAU); this.lookAngle = this.angle;
    this.weapon = b.weapon;
    this.mag = b.mag || 0; this.reloadT = 0;
    this.state = 'patrol';
    this.patrol = Math.random() < 0.5 ? 'guard' : 'wander';
    this.waitT = rand(0.5, 3); this.target = null;
    this.path = null; this.pathI = 0; this.repathT = 0;
    this.fireCd = rand(0.2, 0.6); this.burstLeft = 0;
    this.reactT = 0; this.lastX = x; this.lastY = y; this.lastSeen = -99;
    this.losT = Math.random() * 0.1; this.losOk = false; this.sees = false;
    this.flashT = 0; this.stunT = 0; this.walk = 0; this.moving = false; this.vx = 0; this.vy = 0;
    this.strafe = Math.random() < 0.5 ? 1 : -1; this.strafeT = rand(0.8, 2);
    this.coverT = 0; this.searchT = 0; this.windT = 0; this.meleeCd = 0; this.recoilT = 0; this.poseT = 0; this.pose = 'idle';
    this.alertIcon = 0; this.alive = true; this.boss = false; this.kb = 0;
  }
  get speedWalk() { return this.st.speed; }
  get speedRun() { return this.st.run; }

  goTo(x, y) {
    const w = Game.world;
    if (w.clearPath(this.x, this.y, x, y, this.r)) this.path = [[x, y]];
    else this.path = w.findPath(this.x, this.y, x, y, 3000);
    this.pathI = 0;
  }
  follow(speed, dt) {
    if (!this.path || this.pathI >= this.path.length) { this.moving = false; return true; }
    const w = Game.world;
    // atalho: se o próximo nó está livre, pula o atual
    if (this.pathI + 1 < this.path.length) {
      const n = this.path[this.pathI + 1];
      if (w.clearPath(this.x, this.y, n[0], n[1], this.r)) this.pathI++;
    }
    const [tx, ty] = this.path[this.pathI];
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    if (d < 4) { this.pathI++; return this.pathI >= this.path.length; }
    this.step(dx / d * speed, dy / d * speed, dt);
    return false;
  }
  step(vx, vy, dt) {
    this.vx = vx; this.vy = vy;
    Game.world.move(this, vx * dt, vy * dt, this.r);
    this.moving = true;
    this.walk += Math.hypot(vx, vy) * dt * 0.11;
    if (this.state === 'patrol' || this.state === 'search' || this.state === 'chase' || this.state === 'cover') {
      this.angle = approachAngle(this.angle, Math.atan2(vy, vx), 6 * dt);
    }
  }
  setState(s) { this.state = s; }

  perceive(dt) {
    const p = Game.player;
    this.sees = false;
    if (!p.alive) return;
    const d = dist(this.x, this.y, p.x, p.y);
    const view = this.st.view * this.d.view * (this.state === 'patrol' ? 1 : 1.7);
    if (d > view) return;
    const a = Math.atan2(p.y - this.y, p.x - this.x);
    const inFov = this.state !== 'patrol' || Math.abs(angDiff(this.angle, a)) < this.st.fov / 2 || d < 34;
    if (!inFov) return;
    this.losT -= dt;
    if (this.losT <= 0) { this.losOk = Game.world.los(this.x, this.y, p.x, p.y); this.losT = 0.08 + Math.random() * 0.05; }
    if (this.losOk) {
      this.sees = true;
      this.lastX = p.x; this.lastY = p.y; this.lastSeen = Game.time;
    }
  }

  alert(delay) {
    if (this.state === 'engage' || this.state === 'alert' || this.state === 'down' || this.state === 'windup') return;
    this.state = 'alert';
    this.reactT = delay;
    this.alertIcon = 1.2;
    AudioSys.sfx('alert', 0.6);
  }
  hear(x, y) {
    if (this.state === 'patrol' || this.state === 'search' || this.state === 'chase') {
      this.lastX = x + rand(-20, 20); this.lastY = y + rand(-20, 20);
      if (this.state !== 'chase') this.alertIcon = 1;
      this.state = 'chase'; this.goTo(this.lastX, this.lastY); this.repathT = 1.5;
    }
  }

  update(dt) {
    const g = Game, p = g.player, st = this.st;
    this.flashT -= dt; this.alertIcon -= dt; this.meleeCd -= dt; this.recoilT -= dt; this.kb *= 0.85;
    if (this.poseT > 0) { this.poseT -= dt; if (this.poseT <= 0) this.pose = 'idle'; }
    this.moving = false;
    if (this.state === 'down' || this.state === 'held') {
      if (!this.finishing) this.stunT -= dt;
      if (this.stunT <= 0) { this.state = 'engage'; this.reactT = 0; }
      return;
    }
    this.perceive(dt);
    const d = dist(this.x, this.y, p.x, p.y);
    const aToP = Math.atan2(p.y - this.y, p.x - this.x);
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) this.mag = st.mag; }

    switch (this.state) {
      case 'patrol': {
        if (this.sees) { this.alert(st.react * this.d.react * rand(0.85, 1.2)); break; }
        if (this.patrol === 'guard') {
          this.waitT -= dt;
          if (this.waitT <= 0) { this.lookAngle = this.angle + rand(-1.6, 1.6); this.waitT = rand(1.5, 3.5); }
          this.angle = approachAngle(this.angle, this.lookAngle, 1.5 * dt);
        } else {
          if (this.target) {
            if (this.follow(this.speedWalk * 0.75, dt)) { this.target = null; this.waitT = rand(1, 3); }
          } else {
            this.waitT -= dt;
            if (this.waitT <= 0) {
              const t = g.world.randomNear(this.homeX, this.homeY, 5);
              if (t) { this.target = t; this.goTo(t[0], t[1]); }
              this.waitT = rand(1, 3);
            }
          }
        }
        break;
      }
      case 'alert':
        this.angle = approachAngle(this.angle, Math.atan2(this.lastY - this.y, this.lastX - this.x), 9 * dt);
        this.reactT -= dt;
        if (this.reactT <= 0) { this.state = 'engage'; this.repathT = 0; }
        break;
      case 'fetch': {
        const it = this.fetchItem;
        if (!it || !it.alive) { this.state = 'engage'; this.fetchT = 2; break; }
        if (dist(this.x, this.y, it.x, it.y) < 9) { this.rearm(it); break; }
        this.repathT -= dt;
        if (this.repathT <= 0) { this.goTo(it.x, it.y); this.repathT = 0.6; }
        this.follow(this.speedRun, dt);
        break;
      }
      case 'engage':
        if (this.unarmed) {
          this.fetchT = (this.fetchT || 0) - dt;
          if (this.fetchT <= 0) {
            this.fetchT = 1.5;
            let best = null, bd = 170;
            for (const it of g.items) {
              if (!it.alive || !['pistol', 'shotgun', 'rifle'].includes(it.type)) continue;
              const dd = dist(this.x, this.y, it.x, it.y);
              if (dd < bd) { bd = dd; best = it; }
            }
            if (best && d > 40) { this.fetchItem = best; this.state = 'fetch'; this.repathT = 0; break; }
          }
        }
        if (st.melee) this.engageMelee(dt, d, aToP);
        else this.engageRanged(dt, d, aToP);
        break;
      case 'windup':
        this.windT -= dt;
        this.angle = approachAngle(this.angle, aToP, 4 * dt);
        if (this.windT <= 0) {
          this.pose = Math.random() < 0.5 ? 'slash1' : 'slash2'; this.poseT = 0.2;
          AudioSys.sfx('swing');
          if (p.alive && d < st.range + 12 && Math.abs(angDiff(this.angle, aToP)) < 1.2) {
            if (p.hurt(st.dmg, this.angle)) AudioSys.sfx('punch');
          }
          this.meleeCd = st.rate; this.state = 'engage';
        }
        break;
      case 'chase': {
        if (this.sees) { this.state = 'engage'; break; }
        this.repathT -= dt;
        if (this.repathT <= 0) { this.goTo(this.lastX, this.lastY); this.repathT = 1.2; }
        if (this.follow(this.speedRun, dt)) { this.state = 'search'; this.searchT = rand(2.5, 4.5); this.lookAngle = this.angle; }
        break;
      }
      case 'search':
        if (this.sees) { this.alert(0.15); break; }
        this.searchT -= dt;
        if (Math.random() < dt * 1.2) this.lookAngle = this.angle + rand(-2.2, 2.2);
        this.angle = approachAngle(this.angle, this.lookAngle, 3 * dt);
        if (this.searchT <= 0) { this.state = 'patrol'; this.target = [this.homeX, this.homeY]; this.goTo(this.homeX, this.homeY); this.patrol = 'wander'; }
        break;
      case 'cover': {
        this.coverT -= dt;
        const arrived = this.follow(this.speedRun, dt);
        if (arrived) this.angle = approachAngle(this.angle, aToP, 5 * dt);
        if (this.reloadT <= 0 && this.mag <= 0) { this.reloadT = st.reload; }
        if (this.coverT <= 0 && this.reloadT <= 0) { this.state = 'engage'; this.repathT = 0; }
        else if (this.sees && d < 50 && this.mag > 0) { this.state = 'engage'; }
        break;
      }
    }
  }

  engageRanged(dt, d, aToP) {
    const g = Game, p = g.player, st = this.st;
    if (!this.sees) {
      if (g.time - this.lastSeen > 0.5) { this.state = 'chase'; this.repathT = 0; }
      return;
    }
    this.angle = approachAngle(this.angle, aToP, 7 * dt);
    // movimentação tática
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = rand(0.8, 2.2); }
    let mx = 0, my = 0, sp = this.speedWalk;
    if (d > st.range * 0.9) {
      this.repathT -= dt;
      if (this.repathT <= 0) { this.goTo(p.x, p.y); this.repathT = 0.5; }
      this.follow(this.speedRun * 0.9, dt);
    } else {
      if (d < st.pref * 0.6) { mx -= Math.cos(aToP); my -= Math.sin(aToP); }
      else if (d > st.pref * 1.3) { mx += Math.cos(aToP) * 0.7; my += Math.sin(aToP) * 0.7; }
      mx += Math.cos(aToP + Math.PI / 2) * this.strafe * 0.6; my += Math.sin(aToP + Math.PI / 2) * this.strafe * 0.6;
      const l = Math.hypot(mx, my);
      if (l > 0.1) {
        const ox = this.x, oy = this.y;
        this.step(mx / l * sp * 0.7, my / l * sp * 0.7, dt);
        if (Math.abs(this.x - ox) + Math.abs(this.y - oy) < 0.2) this.strafe = -this.strafe;
      }
    }
    // disparo
    this.fireCd -= dt;
    if (this.reloadT > 0) return;
    if (this.mag <= 0) {
      this.reloadT = st.reload * rand(0.9, 1.2);
      if (Math.random() < st.cover) this.seekCover(this.reloadT + rand(0.3, 1));
      return;
    }
    if (this.fireCd <= 0 && Math.abs(angDiff(this.angle, aToP)) < 0.3 && d < st.range * 1.15) {
      this.fire();
      if (st.burst > 1) {
        this.burstLeft = (this.burstLeft > 0 ? this.burstLeft : st.burst) - 1;
        this.fireCd = this.burstLeft > 0 ? st.rate : st.burstPause * rand(0.8, 1.3);
      } else this.fireCd = st.rate * rand(0.85, 1.25);
    }
  }
  engageMelee(dt, d, aToP) {
    const g = Game, p = g.player, st = this.st;
    if (!this.sees && g.time - this.lastSeen > 0.5) { this.state = 'chase'; this.repathT = 0; return; }
    this.angle = approachAngle(this.angle, aToP, 8 * dt);
    if (d < st.range + 6 && this.meleeCd <= 0) {
      this.state = 'windup'; this.windT = 0.32 * this.d.react; return;
    }
    if (d > st.range) {
      if (g.world.clearPath(this.x, this.y, p.x, p.y, this.r)) {
        this.step(Math.cos(aToP) * this.speedRun, Math.sin(aToP) * this.speedRun, dt);
      } else {
        this.repathT -= dt;
        if (this.repathT <= 0) { this.goTo(p.x, p.y); this.repathT = 0.4; }
        this.follow(this.speedRun, dt);
      }
    }
  }
  seekCover(t) {
    const p = Game.player;
    const c = Game.world.findCover(this.x, this.y, p.x, p.y, 7);
    if (!c) return false;
    this.state = 'cover'; this.coverT = t; this.goTo(c[0], c[1]);
    return true;
  }
  fire() {
    const g = Game, st = this.st;
    const mx = this.x + Math.cos(this.angle) * 11, my = this.y + Math.sin(this.angle) * 11;
    const n = st.pellets || 1;
    for (let i = 0; i < n; i++) {
      const a = this.angle + gauss() * (st.acc * this.d.acc) + (n > 1 ? gauss() * st.spread : 0);
      g.spawnBullet(mx, my, a, n > 1 ? 380 : 400, st.dmg, 'enemy', n > 1 ? 220 : 600, this.weapon);
    }
    this.mag--; this.recoilT = 0.06;
    g.muzzle(mx, my, this.angle, n > 1 ? 1.3 : 0.9);
    const vd = dist(this.x, this.y, g.player.x, g.player.y);
    AudioSys.sfx(this.boss ? 'boss' : this.weapon, clamp(1 - vd / 500, 0.15, 0.85));
    g.shell(this.x, this.y, this.angle);
    g.noise(this.x, this.y, 180, this);
  }
  stun(a) {
    if (this.boss) return;
    if (this.t === 'm' && Math.random() < 0.6) { this.kb = 1; this.x += Math.cos(a) * 3; this.y += Math.sin(a) * 3; return; }
    this.state = 'down'; this.stunT = 2.0; this.downAngle = a;
    this.x += Math.cos(a) * 5; this.y += Math.sin(a) * 5; Game.world.pushOut(this, this.r);
  }
  disarm(a) {
    if (!['pistol', 'shotgun', 'rifle'].includes(this.weapon)) return;
    const g = Game;
    let ix = this.x + Math.cos(a) * 26, iy = this.y + Math.sin(a) * 26;
    if (!g.world.los(this.x, this.y, ix, iy)) { ix = this.x + Math.cos(a) * 8; iy = this.y + Math.sin(a) * 8; }
    if (g.world.solidAt(ix, iy)) { ix = this.x; iy = this.y; }
    g.addItem(this.weapon, ix, iy, randi(3, 8));
    this.weapon = 'none'; this.unarmed = true;
    this.st = Object.assign({}, this.st, { melee: true, dmg: 7, range: 16, rate: 0.85 });
    g.texts.push({ x: this.x, y: this.y - 14, text: 'DESARMADO', col: '#ffd040', t: 1 });
  }
  rearm(it) {
    const key = { pistol: 'g', shotgun: 'n', rifle: 'f' }[it.type];
    this.st = ETYPES[key]; this.weapon = it.type; this.mag = this.st.mag; this.unarmed = false;
    it.alive = false; this.state = 'engage'; this.alertIcon = 1;
  }
  dogTakedown(a) {
    this.disarm(a + (Math.random() < 0.5 ? 1.2 : -1.2));
    this.state = 'held'; this.stunT = 2.5; this.downAngle = a;
    this.x += Math.cos(a) * 3; this.y += Math.sin(a) * 3; Game.world.pushOut(this, this.r);
  }
  hurt(dmg, a, src) {
    if (!this.alive) return;
    const g = Game;
    this.hp -= dmg; this.flashT = 0.08;
    g.blood(this.x, this.y, a, src === 'exec' ? 14 : 5);
    if (src !== 'punch') { this.x += Math.cos(a) * 1.5; this.y += Math.sin(a) * 1.5; g.world.pushOut(this, this.r); }
    if (this.hp <= 0) { this.die(a, src); return; }
    AudioSys.sfx('hit', 0.7);
    const p = g.player;
    this.lastX = p.x; this.lastY = p.y; this.lastSeen = g.time;
    if (this.state === 'patrol' || this.state === 'search' || this.state === 'chase') {
      this.state = 'alert'; this.reactT = 0.18; this.alertIcon = 1;
    }
    if (!this.st.melee && this.state === 'engage' && this.hp < this.maxHp * 0.6 && Math.random() < this.st.cover * 0.6) this.seekCover(rand(1, 2));
  }
  die(a, src) {
    const g = Game;
    this.alive = false;
    g.addCorpse(this.x, this.y, a, this.pal, (src === 'exec' || src === 'legend') ? 6 : (src === 'shotgun' ? 160 : 90));
    g.bloodPool(this.x + Math.cos(a) * 6, this.y + Math.sin(a) * 6, this.boss ? 18 : 10);
    AudioSys.sfx('death', 0.8);
    // larga a arma
    if (this.weapon === 'pistol') g.addItem('pistol', this.x, this.y, randi(4, 10));
    else if (this.weapon === 'shotgun') g.addItem('shotgun', this.x, this.y, randi(2, 5));
    else if (this.weapon === 'rifle' && !this.boss) g.addItem('rifle', this.x, this.y, randi(8, 20));
    else if (this.st.melee && Math.random() < 0.35) g.addItem('knife', this.x, this.y, 0);
    g.onKill(this, src);
  }

  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    if (x < -30 || y < -30 || x > Game.vw + 30 || y > Game.vh + 30) return;
    const sc = this.boss ? 1.3 : (this.t === 'm' ? 1.08 : 1);
    if (this.state === 'down' || this.state === 'held') {
      let spr = Sprites.corpse(this.pal);
      if (this.flashT > 0) spr = Sprites.silhouette(spr, '#ffffff');
      drawRot(ctx, spr, x, y, this.downAngle, sc);
      if (this.finishing || this.state === 'held') return;
      const t = Game.time * 6;
      ctx.fillStyle = '#ffe040';
      for (let i = 0; i < 3; i++) ctx.fillRect(x + Math.round(Math.cos(t + i * 2.1) * 7), y - 2 + Math.round(Math.sin(t + i * 2.1) * 3), 2, 2);
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x + 1, y + 2, 7 * sc, 6 * sc, 0, 0, TAU); ctx.fill();
    const frame = this.moving ? Math.floor(this.walk) % 8 : -1;
    drawRot(ctx, Sprites.legs(this.pal, frame), x, y, this.moving ? Math.atan2(this.vy, this.vx) : this.angle, sc);
    let pose = this.pose;
    if (pose === 'idle') { if (this.state === 'windup') pose = 'slash2'; else if (this.reloadT > 0) pose = 'reload'; else if (this.recoilT > 0) pose = 'recoil'; }
    let spr = Sprites.char(this.pal, this.weapon, pose);
    if (this.flashT > 0) spr = Sprites.silhouette(spr, '#ffffff');
    else if (this.state === 'windup' && Math.floor(Game.time * 20) % 2) spr = Sprites.silhouette(spr, '#ff4040');
    drawRot(ctx, spr, x, y, this.angle, sc);
    if (this.alertIcon > 0 && this.state !== 'patrol') {
      const col = this.state === 'chase' ? '#ffd040' : '#ff3040';
      PixelFont.draw(ctx, this.state === 'chase' ? '?' : '!', x, y - 17, col, 1, 'center');
    }
  }
}

// =================================================================
// CHEFE FINAL — O ARQUITETO (3 fases)
// =================================================================
class Boss extends Enemy {
  constructor(x, y) {
    super('B', x, y, 'boss');
    this.boss = true; this.r = 8; this.phase = 1; this.state = 'idle';
    this.moveT = 0; this.dashT = 0; this.dashCd = 3; this.spiralCd = 2.5; this.spiralA = 0;
    this.awake = false; this.name = 'O ARQUITETO';
  }
  update(dt) {
    const g = Game, p = g.player, st = this.st;
    this.flashT -= dt; this.recoilT -= dt; this.meleeCd -= dt; this.alertIcon -= dt;
    if (this.poseT > 0) { this.poseT -= dt; if (this.poseT <= 0) this.pose = 'idle'; }
    this.moving = false;
    this.perceive(dt);
    const d = dist(this.x, this.y, p.x, p.y), aToP = Math.atan2(p.y - this.y, p.x - this.x);
    if (!this.awake) {
      if (this.sees || this.hp < this.maxHp) { this.awake = true; g.bossIntro(this); AudioSys.sfx('roar'); }
      else { this.angle = approachAngle(this.angle, Math.PI / 2, dt); return; }
    }
    // transições de fase
    const hpf = this.hp / this.maxHp;
    if (this.phase === 1 && hpf < 0.65) { this.phase = 2; this.weapon = 'shotgun'; AudioSys.sfx('roar'); g.shake(8); g.spawnReinforcements(2); g.toast('O ARQUITETO ESTÁ FURIOSO'); }
    if (this.phase === 2 && hpf < 0.3) { this.phase = 3; this.weapon = 'rifle'; AudioSys.sfx('roar'); g.shake(10); g.spawnReinforcements(3); g.toast('FASE FINAL'); }

    this.angle = approachAngle(this.angle, aToP, (this.phase === 3 ? 6 : 4.5) * dt);
    // investida
    if (this.dashT > 0) {
      this.dashT -= dt;
      const ox = this.x, oy = this.y;
      this.step(Math.cos(this.dashA) * 270, Math.sin(this.dashA) * 270, dt);
      if (Math.random() < 0.6) g.particle(this.x, this.y, 0, 0, 0.35, '#3a1018', 3, 0, 'smoke');
      if (d < 20 && this.meleeCd <= 0) { p.hurt(28, this.dashA); this.meleeCd = 0.8; g.shake(5); }
      if (Math.abs(this.x - ox) + Math.abs(this.y - oy) < 1) this.dashT = 0;
      return;
    }
    // golpe corpo a corpo se o jogador encostar
    if (d < 22 && this.meleeCd <= 0) {
      this.pose = 'bash'; this.poseT = 0.2; this.meleeCd = 0.9;
      if (p.hurt(22, aToP)) AudioSys.sfx('punch');
    }
    // reposicionamento
    this.moveT -= dt;
    if (this.moveT <= 0 || !this.path) {
      let t = null;
      if (!this.sees || Math.random() < 0.35) t = [p.x + rand(-60, 60), p.y + rand(-60, 60)];
      else t = g.world.randomNear(this.x, this.y, 6);
      if (t) this.goTo(t[0], t[1]);
      this.moveT = this.phase === 1 ? rand(2.5, 4) : rand(1.5, 2.5);
    }
    this.follow(this.phase === 1 ? st.speed : st.run, dt);
    if (this.phase >= 2) {
      this.dashCd -= dt;
      if (this.dashCd <= 0 && this.sees && d > 60 && d < 220) { this.dashT = 0.42; this.dashA = aToP; this.dashCd = rand(2.8, 4); AudioSys.sfx('dodge'); }
    }
    // ataques
    this.fireCd -= dt;
    if (this.phase === 3) {
      this.spiralCd -= dt;
      if (this.spiralCd <= 0) {
        const n = 18;
        this.spiralA += 0.4;
        for (let i = 0; i < n; i++) g.spawnBullet(this.x, this.y, this.spiralA + i / n * TAU, 230, 10, 'enemy', 500, 'boss');
        AudioSys.sfx('shotgun', 0.8); g.muzzle(this.x, this.y, 0, 2); g.shake(3);
        this.spiralCd = rand(1.9, 2.6);
      }
    }
    if (!this.sees || this.fireCd > 0) return;
    if (this.phase === 2) {
      for (let i = 0; i < 9; i++) g.spawnBullet(this.x + Math.cos(this.angle) * 13, this.y + Math.sin(this.angle) * 13, this.angle + gauss() * 0.28, 360, 9, 'enemy', 260, 'shotgun');
      g.muzzle(this.x + Math.cos(this.angle) * 13, this.y + Math.sin(this.angle) * 13, this.angle, 1.5);
      AudioSys.sfx('shotgun', 0.9); this.recoilT = 0.08;
      this.fireCd = rand(0.85, 1.15);
    } else {
      this.weapon = 'rifle';
      this.fire();
      this.burstLeft = (this.burstLeft > 0 ? this.burstLeft : st.burst) - 1;
      this.fireCd = this.burstLeft > 0 ? st.rate : st.burstPause * (this.phase === 3 ? 0.8 : 1);
    }
  }
  hurt(dmg, a, src) {
    if (!this.alive) return;
    if (!this.awake) { this.awake = true; Game.bossIntro(this); }
    this.hp -= dmg; this.flashT = 0.06;
    Game.blood(this.x, this.y, a, 3);
    AudioSys.sfx('hit', 0.6);
    if (this.hp <= 0) { this.hp = 0; this.die(a, src); }
  }
  stun() { }
}

// =================================================================
// BARRIL EXPLOSIVO
// =================================================================
class Barrel {
  constructor(x, y) { this.x = x; this.y = y; this.r = 7; this.hp = 30; this.alive = true; this.flashT = 0; }
  hurt(dmg) {
    if (!this.alive) return;
    this.hp -= dmg; this.flashT = 0.06;
    if (this.hp <= 0) { this.alive = false; Game.explode(this.x, this.y); }
  }
  draw(ctx, cx, cy) {
    const s = this.flashT > 0 ? Sprites.silhouette(Sprites.barrel(), '#ffffff') : Sprites.barrel();
    ctx.drawImage(s, Math.round(this.x - cx - 8), Math.round(this.y - cy - 8));
  }
}

// =================================================================
// PITBULL COMPANHEIRO — segue o jogador; ao comando, derruba e desarma o inimigo marcado
// =================================================================
class Dog {
  constructor(x, y) {
    this.x = x; this.y = y; this.r = 4; this.angle = 0; this.state = 'follow'; this.target = null;
    this.path = null; this.pathI = 0; this.repathT = 0; this.holdT = 0; this.walk = 0; this.moving = false; this.t = 0;
  }
  command(e) { this.state = 'attack'; this.target = e; this.path = null; this.repathT = 0; AudioSys.sfx('bark'); }
  step(vx, vy, dt) {
    Game.world.move(this, vx * dt, vy * dt, this.r);
    this.angle = approachAngle(this.angle, Math.atan2(vy, vx), 12 * dt);
    this.moving = true; this.walk += Math.hypot(vx, vy) * dt * 0.16;
  }
  moveTo(tx, ty, speed, dt) {
    const w = Game.world;
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    if (d < 1) return;
    if (w.clearPath(this.x, this.y, tx, ty, this.r)) { this.path = null; const s = Math.min(speed, d / dt); this.step(dx / d * s, dy / d * s, dt); return; }
    this.repathT -= dt;
    if (!this.path || this.repathT <= 0) { this.path = w.findPath(this.x, this.y, tx, ty, 3500); this.pathI = 0; this.repathT = 0.35; }
    if (!this.path || this.pathI >= this.path.length) return;
    if (this.pathI + 1 < this.path.length) { const n = this.path[this.pathI + 1]; if (w.clearPath(this.x, this.y, n[0], n[1], this.r)) this.pathI++; }
    const [nx, ny] = this.path[this.pathI];
    const ex = nx - this.x, ey = ny - this.y, ed = Math.hypot(ex, ey);
    if (ed < 4) { this.pathI++; return; }
    this.step(ex / ed * speed, ey / ed * speed, dt);
  }
  update(dt) {
    const p = Game.player;
    this.moving = false; this.t += dt;
    if (this.state === 'attack') {
      const e = this.target;
      if (!e || !e.alive || e.finishing) { this.state = 'follow'; this.target = null; }
      else if (dist(this.x, this.y, e.x, e.y) < e.r + this.r + 4) this.bite(e);
      else this.moveTo(e.x, e.y, 220, dt);
    } else if (this.state === 'hold') {
      const e = this.target;
      this.holdT -= dt;
      if (!e || !e.alive || this.holdT <= 0) {
        if (e && e.alive && e.state === 'held' && !e.finishing) { e.state = 'engage'; e.reactT = 0; }
        this.state = 'follow'; this.target = null;
      } else {
        const a = this.holdA;
        this.x = e.x - Math.cos(a) * 8; this.y = e.y - Math.sin(a) * 8;
        Game.world.pushOut(this, this.r);
        this.angle = a;
        if (Math.random() < dt * 3) Game.blood(e.x, e.y, a, 1);
      }
    }
    if (this.state === 'follow') {
      if (!p.alive) return;
      if (dist(this.x, this.y, p.x, p.y) > 360) { this.x = p.x; this.y = p.y; this.path = null; return; }
      const back = (p.moving ? p.moveAngle : p.angle) + Math.PI + 0.7;
      const tx = p.x + Math.cos(back) * 15, ty = p.y + Math.sin(back) * 15;
      const d = dist(this.x, this.y, tx, ty);
      if (d > 7 && !Game.world.solidAt(tx, ty)) this.moveTo(tx, ty, Math.min(230, 40 + d * 6), dt);
      else if (d > 20) this.moveTo(p.x, p.y, Math.min(230, 40 + d * 6), dt);
      else this.angle = approachAngle(this.angle, p.angle, 3 * dt);
    }
  }
  bite(e) {
    const g = Game;
    AudioSys.sfx('growl');
    if (e.boss) {
      e.hurt(60, this.angle, 'dog');
      g.toast('O ARQUITETO AFASTOU O CÃO', '#ffd040');
      this.x -= Math.cos(this.angle) * 18; this.y -= Math.sin(this.angle) * 18; g.world.pushOut(this, this.r);
      this.state = 'follow'; this.target = null; return;
    }
    e.dogTakedown(this.angle);
    e.alertIcon = 0;
    this.state = 'hold'; this.holdT = 2.5; this.holdA = this.angle;
    g.shake(3); g.blood(e.x, e.y, this.angle, 5);
    g.texts.push({ x: e.x, y: e.y - 22, text: 'FINALIZE!', col: '#ff3050', t: 1.2 });
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x + 1, y + 2, 7, 4.5, this.angle, 0, TAU); ctx.fill();
    let spr;
    if (this.state === 'hold') spr = Sprites.dog(Math.floor(this.t * 10) % 2 ? 0 : -1, 'bite');
    else if (this.moving) spr = Sprites.dog(Math.floor(this.walk) % 6, 'run');
    else spr = Sprites.dog(Math.floor(this.t * 4) % 6, 'idle');
    drawRot(ctx, spr, x, y, this.angle);
  }
}
