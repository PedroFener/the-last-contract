// THE LAST CONTRACT — áudio procedural (Web Audio API)
// Todos os efeitos e músicas são sintetizados em tempo real: nenhum arquivo de áudio externo.
'use strict';

const AudioSys = (() => {
  let ctx = null, master, musicG, sfxG, noiseBuf, leadBus, comp;
  const vol = { master: 0.8, music: 0.6, sfx: 0.8 };
  const last = {};
  let music = null; // estado do sequenciador

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    musicG = ctx.createGain(); sfxG = ctx.createGain();
    musicG.connect(master); sfxG.connect(master);
    // barramento do lead com delay (eco synthwave)
    leadBus = ctx.createGain();
    const delay = ctx.createDelay(1.0); delay.delayTime.value = 0.28;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    leadBus.connect(musicG); leadBus.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(musicG);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVol();
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
  }
  function setVolumes(m, mu, s) { vol.master = m; vol.music = mu; vol.sfx = s; applyVol(); }
  function applyVol() {
    if (!ctx) return;
    master.gain.value = vol.master;
    musicG.gain.value = vol.music * 0.55;
    sfxG.gain.value = vol.sfx;
  }

  function noise(t, dur, o) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 2000, t);
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t + dur);
    f.Q.value = o.q || 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain || 0.4), t + (o.attack || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxG);
    src.start(t, Math.random() * 0.4); src.stop(t + dur + 0.05);
  }
  function tone(t, dur, o) {
    const osc = ctx.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq || 440, t);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t + dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain || 0.3), t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lp) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(o.lp, t);
      if (o.lpEnd) f.frequency.exponentialRampToValueAtTime(o.lpEnd, t + dur);
      f.Q.value = o.q || 1;
      osc.connect(f); node = f;
    }
    node.connect(g); g.connect(o.dest || sfxG);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  // ---------------- Efeitos sonoros ----------------
  function sfx(name, v) {
    if (!ctx || ctx.state !== 'running') return;
    v = v === undefined ? 1 : v;
    if (v < 0.03) return;
    const now = ctx.currentTime;
    if (last[name] && now - last[name] < 0.025) return;
    last[name] = now;
    const t = now + 0.005;
    switch (name) {
      case 'pistol':
        noise(t, 0.16, { type: 'lowpass', freq: 5000, freqEnd: 600, gain: 0.55 * v });
        tone(t, 0.1, { type: 'square', freq: 180, freqEnd: 50, gain: 0.25 * v, lp: 900 });
        break;
      case 'shotgun':
        noise(t, 0.38, { type: 'lowpass', freq: 3200, freqEnd: 250, gain: 0.8 * v });
        tone(t, 0.2, { type: 'sine', freq: 120, freqEnd: 35, gain: 0.6 * v });
        break;
      case 'rifle':
        noise(t, 0.1, { type: 'bandpass', freq: 2600, freqEnd: 800, q: 0.6, gain: 0.6 * v });
        tone(t, 0.07, { type: 'square', freq: 220, freqEnd: 70, gain: 0.2 * v, lp: 1200 });
        break;
      case 'boss':
        noise(t, 0.2, { type: 'lowpass', freq: 2200, freqEnd: 300, gain: 0.6 * v });
        tone(t, 0.12, { type: 'sawtooth', freq: 140, freqEnd: 40, gain: 0.25 * v, lp: 800 });
        break;
      case 'empty':
        tone(t, 0.03, { type: 'square', freq: 1800, gain: 0.12 * v });
        break;
      case 'reload':
        tone(t, 0.04, { type: 'square', freq: 900, gain: 0.12 * v, lp: 3000 });
        noise(t + 0.03, 0.05, { type: 'highpass', freq: 3000, gain: 0.15 * v });
        break;
      case 'reloadEnd':
        tone(t, 0.05, { type: 'square', freq: 600, gain: 0.14 * v, lp: 2500 });
        tone(t + 0.07, 0.05, { type: 'square', freq: 1200, gain: 0.12 * v, lp: 3000 });
        break;
      case 'swing':
        noise(t, 0.14, { type: 'bandpass', freq: 600, freqEnd: 2800, q: 2, gain: 0.35 * v });
        break;
      case 'stab':
        noise(t, 0.09, { type: 'highpass', freq: 2500, gain: 0.3 * v });
        noise(t, 0.12, { type: 'lowpass', freq: 500, gain: 0.5 * v });
        break;
      case 'punch':
        noise(t, 0.1, { type: 'lowpass', freq: 700, freqEnd: 150, gain: 0.7 * v });
        tone(t, 0.08, { type: 'sine', freq: 110, freqEnd: 50, gain: 0.5 * v });
        break;
      case 'hit':
        noise(t, 0.09, { type: 'lowpass', freq: 900, freqEnd: 200, gain: 0.45 * v });
        break;
      case 'ric':
        tone(t, 0.08, { type: 'triangle', freq: rand(2200, 3400), freqEnd: rand(900, 1500), gain: 0.06 * v });
        noise(t, 0.04, { type: 'highpass', freq: 4000, gain: 0.1 * v });
        break;
      case 'death':
        noise(t, 0.25, { type: 'lowpass', freq: 400, freqEnd: 80, gain: 0.6 * v });
        tone(t, 0.3, { type: 'sawtooth', freq: 160, freqEnd: 40, gain: 0.12 * v, lp: 600 });
        break;
      case 'hurt':
        tone(t, 0.15, { type: 'square', freq: 220, freqEnd: 90, gain: 0.2 * v, lp: 1200 });
        noise(t, 0.12, { type: 'lowpass', freq: 800, gain: 0.4 * v });
        break;
      case 'dodge':
        noise(t, 0.22, { type: 'bandpass', freq: 400, freqEnd: 1800, q: 1.5, gain: 0.3 * v });
        break;
      case 'pickup':
        tone(t, 0.07, { type: 'square', freq: 660, gain: 0.1 * v, lp: 3000 });
        tone(t + 0.07, 0.1, { type: 'square', freq: 990, gain: 0.1 * v, lp: 3000 });
        break;
      case 'heal':
        [523, 659, 784].forEach((f, i) => tone(t + i * 0.06, 0.12, { type: 'triangle', freq: f, gain: 0.15 * v }));
        break;
      case 'alert':
        tone(t, 0.08, { type: 'square', freq: 880, gain: 0.05 * v, lp: 2000 });
        break;
      case 'explosion':
        noise(t, 0.9, { type: 'lowpass', freq: 1800, freqEnd: 60, gain: 1.0 * v });
        tone(t, 0.6, { type: 'sine', freq: 90, freqEnd: 25, gain: 0.9 * v });
        break;
      case 'exit':
        [392, 523, 659, 784].forEach((f, i) => tone(t + i * 0.09, 0.2, { type: 'square', freq: f, gain: 0.08 * v, lp: 2500 }));
        break;
      case 'ui':
        tone(t, 0.05, { type: 'square', freq: 520, gain: 0.07 * v, lp: 2500 });
        break;
      case 'uiOk':
        tone(t, 0.06, { type: 'square', freq: 660, gain: 0.08 * v, lp: 2500 });
        tone(t + 0.06, 0.09, { type: 'square', freq: 990, gain: 0.08 * v, lp: 2500 });
        break;
      case 'roar':
        tone(t, 0.9, { type: 'sawtooth', freq: 180, freqEnd: 45, gain: 0.35 * v, lp: 900 });
        noise(t, 0.8, { type: 'bandpass', freq: 500, freqEnd: 150, q: 1, gain: 0.4 * v });
        break;
      case 'bark':
        tone(t, 0.09, { type: 'sawtooth', freq: 520, freqEnd: 260, gain: 0.25 * v, lp: 1800 });
        noise(t, 0.08, { type: 'bandpass', freq: 900, q: 2, gain: 0.25 * v });
        tone(t + 0.14, 0.1, { type: 'sawtooth', freq: 560, freqEnd: 240, gain: 0.25 * v, lp: 1800 });
        noise(t + 0.14, 0.08, { type: 'bandpass', freq: 900, q: 2, gain: 0.25 * v });
        break;
      case 'growl':
        tone(t, 0.35, { type: 'sawtooth', freq: 95, freqEnd: 75, gain: 0.3 * v, lp: 500 });
        noise(t, 0.3, { type: 'bandpass', freq: 300, q: 1.5, gain: 0.3 * v });
        break;
      case 'legend':
        [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(t + i * 0.08, 0.5, { type: 'square', freq: f, gain: 0.07 * v, lp: 4000 }));
        [261, 392, 523].forEach((f) => tone(t + 0.5, 1.2, { type: 'sawtooth', freq: f, gain: 0.06 * v, lp: 2000, attack: 0.05 }));
        break;
      case 'finisher':
        tone(t, 0.25, { type: 'sine', freq: 70, freqEnd: 35, gain: 0.7 * v });
        noise(t, 0.18, { type: 'lowpass', freq: 600, freqEnd: 120, gain: 0.6 * v });
        break;
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) => tone(t + i * 0.14, 0.35, { type: 'square', freq: f, gain: 0.09 * v, lp: 3000 }));
        break;
      case 'lose':
        [392, 330, 262, 196].forEach((f, i) => tone(t + i * 0.18, 0.4, { type: 'sawtooth', freq: f, gain: 0.08 * v, lp: 1200 }));
        break;
    }
  }

  // ---------------- Música (sequenciador de 16 passos) ----------------
  // prog: deslocamentos (semitons) do acorde por compasso. Padrões: x = toque.
  const TRACKS = {
    menu: { bpm: 84, root: 45, prog: [0, 8, 3, 10], kick: 'x.......x.......', snare: '........x.......', hat: '..x...x...x...x.', bass: 'x.....x.....x...', arp: 'slow', pad: true },
    l1: { bpm: 112, root: 40, prog: [0, 0, 8, 10], kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', bass: 'x.xox.x.x.xox.x.', arp: 'fast' },
    l2: { bpm: 126, root: 43, prog: [0, 5, 8, 7], kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', clap: true, bass: '..x...x...x...xo', arp: 'house' },
    l3: { bpm: 100, root: 38, prog: [0, 3, 8, 7], kick: 'x.....x...x.....', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.x.', bass: 'x..x..x.x..x..x.', arp: 'slow' },
    l4: { bpm: 118, root: 41, prog: [0, 1, 8, 7], kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: 'xxx.xxx.xxx.xxx.', bass: 'xoxoxoxoxoxoxoxo', arp: 'fast' },
    l5: { bpm: 140, root: 40, prog: [0, 1, 0, 10], kick: 'x.x.x.x.x.x.x.x.', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', bass: 'xxoxxxoxxxoxxxox', arp: 'fast' },
    win: { bpm: 96, root: 48, prog: [0, 7, 9, 5], kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.', bass: 'x...x...x...x...', arp: 'slow', pad: true },
  };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function playMusic(name) {
    if (!ctx) return;
    if (music && music.name === name) return;
    stopMusic();
    const tr = TRACKS[name]; if (!tr) return;
    music = { name, tr, step: 0, bar: 0, next: ctx.currentTime + 0.1, timer: null };
    music.timer = setInterval(schedule, 25);
  }
  function stopMusic() {
    if (music) { clearInterval(music.timer); music = null; }
  }
  function schedule() {
    if (!music || !ctx || ctx.state !== 'running') return;
    const tr = music.tr;
    const sd = 60 / tr.bpm / 4;
    while (music.next < ctx.currentTime + 0.15) {
      const t = music.next, s = music.step;
      const chord = tr.root + tr.prog[music.bar % tr.prog.length];
      if (tr.kick[s] === 'x') { tone(t, 0.32, { type: 'sine', freq: 150, freqEnd: 42, gain: 0.9, dest: musicG }); }
      if (tr.snare[s] === 'x') {
        noise(t, tr.clap ? 0.12 : 0.18, { type: 'bandpass', freq: tr.clap ? 1400 : 1900, q: 0.7, gain: 0.45, dest: musicG });
        if (!tr.clap) tone(t, 0.08, { type: 'triangle', freq: 210, freqEnd: 140, gain: 0.25, dest: musicG });
      }
      if (tr.hat[s] === 'x') noise(t, 0.035, { type: 'highpass', freq: 7500, gain: (s % 4 === 2) ? 0.16 : 0.08, dest: musicG });
      const b = tr.bass[s];
      if (b !== '.') {
        const n = chord + (b === 'o' ? 12 : 0);
        tone(t, sd * 1.6, { type: 'sawtooth', freq: mtof(n), gain: 0.22, lp: 1100, lpEnd: 160, q: 4, dest: musicG });
      }
      // arpejo
      const tones = [0, 3, 7, 12, 15, 12, 7, 3];
      if (tr.arp === 'fast' && music.bar % 8 >= 2) {
        if (s % 2 === 0) tone(t, sd * 1.2, { type: 'square', freq: mtof(chord + 24 + tones[(s / 2) % 8]), gain: 0.05, lp: 2600, dest: leadBus });
      } else if (tr.arp === 'slow') {
        if (s % 4 === 0) tone(t, sd * 3, { type: 'triangle', freq: mtof(chord + 24 + tones[(s / 4 + music.bar) % 8]), gain: 0.09, dest: leadBus });
      } else if (tr.arp === 'house') {
        if (s % 4 === 2) {
          [0, 3, 7].forEach((iv) => tone(t, sd * 1.5, { type: 'sawtooth', freq: mtof(chord + 24 + iv), gain: 0.03, lp: 1800, lpEnd: 600, dest: leadBus }));
        }
      }
      if (tr.pad && s === 0) {
        [0, 3, 7].forEach((iv, i) => tone(t, sd * 16, { type: 'sawtooth', freq: mtof(chord + 12 + iv), gain: 0.025, attack: 0.6, lp: 900, detune: (i - 1) * 8, dest: musicG }));
      }
      music.step = (s + 1) % 16;
      if (music.step === 0) music.bar++;
      music.next += sd;
    }
  }

  return { init, sfx, setVolumes, playMusic, stopMusic, get ready() { return !!ctx; } };
})();
