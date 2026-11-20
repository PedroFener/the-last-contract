/* ============================================================
   THE LAST CONTRACT - config.js
   Constantes globais, definições de armas e de inimigos.
   ============================================================ */
'use strict';

const CONFIG = {
  TILE: 16,                 // tamanho do tile em pixels
  VIEW_H: 270,              // altura lógica da viewport (pixel art)
  VIEW_MIN_W: 240,
  VIEW_MAX_W: 640,
  MAX_DT: 1 / 30,           // limite de delta time (evita saltos)
  PLAYER_HP: 100,
  PLAYER_WALK: 58,          // px/s (modo furtivo)
  PLAYER_RUN: 92,           // px/s
  PLAYER_RADIUS: 5,
  DODGE_SPEED: 230,
  DODGE_TIME: 0.32,
  DODGE_IFRAMES: 0.30,
  DODGE_COOLDOWN: 0.55,
  COMBO_WINDOW: 2.6,        // segundos para manter o combo
  COMBO_MAX: 8,
  MAX_PARTICLES: 420,
  MAX_BULLETS: 160,
  FLOW_INTERVAL: 0.25,      // recálculo do campo de fluxo (s)
  SAVE_KEY: 'tlc_save_v1',
  VERSION: '1.0.0'
};

/* Dificuldade global (multiplicadores aplicados aos inimigos) */
const DIFFICULTY = {
  facil:   { label: 'Fácil',   dmg: 0.6, accuracy: 0.6, reaction: 1.5, hp: 0.85 },
  normal:  { label: 'Normal',  dmg: 1.0, accuracy: 1.0, reaction: 1.0, hp: 1.0 },
  dificil: { label: 'Difícil', dmg: 1.5, accuracy: 1.35, reaction: 0.7, hp: 1.2 }
};

/* ------------------------------------------------------------
   ARMAS
   kind: 'gun' | 'melee'
   mag: tamanho do pente | reserve: munição inicial de reserva
   rate: tiros por segundo | spread: dispersão em radianos
   dmg: dano por projétil | pellets: projéteis por disparo
   range: alcance em px | speed: velocidade do projétil
   reload: tempo de recarga (s) | noise: raio do barulho (px)
   ------------------------------------------------------------ */
const WEAPONS = {
  fists: {
    id: 'fists', name: 'Punhos', kind: 'melee', dmg: 18, rate: 2.6, range: 15,
    arc: 1.4, knock: 60, noise: 30, pose: 'unarmed', icon: 'fists', swing: 0.14
  },
  knife: {
    id: 'knife', name: 'Faca', kind: 'melee', dmg: 45, rate: 3.2, range: 17,
    arc: 1.2, knock: 30, noise: 30, pose: 'knife', icon: 'knife', swing: 0.12, bleed: true
  },
  pistol: {
    id: 'pistol', name: 'Pistola', kind: 'gun', dmg: 22, rate: 4.5, auto: false,
    mag: 12, reserve: 36, maxReserve: 96, spread: 0.045, pellets: 1, range: 330,
    speed: 520, reload: 1.1, noise: 220, pose: 'pistol', icon: 'pistol', recoil: 1.2,
    flash: 18, shell: true
  },
  shotgun: {
    id: 'shotgun', name: 'Escopeta', kind: 'gun', dmg: 13, rate: 1.3, auto: false,
    mag: 6, reserve: 18, maxReserve: 48, spread: 0.19, pellets: 7, range: 170,
    speed: 480, reload: 1.9, noise: 300, pose: 'rifle', icon: 'shotgun', recoil: 3.5,
    flash: 28, shell: true, falloff: true
  },
  rifle: {
    id: 'rifle', name: 'Rifle', kind: 'gun', dmg: 15, rate: 9, auto: true,
    mag: 30, reserve: 60, maxReserve: 180, spread: 0.07, pellets: 1, range: 380,
    speed: 600, reload: 1.6, noise: 260, pose: 'rifle', icon: 'rifle', recoil: 0.9,
    flash: 20, shell: true
  }
};

