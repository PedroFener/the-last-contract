/* ============================================================
   THE LAST CONTRACT - save.js
   Salvamento local (localStorage) de progresso e configurações.
   ============================================================ */
'use strict';

const SaveSys = {
  data: null,
  defaults() {
    return {
      version: CONFIG.VERSION,
      unlocked: 1,                 // maior fase desbloqueada (1..5)
      best: {},                    // { [levelId]: { score, rank, time, kills } }
      settings: { music: 0.6, sfx: 0.8, difficulty: 'normal', scanlines: true, controlScale: 1.0, shake: true }
    };
  },
  load() {
    try {
      const raw = localStorage.getItem(CONFIG.SAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        this.data = Object.assign(this.defaults(), d);
        this.data.settings = Object.assign(this.defaults().settings, d.settings || {});
      } else this.data = this.defaults();
    } catch (e) { console.warn('Sem acesso ao localStorage; progresso não será salvo.', e); this.data = this.defaults(); }
    return this.data;
  },
  save() {
    try { localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(this.data)); return true; }
    catch (e) { return false; }
  },
  recordLevel(levelId, result) {
    const prev = this.data.best[levelId];
    if (!prev || result.score > prev.score) this.data.best[levelId] = result;
    if (levelId >= this.data.unlocked && levelId < LEVELS.length) this.data.unlocked = levelId + 1;
    if (levelId === LEVELS.length) this.data.finished = true;
    this.save();
  },
  reset() { this.data = this.defaults(); this.save(); }
};
