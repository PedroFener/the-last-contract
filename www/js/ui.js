/* ============================================================
   THE LAST CONTRACT - ui.js
   HUD no canvas (vida, munição, pontuação, objetivo, chefe),
   controles virtuais para toque, pós-processamento (vinheta,
   scanlines) e telas DOM (menu, pausa, configurações, fim).
   ============================================================ */
'use strict';

class UI {
  constructor(game) {
    this.game = game;
    this.$ = (id) => document.getElementById(id);
    this.screens = ['menu', 'levels', 'settings', 'help', 'intro', 'pause', 'dead', 'complete', 'credits'];
    this.bind();
    this.showMenu();
  }

  /* ---------------- DOM ---------------- */
  bind() {
    const g = this.game, $ = this.$;
    const click = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', (e) => { e.preventDefault(); g.audio.init(); g.audio.play('ui'); fn(); }); };
    click('btn-play', () => { const idx = Math.min(g.save.unlocked, LEVELS.length) - 1; g.startLevel(g.save.finished ? 0 : idx); });
    click('btn-levels', () => this.showLevels());
    click('btn-settings', () => this.showSettings('menu'));
    click('btn-help', () => this.show('help'));
    click('btn-help-back', () => this.showMenu());
    click('btn-levels-back', () => this.showMenu());
    click('btn-settings-back', () => { if (this.settingsFrom === 'pause') this.showPause(); else this.showMenu(); });
    click('btn-resume', () => g.resume());
    click('btn-restart', () => g.restartLevel());
    click('btn-pause-settings', () => this.showSettings('pause'));
    click('btn-pause-menu', () => g.toMenu());
    click('btn-retry', () => g.restartLevel());
    click('btn-dead-menu', () => g.toMenu());
    click('btn-next', () => g.nextLevel());
    click('btn-complete-retry', () => g.restartLevel());
    click('btn-complete-menu', () => g.toMenu());
    click('btn-credits-back', () => this.showMenu());
    click('btn-reset', () => { if (confirm('Apagar todo o progresso salvo?')) { SaveSys.reset(); g.save = SaveSys.data; g.settings = g.save.settings; this.loadSettingsUI(); g.applySettings(); } });
    const intro = $('screen-intro');
    intro.addEventListener('click', () => g.beginPlay());
    intro.addEventListener('touchend', (e) => { e.preventDefault(); g.beginPlay(); }, { passive: false });
    // configurações
    const s = g.settings;
    const onInput = (id, fn) => { const el = $(id); if (el) el.addEventListener('input', () => { fn(el); g.applySettings(); }); el && el.addEventListener('change', () => { fn(el); g.applySettings(); }); };
    onInput('set-music', (el) => { s.music = parseFloat(el.value); });
    onInput('set-sfx', (el) => { s.sfx = parseFloat(el.value); });
    onInput('set-diff', (el) => { s.difficulty = el.value; });
    onInput('set-scan', (el) => { s.scanlines = el.checked; });
    onInput('set-shake', (el) => { s.shake = el.checked; });
    onInput('set-ctrl', (el) => { s.controlScale = parseFloat(el.value); });
    this.loadSettingsUI();
  }
  loadSettingsUI() {
    const s = this.game.settings, $ = this.$;
    if ($('set-music')) { $('set-music').value = s.music; $('set-sfx').value = s.sfx; $('set-diff').value = s.difficulty; $('set-scan').checked = s.scanlines; $('set-shake').checked = s.shake !== false; $('set-ctrl').value = s.controlScale; }
  }
  hideAll() { for (const s of this.screens) this.$('screen-' + s).classList.remove('active'); this.$('overlay').classList.remove('active'); }
  show(name) { this.hideAll(); this.$('overlay').classList.add('active'); this.$('screen-' + name).classList.add('active'); }
  showMenu() {
    this.show('menu');
    const g = this.game;
    this.$('btn-play').textContent = g.save.unlocked > 1 && !g.save.finished ? 'CONTINUAR (FASE ' + g.save.unlocked + ')' : 'JOGAR';
    this.$('menu-version').textContent = 'v' + CONFIG.VERSION + (U.isMobile() ? ' • toque' : ' • teclado/mouse');
  }
  showLevels() {
    const g = this.game, list = this.$('levels-list'); list.innerHTML = '';
    LEVELS.forEach((L, i) => {
      const unlocked = i < g.save.unlocked;
      const best = g.save.best[L.id];
      const b = document.createElement('button');
      b.className = 'level-btn' + (unlocked ? '' : ' locked');
      b.innerHTML = `<span class="lv-num">${L.id}</span><span class="lv-name">${L.name}<small>${L.subtitle}</small></span><span class="lv-rank">${best ? 'RANK ' + best.rank + '<small>' + best.score.toLocaleString('pt-BR') + ' pts</small>' : (unlocked ? '—' : '🔒')}</span>`;
      if (unlocked) b.addEventListener('click', () => { g.audio.init(); g.audio.play('ui'); g.startLevel(i); });
      list.appendChild(b);
    });
    this.show('levels');
  }
  showSettings(from) { this.settingsFrom = from; this.loadSettingsUI(); this.show('settings'); }
  showIntro(def) {
    this.$('intro-num').textContent = 'FASE ' + def.id;
    this.$('intro-title').textContent = def.name;
    this.$('intro-story').textContent = def.story;
    this.$('intro-obj').textContent = def.objective;
    this.show('intro');
  }
  showPause() { this.show('pause'); }
  showDead(g) {
    this.$('dead-stats').innerHTML = `Inimigos eliminados: <b>${g.kills}/${g.totalEnemies}</b><br>Pontos: <b>${g.score.toLocaleString('pt-BR')}</b><br>Tempo: <b>${U.formatTime(g.levelTime)}</b>`;
    this.show('dead');
  }
  showComplete(def, r) {
    this.$('complete-title').textContent = def.id === LEVELS.length ? 'CONTRATO ENCERRADO' : 'FASE CONCLUÍDA';
    this.$('complete-sub').textContent = def.name;
    const f = (n) => Math.round(n).toLocaleString('pt-BR');
    this.$('complete-stats').innerHTML =
      `<div class="row"><span>Eliminações</span><b>${r.kills}/${r.total_enemies}</b></div>` +
      `<div class="row"><span>Pontos de combate</span><b>${f(r.base)}</b></div>` +
      `<div class="row"><span>Bônus de tempo (${U.formatTime(r.time)})</span><b>+${f(r.timeBonus)}</b></div>` +
      `<div class="row"><span>Precisão (${Math.round(r.acc * 100)}%)</span><b>+${f(r.accBonus)}</b></div>` +
      `<div class="row"><span>Combo máximo</span><b>x${r.comboMax}</b></div>` +
      (r.noDmg ? `<div class="row"><span>Sem dano</span><b>+${f(r.noDmg)}</b></div>` : `<div class="row"><span>Dano sofrido</span><b class="neg">-${f(r.dmgPen)}</b></div>`) +
      `<div class="row total"><span>TOTAL</span><b>${f(r.total)}</b></div>`;
    const rk = this.$('complete-rank'); rk.textContent = r.rank; rk.className = 'rank rank-' + r.rank;
    this.$('btn-next').textContent = r.isLast ? 'CRÉDITOS' : 'PRÓXIMA FASE';
    this.show('complete');
  }
  showCredits() { this.show('credits'); }