/* ------------------------------------------------------------
   TIPOS DE INIMIGO
   hp, speed (px/s), weapon, viewDist (px), fov (rad), hearing (px),
   reaction (s até reagir ao ver o jogador), accuracy (0..1, menor = mais disperso),
   burst (tiros por rajada), burstGap, cooldown entre rajadas,
   cover (probabilidade de procurar cobertura ao ser atacado),
   score (pontos base), drop (arma deixada ao morrer)
   ------------------------------------------------------------ */
const ENEMY_TYPES = {
  thug: {
    id: 'thug', name: 'Capanga', hp: 42, speed: 62, weapon: 'pistol',
    viewDist: 190, fov: 2.2, hearing: 200, reaction: 0.55, accuracy: 0.55,
    burst: 2, burstGap: 0.22, cooldown: 1.1, cover: 0.35, score: 100,
    dmg: 11, drop: 'pistol', dropAmmo: 10, palette: 'thug'
  },
  heavy: {
    id: 'heavy', name: 'Brutamontes', hp: 120, speed: 50, weapon: 'shotgun',
    viewDist: 170, fov: 2.0, hearing: 220, reaction: 0.7, accuracy: 0.6,
    burst: 1, burstGap: 0.4, cooldown: 1.4, cover: 0.15, score: 220,
    dmg: 7, drop: 'shotgun', dropAmmo: 6, palette: 'heavy', radius: 6
  },
  soldier: {
    id: 'soldier', name: 'Mercenário', hp: 72, speed: 66, weapon: 'rifle',
    viewDist: 230, fov: 2.3, hearing: 240, reaction: 0.42, accuracy: 0.7,
    burst: 4, burstGap: 0.11, cooldown: 1.3, cover: 0.7, score: 180,
    dmg: 8, drop: 'rifle', dropAmmo: 15, palette: 'soldier'
  },
  knifer: {
    id: 'knifer', name: 'Lâmina', hp: 36, speed: 96, weapon: 'knife',
    viewDist: 200, fov: 2.4, hearing: 260, reaction: 0.3, accuracy: 1,
    burst: 1, burstGap: 0, cooldown: 0.75, cover: 0, score: 150,
    dmg: 16, drop: 'knife', dropAmmo: 0, palette: 'knifer'
  },
  elite: {
    id: 'elite', name: 'Elite', hp: 95, speed: 74, weapon: 'rifle',
    viewDist: 250, fov: 2.5, hearing: 260, reaction: 0.3, accuracy: 0.85,
    burst: 5, burstGap: 0.1, cooldown: 1.0, cover: 0.8, score: 260,
    dmg: 9, drop: 'rifle', dropAmmo: 20, palette: 'elite'
  },
  target: {
    id: 'target', name: 'Alvo', hp: 90, speed: 70, weapon: 'pistol',
    viewDist: 200, fov: 2.2, hearing: 220, reaction: 0.4, accuracy: 0.7,
    burst: 3, burstGap: 0.18, cooldown: 1.0, cover: 0.9, score: 600,
    dmg: 12, drop: 'pistol', dropAmmo: 12, palette: 'target', isTarget: true
  },
  boss: {
    id: 'boss', name: 'Dorian Belasco', hp: 1100, speed: 80, weapon: 'rifle',
    viewDist: 320, fov: 6.3, hearing: 400, reaction: 0.15, accuracy: 0.8,
    burst: 6, burstGap: 0.09, cooldown: 0.9, cover: 0.5, score: 3000,
    dmg: 9, drop: null, dropAmmo: 0, palette: 'boss', isBoss: true, radius: 7
  }
};

/* Pontuação */
const SCORE = {
  KILL_BASE: 100,
  MELEE_BONUS: 50,
  HEADSHOT: 0,
  TIME_BONUS_PER_SEC: 40,
  ACCURACY_BONUS: 2500,
  DAMAGE_PENALTY: 6,
  NO_DAMAGE_BONUS: 1500
};
