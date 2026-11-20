// THE LAST CONTRACT — entrada unificada: teclado/mouse, toque (controles virtuais) e gamepad
'use strict';

const Input = (() => {
  const keys = {};
  const st = {
    moveX: 0, moveY: 0, run: false,
    aimMode: 'mouse',          // 'mouse' (aponta para o cursor) | 'stick' (direção)
    aimAngle: 0, aimActive: false,
    mouseX: 0, mouseY: 0,      // em pixels do jogo (canvas de baixa resolução)
    fire: false,
    device: 'kb',              // 'kb' | 'touch' | 'pad'
  };
  const edges = { melee: false, dodge: false, reload: false, swap: false, pause: false, dog: false, slot: 0 };
  const menu = { up: false, down: false, left: false, right: false, ok: false, back: false };
  let mouseDown = false, rmb = false;
  let canvas = null;
  // toque
  const touch = { move: null, aim: null, buttons: {} }; // move/aim: {id, ox, oy, x, y}
  let layout = null;
  // gamepad
  let padPrev = [];
  let padAxesPrev = { x: 0, y: 0 };

  function toGame(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return [(clientX - r.left) * (canvas.width / r.width), (clientY - r.top) * (canvas.height / r.height)];
  }

  function attach(cv) {
    canvas = cv;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) { if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); return; }
      keys[e.code] = true;
      st.device = 'kb';
      switch (e.code) {
        case 'Space': edges.dodge = true; e.preventDefault(); break;
        case 'KeyE': case 'KeyF': case 'KeyV': edges.melee = true; break;
        case 'KeyR': edges.reload = true; break;
        case 'KeyQ': case 'Tab': edges.swap = true; e.preventDefault(); break;
        case 'Escape': case 'KeyP': edges.pause = true; menu.back = true; break;
        case 'Digit1': edges.slot = 1; break; case 'Digit2': edges.slot = 2; break;
        case 'Digit3': edges.slot = 3; break; case 'Digit4': edges.slot = 4; break;
        case 'Digit5': edges.slot = 5; break;
        case 'KeyG': case 'KeyC': edges.dog = true; break;
        case 'ArrowUp': menu.up = true; e.preventDefault(); break;
        case 'ArrowDown': menu.down = true; e.preventDefault(); break;
        case 'ArrowLeft': menu.left = true; break;
        case 'ArrowRight': menu.right = true; break;
        case 'Enter': menu.ok = true; break;
      }
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; st.fire = false; });

    cv.addEventListener('mousemove', (e) => {
      const [x, y] = toGame(e.clientX, e.clientY);
      st.mouseX = x; st.mouseY = y;
      if (st.device !== 'kb') st.device = 'kb';
      st.aimMode = 'mouse';
    });
    cv.addEventListener('mousedown', (e) => {
      const [x, y] = toGame(e.clientX, e.clientY);
      st.mouseX = x; st.mouseY = y; st.device = 'kb'; st.aimMode = 'mouse';
      if (e.button === 0) mouseDown = true;
      if (e.button === 2) { rmb = true; edges.melee = true; }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; if (e.button === 2) rmb = false; });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => { edges.swap = true; e.preventDefault(); }, { passive: false });

    // ---------- toque ----------
    const opt = { passive: false };
    cv.addEventListener('touchstart', (e) => {
      e.preventDefault();
      st.device = 'touch';
      for (const t of e.changedTouches) {
        const [x, y] = toGame(t.clientX, t.clientY);
        const b = hitButton(x, y);
        if (b) {
          touch.buttons[t.identifier] = b;
          if (b === 'dodge') edges.dodge = true;
          else if (b === 'melee') edges.melee = true;
          else if (b === 'reload') edges.reload = true;
          else if (b === 'swap') edges.swap = true;
          else if (b === 'dog') edges.dog = true;
          else if (b === 'pause') edges.pause = true;
          continue;
        }
        if (x < canvas.width * 0.45) {
          if (!touch.move) touch.move = { id: t.identifier, ox: x, oy: y, x, y };
        } else if (!touch.aim) {
          touch.aim = { id: t.identifier, ox: x, oy: y, x, y };
        }
      }
    }, opt);
    cv.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const [x, y] = toGame(t.clientX, t.clientY);
        if (touch.move && touch.move.id === t.identifier) { touch.move.x = x; touch.move.y = y; }
        if (touch.aim && touch.aim.id === t.identifier) { touch.aim.x = x; touch.aim.y = y; }
      }
    }, opt);
    const end = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (touch.move && touch.move.id === t.identifier) touch.move = null;
        if (touch.aim && touch.aim.id === t.identifier) touch.aim = null;
        delete touch.buttons[t.identifier];
      }
    };
    cv.addEventListener('touchend', end, opt);
    cv.addEventListener('touchcancel', end, opt);
  }

  // Layout dos controles virtuais (em pixels do jogo)
  function computeLayout(W, H, pxPerCss) {
    const r = clamp(30 * pxPerCss, 11, 34);
    const m = r * 0.55;
    const R = r * 2.1;
    layout = {
      r, R,
      buttons: {
        dodge: { x: W - m - r * 1.15, y: H - m - r * 1.15, r: r * 1.15, label: 'ESQUIVA' },
        melee: { x: W - m - r * 3.6, y: H - m - r * 0.9, r: r * 0.95, label: 'GOLPE' },
        reload: { x: W - m - r * 1.0, y: H - m - r * 3.7, r: r * 0.9, label: 'RECARGA' },
        swap: { x: W - m - r * 1.0, y: H - m - r * 6.0, r: r * 0.85, label: 'ARMA' },
        dog: { x: W - m - r * 3.5, y: H - m - r * 3.4, r: r * 0.9, label: 'CÃO' },
        pause: { x: W - m - r * 0.6, y: m + r * 0.6, r: r * 0.65, label: 'II' },
      },
      moveHome: { x: m + R + r * 0.4, y: H - m - R },
      aimHome: { x: W * 0.66, y: H - m - R },
    };
    return layout;
  }
  function hitButton(x, y) {
    if (!layout) return null;
    for (const k in layout.buttons) {
      const b = layout.buttons[k];
      if (dist2(x, y, b.x, b.y) <= (b.r * 1.25) * (b.r * 1.25)) return k;
    }
    return null;
  }

  function pollPad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  // chamado a cada frame
  function update() {
    let mx = 0, my = 0;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1;
    if (keys.KeyD || keys.ArrowRight) mx += 1;
    if (keys.KeyW || keys.ArrowUp) my -= 1;
    if (keys.KeyS || keys.ArrowDown) my += 1;
    st.run = !!(keys.ShiftLeft || keys.ShiftRight);
    st.fire = mouseDown;
    st.aimActive = st.device === 'kb';

    // toque
    if (touch.move && layout) {
      let dx = touch.move.x - touch.move.ox, dy = touch.move.y - touch.move.oy;
      const d = Math.hypot(dx, dy);
      if (d > layout.R) { // base acompanha o dedo
        touch.move.ox = touch.move.x - dx / d * layout.R;
        touch.move.oy = touch.move.y - dy / d * layout.R;
        dx = touch.move.x - touch.move.ox; dy = touch.move.y - touch.move.oy;
      }
      const mag = Math.min(1, Math.hypot(dx, dy) / layout.R);
      if (mag > 0.12) { mx = dx / layout.R; my = dy / layout.R; st.run = mag > 0.88; }
    }
    if (touch.aim && layout) {
      let dx = touch.aim.x - touch.aim.ox, dy = touch.aim.y - touch.aim.oy;
      const d = Math.hypot(dx, dy);
      if (d > layout.R) {
        touch.aim.ox = touch.aim.x - dx / d * layout.R;
        touch.aim.oy = touch.aim.y - dy / d * layout.R;
        dx = touch.aim.x - touch.aim.ox; dy = touch.aim.y - touch.aim.oy;
      }
      const mag = Math.hypot(dx, dy) / layout.R;
      if (mag > 0.15) { st.aimAngle = Math.atan2(dy, dx); st.aimMode = 'stick'; st.aimActive = true; }
      if (mag > 0.45) st.fire = true;
    } else if (st.device === 'touch') {
      st.aimActive = false;
    }

    // gamepad
    const p = pollPad();
    if (p) {
      const dz = (v) => (Math.abs(v) < 0.2 ? 0 : v);
      const lx = dz(p.axes[0] || 0), ly = dz(p.axes[1] || 0);
      const rx = dz(p.axes[2] || 0), ry = dz(p.axes[3] || 0);
      const btn = (i) => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5));
      const pressed = (i) => btn(i) && !padPrev[i];
      let any = lx || ly || rx || ry;
      for (let i = 0; i < p.buttons.length; i++) if (btn(i)) any = true;
      if (any) st.device = 'pad';
      if (st.device === 'pad') {
        if (lx || ly) { mx = lx; my = ly; st.run = Math.hypot(lx, ly) > 0.9 || btn(10); }
        if (Math.hypot(rx, ry) > 0.3) { st.aimAngle = Math.atan2(ry, rx); st.aimMode = 'stick'; st.aimActive = true; }
        else if (lx || ly) { st.aimAngle = Math.atan2(ly, lx); st.aimMode = 'stick'; st.aimActive = true; }
        if (btn(7) || btn(5)) st.fire = true;
      }
      if (pressed(0)) { edges.dodge = true; menu.ok = true; }
      if (pressed(1) || pressed(6)) { edges.melee = true; }
      if (pressed(1)) menu.back = true;
      if (pressed(2)) edges.reload = true;
      if (pressed(3) || pressed(4)) edges.swap = true;
      if (pressed(9) || pressed(8)) { edges.pause = true; }
      if (pressed(11) || pressed(12)) edges.dog = true;
      if (pressed(12)) menu.up = true; if (pressed(13)) menu.down = true;
      if (pressed(14)) menu.left = true; if (pressed(15)) menu.right = true;
      const ay = p.axes[1] || 0, ax = p.axes[0] || 0;
      if (ay < -0.6 && padAxesPrev.y >= -0.6) menu.up = true;
      if (ay > 0.6 && padAxesPrev.y <= 0.6) menu.down = true;
      if (ax < -0.6 && padAxesPrev.x >= -0.6) menu.left = true;
      if (ax > 0.6 && padAxesPrev.x <= 0.6) menu.right = true;
      padAxesPrev = { x: ax, y: ay };
      padPrev = p.buttons.map((b) => b.pressed || b.value > 0.5);
    }

    const mag = Math.hypot(mx, my);
    if (mag > 1) { mx /= mag; my /= mag; }
    st.moveX = mx; st.moveY = my;
  }

  function consume(name) { const v = edges[name]; edges[name] = name === 'slot' ? 0 : false; return v; }
  function consumeMenu(name) { const v = menu[name]; menu[name] = false; return v; }
  function clearEdges() {
    for (const k in edges) edges[k] = k === 'slot' ? 0 : false;
    for (const k in menu) menu[k] = false;
  }
  function resetTouch() { touch.move = null; touch.aim = null; touch.buttons = {}; mouseDown = false; }

  return { attach, update, consume, consumeMenu, clearEdges, computeLayout, resetTouch, state: st, touch, get layout() { return layout; } };
})();
