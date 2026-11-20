/* ============================================================
   THE LAST CONTRACT - game.js
   Núcleo: loop principal, estados, câmera, renderização em camadas
   (cenário pré-renderizado + decalques + entidades + luz neon),
   objetivos das fases, pontuação, combo e progressão.
   ============================================================ */
'use strict';

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.viewW = 480; this.viewH = CONFIG.VIEW_H;
    this.input = new Input(this.canvas);
    this.audio = new AudioSys();
    this.save = SaveSys.load();
    this.settings = this.save.settings;
    this.state = 'menu';
    this.levelIndex = 0; this.level = null; this.player = null;
    this.enemies = []; this.corpses = []; this.pickups = []; this.barrels = [];
    this.bullets = new Bullets(this); this.particles = null;
    this.cam = { x: 0, y: 0 }; this.shakeAmt = 0; this.shakeX = 0; this.shakeY = 0;
    this.time = 0; this.levelTime = 0; this.lastTs = 0; this.accum = 0;
    this.score = 0; this.combo = 0; this.comboTimer = 0; this.comboMax = 0; this.kills = 0;
    this.hudFlash = 0; this.dynLights = []; this.exitActive = false; this.boss = null;
    this.endTimer = 0; this.slowMo = 1; this.fps = 60; this.fpsAcc = 0; this.fpsN = 0;
    this.difficulty = DIFFICULTY[this.settings.difficulty] || DIFFICULTY.normal;
    this.totalEnemies = 0; this.messages = [];
    this.lightCanvas = document.createElement('canvas'); this.lctx = this.lightCanvas.getContext('2d');
    Sprites.build();
    this.ui = new UI(this);
    this.applySettings();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.input.onPause = () => { if (this.state === 'playing') this.pause(); };
    // inicializa áudio no primeiro gesto
    const unlock = () => { this.audio.init(); };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); });
    requestAnimationFrame((t) => this.loop(t));
  }

  /* ---------------- CONFIGURAÇÕES / VIEWPORT ---------------- */
  applySettings() {
    const s = this.settings;
    this.audio.setMusicVol(s.music); this.audio.setSfxVol(s.sfx);
    this.difficulty = DIFFICULTY[s.difficulty] || DIFFICULTY.normal;
    this.input.controlScale = s.controlScale || 1; this.input.layout();
    SaveSys.save();
  }
  resize() {
    const ww = window.innerWidth, wh = window.innerHeight;
    const aspect = ww / wh;
    let vh = CONFIG.VIEW_H, vw = Math.round(vh * aspect);
    if (aspect < 1) { vw = 270; vh = Math.round(vw / aspect); }
    vw = U.clamp(vw, CONFIG.VIEW_MIN_W, CONFIG.VIEW_MAX_W);
    vh = U.clamp(vh, 200, 600);
    this.viewW = vw; this.viewH = vh;
    this.canvas.width = vw; this.canvas.height = vh;
    this.canvas.style.width = ww + 'px'; this.canvas.style.height = wh + 'px';
    this.ctx.imageSmoothingEnabled = false;
    this.lightCanvas.width = vw; this.lightCanvas.height = vh;
    this.input.setView(vw, vh, ww / vw);
    this.ui.buildOverlays(vw, vh);
  }

  /* ---------------- FLUXO DE FASES ---------------- */
  startLevel(idx) {
    this.levelIndex = idx;
    const def = LEVELS[idx];
    this.level = new Level(def);
    this.particles = new Particles(this.level);
    this.bullets.clear();
    this.enemies = []; this.corpses = []; this.pickups = []; this.barrels = []; this.dynLights = []; this.messages = [];
    this.player = new Player(this, this.level.playerStart.x, this.level.playerStart.y, def.loadout);
    for (const e of this.level.enemies) this.enemies.push(new Enemy(this, e.type, e.x, e.y));
    for (const p of this.level.pickups) this.pickups.push(new Pickup(p.kind, p.x, p.y, WEAPONS[p.kind] ? WEAPONS[p.kind].mag + 10 : 0));
    for (const b of this.level.barrels) this.barrels.push(new Barrel(b.x, b.y, this.level));
    this.boss = this.enemies.find(e => e.def.isBoss) || null;
    this.totalEnemies = this.enemies.length;
    this.score = 0; this.combo = 0; this.comboTimer = 0; this.comboMax = 0; this.kills = 0; this.levelTime = 0;
    this.exitActive = false; this.endTimer = 0; this.slowMo = 1; this.hudFlash = 0;
    this.cam.x = this.player.x - this.viewW / 2; this.cam.y = this.player.y - this.viewH / 2;
    this.input.reset();
    this.state = 'intro';
    this.ui.showIntro(def);
    if (this.audio.ready) this.audio.music.start('menu');
  }
  beginPlay() {
    if (this.state !== 'intro') return;
    this.audio.init();
    this.state = 'playing';
    this.ui.hideAll();
    const def = LEVELS[this.levelIndex];
    if (this.audio.ready) this.audio.music.start(def.music);
    this.message(def.objective, 3.5);
  }
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused'; this.ui.showPause(); this.input.reset();
  }
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing'; this.ui.hideAll(); this.input.reset();
    this.audio.resume();
  }
  restartLevel() { this.startLevel(this.levelIndex); }
  toMenu() {
    this.state = 'menu'; this.ui.showMenu();
    if (this.audio.ready) this.audio.music.start('menu');
  }
  nextLevel() {
    if (this.levelIndex + 1 < LEVELS.length) this.startLevel(this.levelIndex + 1);
    else { this.ui.showCredits(); this.state = 'menu'; if (this.audio.ready) this.audio.music.start('menu'); }
  }

  /* ---------------- EVENTOS DE JOGO ---------------- */
  shake(a) { if (this.settings.shake === false) return; this.shakeAmt = Math.min(12, this.shakeAmt + a); }
  message(text, dur) { this.messages.push({ text, t: dur || 2.5, max: dur || 2.5 }); if (this.messages.length > 3) this.messages.shift(); }
  dynamicLight(x, y, r, life, color) { this.dynLights.push({ x, y, r, life, max: life, color: color || '#ffffff' }); if (this.dynLights.length > 24) this.dynLights.shift(); }
  noise(x, y, radius, kind) {
    for (const e of this.enemies) { if (e.dead) continue; if (U.dist2(e.x, e.y, x, y) < radius * radius) e.onNoise(x, y, radius > 150); }
  }
  alertNearby(x, y, radius, src) {
    for (const e of this.enemies) { if (e === src || e.dead) continue; if (U.dist2(e.x, e.y, x, y) < radius * radius) e.onAlly(this.player.x, this.player.y); }
  }
  pickupNear(x, y, r, weaponsOnly) {
    for (const p of this.pickups) { if (p.dead) continue; if (weaponsOnly && !p.isWeapon) continue; if (U.dist2(p.x, p.y, x, y) < r * r) return p; }
    return null;
  }
  resetCombo() { if (this.combo > 0) { this.combo = 0; this.comboTimer = 0; } }
  addScore(pts, x, y, label, color) {
    this.score += pts;
    if (x !== undefined) this.particles.text(x, y, (label || '') + '+' + pts, color || '#fff', pts >= 500);
  }
  onEnemyKilled(e, kind) {
    this.kills++;
    this.player.stats.kills++;
    if (kind === 'melee' || kind === 'knife') this.player.stats.meleeKills++;
    this.combo = Math.min(CONFIG.COMBO_MAX, this.combo + 1); this.comboTimer = CONFIG.COMBO_WINDOW;
    this.comboMax = Math.max(this.comboMax, this.combo);
    let pts = e.def.score;
    if (kind === 'melee' || kind === 'knife') pts += SCORE.MELEE_BONUS;
    pts *= Math.max(1, this.combo);
    this.addScore(pts, e.x, e.y - 8, this.combo > 1 ? 'x' + this.combo + ' ' : '', this.combo > 3 ? '#ff4f6d' : (this.combo > 1 ? '#ffd24f' : '#fff'));
    if (this.combo > 1) this.audio.play('combo');
    this.shake(1.5);
    if (e.def.isTarget) { this.message('ALVO ELIMINADO. Vá para a saída.', 4); this.audio.play('level_clear'); }
    if (e.def.isBoss) { this.boss = e; this.slowMo = 0.3; this.endTimer = 2.2; this.message('CONTRATO ENCERRADO.', 4); this.audio.play('level_clear'); if (this.audio.ready) this.audio.music.stop(); }
    this.checkObjective();
  }
  onPlayerDied() {
    this.slowMo = 0.35; this.endTimer = 1.6; this.resetCombo();
    if (this.audio.ready) this.audio.music.stop();
  }
  bossPhase(boss, phase) {
    this.audio.play('boss_phase'); this.shake(8);
    this.message(phase === 2 ? 'BELASCO CHAMA REFORÇOS!' : 'BELASCO ESTÁ FURIOSO!', 3);
    const def = LEVELS[this.levelIndex];
    const spawns = (def.reinforcements && def.reinforcements[phase]) || [];
    for (const s of spawns) {
      const e = new Enemy(this, s[0], s[1] * CONFIG.TILE + 8, s[2] * CONFIG.TILE + 8);
      e.alert = 1; e.state = e.ranged ? 'chase' : 'chase'; e.lastSeen = { x: this.player.x, y: this.player.y }; e.lastSeenT = this.time;
      this.enemies.push(e); this.totalEnemies++;
      this.particles.smoke(e.x, e.y, 6, 'rgba(255,60,60,0.5)');
    }
  }
  get enemiesAlive() { let n = 0; for (const e of this.enemies) if (!e.dead) n++; return n; }
  checkObjective() {
    const def = LEVELS[this.levelIndex];
    if (this.exitActive) return;
    if (def.objectiveType === 'killAll' && this.enemiesAlive === 0) { this.exitActive = true; this.message('ÁREA LIMPA. Vá para a saída.', 4); this.audio.play('level_clear'); }
    else if (def.objectiveType === 'killTarget') { const t = this.enemies.find(e => e.def.isTarget); if (t && t.dead) this.exitActive = true; }
  }
  objectiveText() {
    const def = LEVELS[this.levelIndex];
    if (this.exitActive) return 'VÁ PARA A SAÍDA';
    if (def.objectiveType === 'killAll') return 'INIMIGOS ' + (this.totalEnemies - this.enemiesAlive) + '/' + this.totalEnemies;
    if (def.objectiveType === 'killTarget') return 'ELIMINE O ALVO  (' + (this.totalEnemies - this.enemiesAlive) + '/' + this.totalEnemies + ')';
    if (def.objectiveType === 'boss') return 'DERROTE BELASCO';
    return '';
  }
  completeLevel() {
    this.state = 'complete';
    const def = LEVELS[this.levelIndex], st = this.player.stats;
    const acc = st.shots > 0 ? st.hits / st.shots : 1;
    const timeBonus = Math.max(0, Math.round((def.parTime - this.levelTime) * SCORE.TIME_BONUS_PER_SEC));
    const accBonus = Math.round(Math.min(1, acc) * SCORE.ACCURACY_BONUS);
    const dmgPen = Math.round(st.damageTaken * SCORE.DAMAGE_PENALTY);
    const noDmg = st.damageTaken === 0 ? SCORE.NO_DAMAGE_BONUS : 0;
    const total = Math.max(0, this.score + timeBonus + accBonus + noDmg - dmgPen);
    const ratio = total / def.parScore;
    const rank = ratio >= 1 ? 'S' : ratio >= 0.8 ? 'A' : ratio >= 0.6 ? 'B' : ratio >= 0.4 ? 'C' : 'D';
    const result = { score: total, rank, time: Math.round(this.levelTime), kills: this.kills };
    SaveSys.recordLevel(def.id, result);
    this.ui.showComplete(def, { base: this.score, timeBonus, accBonus, dmgPen, noDmg, total, rank, acc, time: this.levelTime, kills: this.kills, total_enemies: this.totalEnemies, comboMax: this.comboMax, isLast: this.levelIndex === LEVELS.length - 1 });
    if (this.audio.ready) this.audio.music.start('menu');
  }

  /* ---------------- LOOP ---------------- */
  loop(ts) {
    requestAnimationFrame((t) => this.loop(t));
    let dt = (ts - this.lastTs) / 1000; this.lastTs = ts;
    if (!(dt > 0) || dt > 0.25) dt = 1 / 60;
    this.fpsAcc += dt; this.fpsN++; if (this.fpsAcc >= 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    dt = Math.min(dt, CONFIG.MAX_DT);
    const inp = this.input.read();
    if (this.state === 'playing') {
      if (inp.pause) { this.pause(); }
      else this.update(dt * this.slowMo, inp, dt);
    } else if (this.state === 'intro') {
      if (inp.confirm || inp.firePressed || inp.dodge) this.beginPlay();
    } else if (this.state === 'paused') {
      if (inp.pause) this.resume();
    }
    this.input.endFrame();
    this.render();
  }

  update(dt, inp, realDt) {
    this.time += dt;
    const p = this.player, lvl = this.level;
    if (!p.dead && this.state === 'playing') this.levelTime += dt;
    p.update(dt, inp);
    for (const e of this.enemies) e.update(dt);
    this.bullets.update(dt);
    for (const b of this.barrels) b.update(dt, this);
    this.particles.update(dt);
    lvl.updateDoors(dt, [p, ...this.enemies], this.audio);
    // itens
    if (!p.dead) for (const pk of this.pickups) {
      if (pk.dead) continue;
      if (U.dist2(pk.x, pk.y, p.x, p.y) < 100) {
        if (pk.kind === 'medkit') { if (p.hp < p.maxHp) { p.heal(50); pk.dead = true; this.audio.play('health'); this.particles.text(p.x, p.y - 12, '+50 VIDA', '#4fff8f'); } }
        else if (pk.kind === 'ammo') {
          let got = false;
          for (const w of p.guns) if (w && w.reserve < w.def.maxReserve) { w.reserve = Math.min(w.def.maxReserve, w.reserve + w.def.mag * 2); got = true; }
          if (got) { pk.dead = true; this.audio.play('pickup'); this.particles.text(p.x, p.y - 12, '+MUNIÇÃO', '#ffd24f'); }
        } else if (pk.isWeapon && pk.t !== -1) {
          // pega automaticamente se houver slot livre ou se já tiver a arma (munição)
          const def = WEAPONS[pk.kind];
          const have = def.kind === 'gun' ? p.guns.some(w => w && w.def.id === def.id) : p.melee.def.id === def.id;
          const free = def.kind === 'gun' ? (!p.guns[0] || !p.guns[1]) : p.melee.def.id === 'fists';
          if (have || free) p.swapWithPickup(pk);
        }
      }
    }
    this.pickups = this.pickups.filter(pk => !pk.dead);
    // combo
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.resetCombo(); }
    // mensagens / luzes dinâmicas
    for (let i = this.messages.length - 1; i >= 0; i--) { this.messages[i].t -= realDt; if (this.messages[i].t <= 0) this.messages.splice(i, 1); }
    for (let i = this.dynLights.length - 1; i >= 0; i--) { this.dynLights[i].life -= dt; if (this.dynLights[i].life <= 0) this.dynLights.splice(i, 1); }
    this.hudFlash = Math.max(0, this.hudFlash - realDt);
    // câmera
    const lookX = Math.cos(p.aim) * 18, lookY = Math.sin(p.aim) * 18;
    let tx = p.x + lookX - this.viewW / 2, ty = p.y + lookY - this.viewH / 2;
    tx = U.clamp(tx, 0, Math.max(0, lvl.pw - this.viewW)); ty = U.clamp(ty, 0, Math.max(0, lvl.ph - this.viewH));
    if (lvl.pw < this.viewW) tx = (lvl.pw - this.viewW) / 2;
    if (lvl.ph < this.viewH) ty = (lvl.ph - this.viewH) / 2;
    const k = 1 - Math.pow(0.001, realDt);
    this.cam.x += (tx - this.cam.x) * k * 0.9; this.cam.y += (ty - this.cam.y) * k * 0.9;
    this.shakeAmt = Math.max(0, this.shakeAmt - realDt * 30);
    this.shakeX = U.rand(-1, 1) * this.shakeAmt; this.shakeY = U.rand(-1, 1) * this.shakeAmt;
    // fim de fase / morte
    if (this.endTimer > 0) {
      this.endTimer -= realDt;
      if (this.endTimer <= 0) {
        this.slowMo = 1;
        if (p.dead) { this.state = 'dead'; this.ui.showDead(this); }
        else this.completeLevel();
      }
    } else if (!p.dead) {
      if (this.exitActive && lvl.isOnExit(p.x, p.y)) { this.endTimer = 0.6; this.audio.play('level_clear'); }
    }
  }

  /* ---------------- RENDERIZAÇÃO ---------------- */
  render() {
    const ctx = this.ctx, W = this.viewW, H = this.viewH;
    if (!this.level) { this.ui.drawMenuBackground(ctx, W, H, this.time); this.time += 1 / 60; return; }
    const camX = Math.round(this.cam.x + this.shakeX), camY = Math.round(this.cam.y + this.shakeY);
    const lvl = this.level;
    ctx.fillStyle = '#05040a'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(-camX, -camY);
    // cenário pré-renderizado (apenas a região visível)
    const sx = Math.max(0, camX), sy = Math.max(0, camY);
    const sw = Math.min(lvl.pw - sx, W + (camX < 0 ? camX : 0)), sh = Math.min(lvl.ph - sy, H + (camY < 0 ? camY : 0));
    if (sw > 0 && sh > 0) {
      ctx.drawImage(lvl.canvas, sx, sy, sw, sh, sx, sy, sw, sh);
      ctx.drawImage(lvl.decals, sx, sy, sw, sh, sx, sy, sw, sh);
    }
    lvl.drawExit(ctx, this.time, this.exitActive);
    // corpos
    for (const c of this.corpses) if (this._visible(c.x, c.y, camX, camY)) Sprites.drawDead(ctx, c.x, c.y, c.palette, c.angle, c.scale);
    lvl.drawDoors(ctx);
    for (const pk of this.pickups) if (this._visible(pk.x, pk.y, camX, camY)) pk.draw(ctx, this.time);
    for (const b of this.barrels) if (this._visible(b.x, b.y, camX, camY)) b.draw(ctx);
    this.bullets.draw(ctx);
    for (const e of this.enemies) if (!e.dead && this._visible(e.x, e.y, camX, camY)) e.draw(ctx);
    this.player.draw(ctx);
    this.particles.draw(ctx);
    ctx.restore();

    // ---- passada de luz (multiplicação) ----
    const lc = this.lctx;
    lc.globalCompositeOperation = 'source-over';
    lc.fillStyle = '#000'; lc.fillRect(0, 0, W, H);
    if (sw > 0 && sh > 0) lc.drawImage(lvl.lightmap, sx, sy, sw, sh, sx - camX, sy - camY, sw, sh);
    lc.globalCompositeOperation = 'lighter';
    // luz suave ao redor do jogador
    this._light(lc, this.player.x - camX, this.player.y - camY, 46, 'rgba(255,245,230,0.45)');
    for (const l of this.dynLights) {
      const a = Math.max(0, l.life / l.max);
      this._light(lc, l.x - camX, l.y - camY, l.r, U.rgba(l.color, 0.8 * a));
    }
    // clarões de tiro das partículas
    for (const pt of this.particles.list) if (pt.type === 'flash') this._light(lc, pt.x - camX, pt.y - camY, pt.size * 3.5, `rgba(255,220,150,${0.8 * Math.max(0, pt.life / pt.maxLife)})`);
    lc.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.lightCanvas, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.save(); ctx.translate(-camX, -camY);
    this.particles.drawLights(ctx);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    // textos flutuantes
    ctx.save(); ctx.translate(-camX, -camY); this.particles.drawTexts(ctx); ctx.restore();
    // HUD e pós-processamento
    this.ui.drawHUD(ctx, this, W, H);
  }
  _visible(x, y, camX, camY) { return x > camX - 24 && x < camX + this.viewW + 24 && y > camY - 24 && y < camY + this.viewH + 24; }
  _light(c, x, y, r, color) {
    const g = c.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

window.addEventListener('load', () => { window.game = new Game(); });
