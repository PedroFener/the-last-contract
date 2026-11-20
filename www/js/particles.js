/* ============================================================
   THE LAST CONTRACT - particles.js
   Sistema de partículas leve (sangue, faíscas, cápsulas, fumaça,
   explosões, textos flutuantes). Usa pool para evitar alocações.
   ============================================================ */
'use strict';

class Particles {
  constructor(level) {
    this.level = level;
    this.list = [];
    this.pool = [];
    this.texts = [];
  }
  _get() { return this.pool.length ? this.pool.pop() : {}; }
  spawn(p) {
    if (this.list.length >= CONFIG.MAX_PARTICLES) {
      const old = this.list.shift(); this.pool.push(old);
    }
    const o = this._get();
    o.type = p.type; o.x = p.x; o.y = p.y; o.vx = p.vx || 0; o.vy = p.vy || 0;
    o.life = p.life || 0.5; o.maxLife = o.life; o.size = p.size || 1; o.color = p.color || '#fff';
    o.drag = p.drag === undefined ? 0.9 : p.drag; o.grow = p.grow || 0; o.decal = !!p.decal; o.bounce = p.bounce || 0;
    o.z = p.z || 0; o.vz = p.vz || 0;
    this.list.push(o);
    return o;
  }

  blood(x, y, angle, amount, spread) {
    for (let i = 0; i < amount; i++) {
      const a = angle + U.rand(-(spread || 0.9), spread || 0.9);
      const s = U.rand(40, 160);
      this.spawn({ type: 'blood', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.2, 0.5), size: U.rand(1, 2.4), color: U.pick(['#b3121f', '#8a0f19', '#d81a2a']), drag: 0.82, decal: true });
    }
  }
  sparks(x, y, angle, amount) {
    for (let i = 0; i < amount; i++) {
      const a = angle + Math.PI + U.rand(-1.1, 1.1);
      const s = U.rand(60, 200);
      this.spawn({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.08, 0.25), size: 1, color: U.pick(['#fff1a8', '#ffd24f', '#ff9a3c']), drag: 0.85 });
    }
  }
  shell(x, y, angle) {
    const a = angle + Math.PI / 2 + U.rand(-0.5, 0.5);
    const s = U.rand(30, 70);
    this.spawn({ type: 'shell', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.5, 0.8), size: 1, color: '#e2b23a', drag: 0.9, decal: true, vz: 60, z: 4 });
  }
  smoke(x, y, amount, color) {
    for (let i = 0; i < amount; i++) {
      this.spawn({ type: 'smoke', x: x + U.rand(-3, 3), y: y + U.rand(-3, 3), vx: U.rand(-15, 15), vy: U.rand(-25, -5), life: U.rand(0.5, 1.1), size: U.rand(2, 4), color: color || 'rgba(120,120,130,0.5)', drag: 0.96, grow: 4 });
    }
  }
  muzzle(x, y, angle, size) {
    this.spawn({ type: 'flash', x, y, vx: 0, vy: 0, life: 0.05, size: size || 14, color: '#ffe9a0', angle });
    this.list[this.list.length - 1].angle = angle;
  }
  explosion(x, y, radius) {
    this.spawn({ type: 'ring', x, y, life: 0.35, size: 4, grow: radius * 2.6, color: '#ffb347' });
    this.spawn({ type: 'flash', x, y, life: 0.12, size: radius, color: '#fff3c0', angle: 0 });
    for (let i = 0; i < 26; i++) {
      const a = U.rand(0, Math.PI * 2), s = U.rand(40, 260);
      this.spawn({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.2, 0.6), size: U.rand(1, 2), color: U.pick(['#ffd24f', '#ff7a2a', '#ffffff', '#ff3a3a']), drag: 0.88 });
    }
    this.smoke(x, y, 14, 'rgba(60,55,60,0.6)');
    for (let i = 0; i < 10; i++) {
      const a = U.rand(0, Math.PI * 2), s = U.rand(60, 180);
      this.spawn({ type: 'debris', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.4, 0.9), size: U.rand(1, 3), color: '#2a2a2e', drag: 0.9, decal: true, vz: 120, z: 2 });
    }
  }
  dust(x, y, amount) {
    for (let i = 0; i < amount; i++) this.spawn({ type: 'smoke', x: x + U.rand(-4, 4), y: y + U.rand(-4, 4), vx: U.rand(-10, 10), vy: U.rand(-10, 10), life: U.rand(0.25, 0.5), size: 2, color: 'rgba(160,150,140,0.35)', drag: 0.9, grow: 3 });
  }
  text(x, y, str, color, big) {
    this.texts.push({ x, y, str, color: color || '#fff', life: 0.9, maxLife: 0.9, big: !!big });
    if (this.texts.length > 24) this.texts.shift();
  }

  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.type !== 'flash' && p.type !== 'ring') {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= Math.pow(p.drag, dt * 60); p.vy *= Math.pow(p.drag, dt * 60);
        if (p.vz) { p.z += p.vz * dt; p.vz -= 400 * dt; if (p.z < 0) { p.z = 0; p.vz = -p.vz * 0.4; if (Math.abs(p.vz) < 20) p.vz = 0; } }
        if (p.type === 'blood' && this.level && this.level.isSolidAt(p.x, p.y)) { p.life = 0; }
      }
      if (p.grow) p.size += p.grow * dt;
      if (p.life <= 0) {
        if (p.decal && this.level) this.level.addDecal(p);
        L[i] = L[L.length - 1]; L.pop(); this.pool.push(p);
      }
    }
    const T = this.texts;
    for (let i = T.length - 1; i >= 0; i--) {
      const t = T[i]; t.life -= dt; t.y -= 18 * dt;
      if (t.life <= 0) T.splice(i, 1);
    }
  }

  /* partículas do mundo (chamado com o canvas já transladado pela câmera) */
  draw(ctx) {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      switch (p.type) {
        case 'blood': case 'spark': case 'debris':
          ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y - p.z), Math.ceil(p.size), Math.ceil(p.size)); break;
        case 'shell':
          ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y - p.z), 2, 1); break;
        case 'smoke':
          ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.8;
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill();
          ctx.globalAlpha = 1; break;
        case 'ring':
          ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
          ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.stroke();
          ctx.globalAlpha = 1; break;
        case 'flash': break; // desenhado na passada de luz
      }
    }
  }

  /* luzes dinâmicas (clarões) - modo 'lighter' */
  drawLights(ctx) {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      if (p.type !== 'flash') continue;
      const a = Math.max(0, p.life / p.maxLife);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.2);
      g.addColorStop(0, `rgba(255,235,170,${0.7 * a})`); g.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.2, 0, 7); ctx.fill();
      if (p.angle !== undefined && p.size < 40) {
        // cone do clarão de cano
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
        ctx.fillStyle = `rgba(255,240,200,${0.9 * a})`;
        ctx.beginPath(); ctx.moveTo(0, -1.5); ctx.lineTo(p.size * 0.7, -3); ctx.lineTo(p.size, 0); ctx.lineTo(p.size * 0.7, 3); ctx.lineTo(0, 1.5); ctx.fill();
        ctx.restore();
      }
    }
  }

  drawTexts(ctx) {
    for (const t of this.texts) {
      const a = Math.min(1, t.life / 0.3);
      ctx.globalAlpha = a;
      ctx.font = t.big ? 'bold 9px monospace' : 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000'; ctx.fillText(t.str, Math.round(t.x) + 1, Math.round(t.y) + 1);
      ctx.fillStyle = t.color; ctx.fillText(t.str, Math.round(t.x), Math.round(t.y));
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }

  clear() { this.pool.push(...this.list); this.list.length = 0; this.texts.length = 0; }
}
