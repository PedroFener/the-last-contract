// Testes dos dados do jogo: 15 fases, mapas válidos e todas as áreas alcançáveis.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const ctx = {};
vm.createContext(ctx);
for (const f of ['maps.js', 'levels.js']) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'www', 'js', f), 'utf8').replace(/^const (\w+)/gm, 'var $1');
  vm.runInContext(src, ctx);
}
const { LEVELS, THEMES } = ctx;
const SOLID = new Set('#WCKSVOTp');

test('campanha tem 15 fases com tema e mapa', () => {
  assert.strictEqual(LEVELS.length, 15);
  LEVELS.forEach((l, i) => {
    assert.strictEqual(l.id, i + 1);
    assert.ok(THEMES[l.theme], `tema ${l.theme}`);
    assert.ok(Array.isArray(l.map) && l.map.length > 20, `mapa da fase ${l.id}`);
  });
  assert.ok(LEVELS[14].boss, 'última fase tem chefe');
});

test('cada mapa tem 1 jogador, saída/chefe e tudo alcançável', () => {
  for (const l of LEVELS) {
    const rows = l.map, h = rows.length, w = rows[0].length;
    assert.ok(rows.every((r) => r.length === w), `linhas iguais na fase ${l.id}`);
    let start = null, exits = 0, boss = 0;
    rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'P') start = [x, y]; if (c === 'X') exits++; if (c === 'B') boss++; }));
    assert.ok(start, `P na fase ${l.id}`);
    assert.ok(l.boss ? boss === 1 : exits >= 1, `objetivo na fase ${l.id}`);
    const seen = new Set([start.join()]); const q = [start];
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (ny < 0 || ny >= h || nx < 0 || nx >= w || seen.has(k) || SOLID.has(rows[ny][nx])) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    rows.forEach((r, y) => [...r].forEach((c, x) => {
      if ('XgnfmeB12345a+%'.includes(c)) assert.ok(seen.has(x + ',' + y), `fase ${l.id}: '${c}' inalcançável em ${x},${y}`);
    }));
  }
});

test('lápis lendário existe na Fase 2', () => {
  assert.ok(LEVELS[1].map.some((r) => r.includes('5')));
});