  /* ---------------- CANVAS: pós-processamento ---------------- */
  buildOverlays(W, H) {
    this.vignette = document.createElement('canvas'); this.vignette.width = W; this.vignette.height = H;
    const v = this.vignette.getContext('2d');
    const g = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.62)');
    v.fillStyle = g; v.fillRect(0, 0, W, H);
    this.scan = document.createElement('canvas'); this.scan.width = W; this.scan.height = H;
    const s = this.scan.getContext('2d'); s.fillStyle = 'rgba(0,0,0,0.13)';
    for (let y = 0; y < H; y += 2) s.fillRect(0, y, W, 1);
    this.hurt = document.createElement('canvas'); this.hurt.width = W; this.hurt.height = H;
    const h = this.hurt.getContext('2d');
    const hg = h.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    hg.addColorStop(0, 'rgba(200,0,30,0)'); hg.addColorStop(1, 'rgba(200,0,30,0.7)');
    h.fillStyle = hg; h.fillRect(0, 0, W, H);
  }

  drawMenuBackground(ctx, W, H, t) {
    ctx.fillStyle = '#07050f'; ctx.fillRect(0, 0, W, H);
    // horizonte e grade neon
    const hy = H * 0.58;
    const sky = ctx.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0, '#07050f'); sky.addColorStop(1, '#3a0c3a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hy);
    // sol
    const sun = ctx.createRadialGradient(W / 2, hy - 10, 5, W / 2, hy - 10, 70);
    sun.addColorStop(0, 'rgba(255,60,120,0.9)'); sun.addColorStop(1, 'rgba(255,60,120,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, hy);
    // prédios
    const rng = U.seeded(42);
    ctx.fillStyle = '#0a0812';
    for (let x = 0; x < W; x += 0) { const w = 10 + rng() * 22, h = 20 + rng() * 70; ctx.fillRect(x, hy - h, w, h); x += w + 2 + rng() * 4; }
    const rng2 = U.seeded(7);
    for (let i = 0; i < 90; i++) { const x = rng2() * W, y = hy - rng2() * 80; if (Math.sin(t * 2 + i) > -0.6) { ctx.fillStyle = i % 3 ? 'rgba(255,220,150,0.6)' : 'rgba(80,220,255,0.7)'; ctx.fillRect(x, y, 1, 1); } }
    // grade
    ctx.strokeStyle = 'rgba(255,42,120,0.45)'; ctx.lineWidth = 1;
    ctx.fillStyle = '#12061a'; ctx.fillRect(0, hy, W, H - hy);
    for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 12, hy); ctx.lineTo(W / 2 + i * 90, H); ctx.stroke(); }
    const off = (t * 20) % 20;
    for (let i = 0; i < 10; i++) { const y = hy + Math.pow((i * 20 + off) / 200, 1.6) * (H - hy); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.drawImage(this.vignette, 0, 0);
  }

  /* ---------------- HUD ---------------- */
  drawHUD(ctx, g, W, H) {
    const p = g.player, inp = g.input;
    ctx.font = 'bold 8px monospace'; ctx.textBaseline = 'top';
    // dano / vida baixa
    if (g.hudFlash > 0) { ctx.globalAlpha = g.hudFlash * 2; ctx.drawImage(this.hurt, 0, 0); ctx.globalAlpha = 1; }
    if (!p.dead && p.hp < 30) { ctx.globalAlpha = 0.25 + Math.sin(p.lowHpPulse * 5) * 0.15; ctx.drawImage(this.hurt, 0, 0); ctx.globalAlpha = 1; }
    ctx.drawImage(this.vignette, 0, 0);
    if (g.settings.scanlines) ctx.drawImage(this.scan, 0, 0);
    if (g.state === 'intro') return;

    // ---- vida ----
    const bx = 6, by = 6;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx - 2, by - 2, 70, 28);
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(bx, by, 62, 6);
    const hpw = Math.round(60 * U.clamp(p.hp / p.maxHp, 0, 1));
    ctx.fillStyle = p.hp < 30 ? '#ff2a4a' : '#4fff8f'; ctx.fillRect(bx + 1, by + 1, hpw, 4);
    ctx.fillStyle = '#fff'; ctx.fillText('VIDA ' + Math.ceil(p.hp), bx, by + 8);
    // ---- arma ----
    const w = p.current, def = w.def;
    const icon = Sprites.items[def.icon];
    if (icon) ctx.drawImage(icon, bx, by + 17);
    ctx.fillStyle = '#ffd24f';
    let ammoTxt = def.kind === 'gun' ? (p.reloading > 0 ? 'RECARREGANDO' : w.mag + ' / ' + w.reserve) : '—';
    ctx.fillText(def.name.toUpperCase() + '  ' + ammoTxt, bx + 18, by + 18);
    // slots
    let sx = bx + 76;
    [p.guns[0], p.guns[1], p.melee].forEach((s, i) => {
      const active = (i === 2 && p.slot === 2) || (i < 2 && p.slot === i);
      ctx.fillStyle = active ? 'rgba(79,216,255,0.35)' : 'rgba(0,0,0,0.45)'; ctx.fillRect(sx, by - 2, 14, 12);
      if (s) { const ic = Sprites.items[s.def.icon]; if (ic) ctx.drawImage(ic, sx + 7 - ic.width / 2, by + 4 - ic.height / 2); }
      ctx.fillStyle = active ? '#4fd8ff' : '#666'; ctx.fillText(String(i + 1), sx + 1, by - 1);
      sx += 16;
    });

    // ---- objetivo (centro) ----
    const obj = g.objectiveText();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(W / 2 - 60, 4, 120, 12);
    ctx.fillStyle = g.exitActive ? '#4fff8f' : '#dcdcff'; ctx.fillText(obj, W / 2, 6);
    // ---- chefe ----
    if (g.boss && !g.boss.dead && g.boss.alert >= 1) {
      const bw = Math.min(200, W - 60), bxx = W / 2 - bw / 2, byy = 20;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bxx - 2, byy - 2, bw + 4, 10);
      ctx.fillStyle = '#2a0a12'; ctx.fillRect(bxx, byy, bw, 6);
      ctx.fillStyle = '#ff2a4a'; ctx.fillRect(bxx, byy, Math.round(bw * g.boss.hp / g.boss.maxHp), 6);
      ctx.fillStyle = '#fff'; ctx.fillText(g.boss.def.name.toUpperCase(), W / 2, byy + 9);
    }
    // ---- pontuação / combo / tempo (direita) ----
    ctx.textAlign = 'right';
    const rx = W - (inp.touchActive ? 30 : 6);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(rx - 78, 4, 80, 24);
    ctx.fillStyle = '#fff'; ctx.fillText(g.score.toLocaleString('pt-BR') + ' PTS', rx, 6);
    ctx.fillStyle = '#aaa'; ctx.fillText(U.formatTime(g.levelTime), rx, 16);
    if (g.combo > 1) {
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = g.combo >= 4 ? '#ff4f6d' : '#ffd24f'; ctx.fillText('COMBO x' + g.combo, rx, 30);
      ctx.fillStyle = '#1a1a22'; ctx.fillRect(rx - 60, 42, 60, 3);
      ctx.fillStyle = '#ffd24f'; ctx.fillRect(rx - 60, 42, Math.round(60 * g.comboTimer / CONFIG.COMBO_WINDOW), 3);
      ctx.font = 'bold 8px monospace';
    }
    ctx.textAlign = 'center';
    // ---- mensagens ----
    let my = H * 0.22;
    for (const m of g.messages) {
      const a = Math.min(1, m.t / 0.5);
      ctx.globalAlpha = a; ctx.font = 'bold 9px monospace';
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - 100, my - 2, 200, 13);
      ctx.fillStyle = '#ffd24f'; ctx.fillText(m.text, W / 2, my);
      my += 15; ctx.globalAlpha = 1;
    }
    ctx.font = 'bold 8px monospace';
    // ---- dica de item ----
    if (!p.dead) {
      const pk = g.pickupNear(p.x, p.y, 12, true);
      if (pk) {
        const def2 = WEAPONS[pk.kind];
        const have = def2.kind === 'gun' ? p.guns.some(x => x && x.def.id === def2.id) : false;
        if (!have && (def2.kind === 'melee' ? p.melee.def.id !== 'fists' : (p.guns[0] && p.guns[1]))) {
          ctx.fillStyle = '#4fd8ff';
          ctx.fillText((inp.touchActive ? '[ARMA]' : (inp.gamepadActive ? '[Y]' : '[E]')) + ' TROCAR POR ' + def2.name.toUpperCase(), W / 2, H - (inp.touchActive ? 70 : 20));
        }
      }
    }
    ctx.textAlign = 'left';
    // ---- mira (mouse) ----
    if (inp.aimMode === 'mouse' && !inp.touchActive && !p.dead && g.state === 'playing') {
      const mx = inp.mouse.x, my2 = inp.mouse.y;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(mx, my2, 4, 0, 7); ctx.stroke();
      ctx.fillStyle = '#ff2a4a'; ctx.fillRect(mx - 0.5, my2 - 0.5, 1, 1);
      if (p.reloading > 0) { ctx.strokeStyle = '#ffd24f'; ctx.beginPath(); ctx.arc(mx, my2, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.reloading / p.reloadTotal)); ctx.stroke(); }
    }
    // ---- controles virtuais ----
    if (inp.touchActive) this.drawTouch(ctx, inp, p, W, H);
    // fps (debug leve)
    if (g.settings.showFps) { ctx.fillStyle = '#0f0'; ctx.fillText(g.fps + ' fps', 6, H - 10); }
    ctx.textBaseline = 'alphabetic';
  }

  drawTouch(ctx, inp, p, W, H) {
    const s = inp.controlScale;
    // joystick esquerdo
    const j = inp.joy;
    const jx = j.active ? j.ox : 56 * s, jy = j.active ? j.oy : H - 56 * s;
    ctx.globalAlpha = j.active ? 0.55 : 0.28;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(jx, jy, 26 * s, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(jx + j.dx * 26 * s, jy + j.dy * 26 * s, 11 * s, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    // stick de mira
    const a = inp.aimStick;
    if (a.active) {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = a.mag > 0.72 ? '#ff4f6d' : '#4fd8ff';
      ctx.beginPath(); ctx.arc(a.ox, a.oy, 30 * s, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(a.ox, a.oy, 30 * s * 0.72, 0, 7); ctx.stroke();
      ctx.fillStyle = a.mag > 0.72 ? 'rgba(255,79,109,0.6)' : 'rgba(79,216,255,0.5)';
      ctx.beginPath(); ctx.arc(a.ox + a.dx * 30 * s, a.oy + a.dy * 30 * s, 10 * s, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 0.18; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#fff'; ctx.fillText('ARRASTE PARA MIRAR • EMPURRE PARA ATIRAR', W * 0.7, H - 8);
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
    }
    // botões
    ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const b of inp.buttons) {
      const held = inp.held[b.id];
      let label = b.label;
      if (b.id === 'swap') { const pk = this.game.pickupNear(p.x, p.y, 12, true); if (pk) label = 'PEGAR'; }
      if (b.id === 'dodge' && p.dodgeCd > 0) ctx.globalAlpha = 0.25; else ctx.globalAlpha = held ? 0.9 : 0.5;
      ctx.fillStyle = held ? b.color : 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      ctx.strokeStyle = b.color; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = held ? '#000' : b.color; ctx.fillText(label, b.x, b.y + 0.5);
      if (b.id === 'reload' && p.current.def.kind === 'gun' && p.current.mag === 0) { ctx.strokeStyle = '#ff4f6d'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 3, 0, 7); ctx.stroke(); }
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = 'bold 8px monospace';
  }
}
