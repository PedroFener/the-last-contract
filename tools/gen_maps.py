"""Gerador determinístico das fases 5-14 (salas BSP ou áreas abertas), validado por BFS."""
import random
from collections import deque

SOLID = set('#WCKSVOTp')

class G:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.g = [['#'] * w for _ in range(h)]
    def ok(s, x, y): return 0 < x < s.w - 1 and 0 < y < s.h - 1
    def text(s): return [''.join(r) for r in s.g]

def reach(m, sx, sy):
    seen = {(sx, sy)}; q = deque([(sx, sy)])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if (nx, ny) not in seen and 0 <= nx < m.w and 0 <= ny < m.h and m.g[ny][nx] not in SOLID:
                seen.add((nx, ny)); q.append((nx, ny))
    return seen

def floors(m):
    return [(x, y) for y in range(m.h) for x in range(m.w) if m.g[y][x] not in SOLID]

def connected(m):
    f = floors(m)
    if not f: return False
    return len(reach(m, *f[0])) == len(f)

def try_place(m, cells, c, protect):
    """coloca um objeto se não encostar em portas e não desconectar o mapa"""
    for x, y in cells:
        if not m.ok(x, y) or m.g[y][x] in SOLID or (x, y) in protect: return False
    old = [m.g[y][x] for x, y in cells]
    for x, y in cells: m.g[y][x] = c
    if connected(m): return True
    for (x, y), o in zip(cells, old): m.g[y][x] = o
    return False

def rect(x, y, w, h): return [(x + i, y + j) for j in range(h) for i in range(w)]

# ---------------------------------------------------------------- salas BSP
def bsp(m, rnd, x0, y0, x1, y1, depth, rooms, doors, minw):
    w, h = x1 - x0 + 1, y1 - y0 + 1
    if depth <= 0 or (w < minw * 2 + 1 and h < minw * 2 + 1):
        rooms.append((x0, y0, x1, y1)); return
    vert = w > h * 1.15 or (w >= minw * 2 + 1 and h < minw * 2 + 1) or (abs(w - h) < 4 and rnd.random() < 0.5 and w >= minw * 2 + 1)
    if vert and w < minw * 2 + 1: vert = False
    if not vert and h < minw * 2 + 1: vert = True
    if vert:
        p = rnd.randint(x0 + minw, x1 - minw)
        for y in range(y0, y1 + 1): m.g[y][p] = '#'
        bsp(m, rnd, x0, y0, p - 1, y1, depth - 1, rooms, doors, minw)
        bsp(m, rnd, p + 1, y0, x1, y1, depth - 1, rooms, doors, minw)
        ys = list(range(y0, y1)); rnd.shuffle(ys)
        for y in ys:
            if all(m.g[yy][p - 1] not in SOLID and m.g[yy][p + 1] not in SOLID for yy in (y, y + 1)):
                for yy in (y, y + 1): m.g[yy][p] = '.'; doors.add((p, yy))
                break
    else:
        p = rnd.randint(y0 + minw, y1 - minw)
        for x in range(x0, x1 + 1): m.g[p][x] = '#'
        bsp(m, rnd, x0, y0, x1, p - 1, depth - 1, rooms, doors, minw)
        bsp(m, rnd, x0, p + 1, x1, y1, depth - 1, rooms, doors, minw)
        xs = list(range(x0, x1)); rnd.shuffle(xs)
        for x in xs:
            if all(m.g[p - 1][xx] not in SOLID and m.g[p + 1][xx] not in SOLID for xx in (x, x + 1)):
                for xx in (x, x + 1): m.g[p][xx] = '.'; doors.add((xx, p))
                break

def room_features(m, rnd, room, feats, protect):
    x0, y0, x1, y1 = room
    w, h = x1 - x0 + 1, y1 - y0 + 1
    for f in feats:
        tries = 6
        while tries:
            tries -= 1
            if f == 'crates':
                x, y = rnd.randint(x0, x1 - 1), rnd.choice([y0, y1 - 1])
                if try_place(m, rect(x, y, 2, rnd.choice([1, 2])), 'C', protect): break
            elif f == 'tables':
                if w < 7 or h < 5: break
                cx, cy = rnd.randint(x0 + 2, x1 - 3), rnd.randint(y0 + 2, y1 - 2)
                if try_place(m, rect(cx, cy, 2, 1), 'T', protect): break
            elif f == 'counter':
                L = max(3, min(w - 4, rnd.randint(3, 7)))
                x = rnd.randint(x0 + 1, max(x0 + 1, x1 - L)); y = rnd.choice([y0 + 1, y1 - 1])
                if try_place(m, rect(x, y, L, 1), 'K', protect): break
            elif f == 'sofa':
                L = rnd.randint(2, 3)
                if rnd.random() < 0.5:
                    if try_place(m, rect(rnd.randint(x0 + 1, max(x0 + 1, x1 - L)), rnd.choice([y0, y1]), L, 1), 'S', protect): break
                else:
                    if try_place(m, rect(rnd.choice([x0, x1]), rnd.randint(y0 + 1, max(y0 + 1, y1 - L)), 1, L), 'S', protect): break
            elif f == 'pillars':
                if w < 10 or h < 8: break
                for (px, py) in ((x0 + 2, y0 + 2), (x1 - 3, y0 + 2), (x0 + 2, y1 - 3), (x1 - 3, y1 - 3)):
                    try_place(m, rect(px, py, 2, 2), 'O', protect)
                break
            elif f == 'rows':  # bancos de igreja / máquinas / racks
                if w < 8 or h < 7: break
                c = rnd.choice(['T', 'K'])
                for yy in range(y0 + 2, y1 - 1, 3):
                    L = max(2, (w - 5) // 2)
                    try_place(m, rect(x0 + 1, yy, L, 1), c, protect)
                    try_place(m, rect(x1 - L, yy, L, 1), c, protect)
                break
            elif f == 'pedestal':
                if try_place(m, [(rnd.randint(x0 + 2, x1 - 2), rnd.randint(y0 + 2, y1 - 2))], 'O', protect): break
            elif f == 'plant':
                if try_place(m, [(rnd.choice([x0, x1]), rnd.choice([y0, y1]))], 'p', protect): break
            elif f == 'bed':
                if try_place(m, rect(x0, y0, 2, 2), 'S', protect): break
            elif f == 'train':
                if w < 12 or h < 6: break
                L = w - 6
                if try_place(m, rect(x0 + 3, y0 + h // 2 - 1, L, 2), 'V', protect): break

def make_bsp(seed, W, H, depth, minw, feats, floorw):
    rnd = random.Random(seed)
    m = G(W, H)
    for y in range(1, H - 1):
        for x in range(1, W - 1): m.g[y][x] = '.'
    rooms, doors = [], set()
    bsp(m, rnd, 1, 1, W - 2, H - 2, depth, rooms, doors, minw)
    # laços extras
    for _ in range(6):
        for _t in range(60):
            x, y = rnd.randint(2, W - 3), rnd.randint(2, H - 3)
            if m.g[y][x] != '#': continue
            if m.g[y][x - 1] not in SOLID and m.g[y][x + 1] not in SOLID and m.g[y + 1][x] == '#' and m.g[y - 1][x] == '#' and m.g[y+1][x-1] not in SOLID and m.g[y+1][x+1] not in SOLID:
                m.g[y][x] = '.'; m.g[y + 1][x] = '.'; doors |= {(x, y), (x, y + 1)}; break
            if m.g[y - 1][x] not in SOLID and m.g[y + 1][x] not in SOLID and m.g[y][x + 1] == '#' and m.g[y][x - 1] == '#' and m.g[y-1][x+1] not in SOLID and m.g[y+1][x+1] not in SOLID:
                m.g[y][x] = '.'; m.g[y][x + 1] = '.'; doors |= {(x, y), (x + 1, y)}; break
    # pisos por sala
    for (x0, y0, x1, y1) in rooms:
        fc = rnd.choices(list(floorw), weights=list(floorw.values()))[0]
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if m.g[y][x] == '.': m.g[y][x] = fc
    for (x, y) in doors:
        nb = [m.g[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if m.g[y + dy][x + dx] in '.,:_']
        if nb: m.g[y][x] = nb[0]
    protect = set()
    for (x, y) in doors:
        for dy in range(-1, 2):
            for dx in range(-1, 2): protect.add((x + dx, y + dy))
    for r in rooms:
        k = rnd.randint(1, 3)
        room_features(m, rnd, r, rnd.sample(feats, min(k, len(feats))), protect)
    return m, rnd, rooms

# ---------------------------------------------------------------- áreas abertas
def make_open(seed, W, H, base, kind):
    rnd = random.Random(seed)
    m = G(W, H)
    for y in range(1, H - 1):
        for x in range(1, W - 1): m.g[y][x] = base
    protect = set()
    if kind == 'docks':
        # prédios/galpões nas bordas e fileiras de contêineres
        for _ in range(4):
            w, h = rnd.randint(6, 10), rnd.randint(4, 6)
            try_place(m, rect(rnd.randint(3, W - w - 3), rnd.choice([1, H - h - 1]), w, h), '#', protect)
        for _ in range(26):
            if rnd.random() < 0.6: cells = rect(rnd.randint(3, W - 9), rnd.randint(3, H - 5), rnd.randint(4, 6), 2)
            else: cells = rect(rnd.randint(3, W - 5), rnd.randint(3, H - 9), 2, rnd.randint(4, 6))
            try_place(m, cells, 'C', protect)
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                if m.g[y][x] == base and (x + y) % 13 == 0 and rnd.random() < 0.3: m.g[y][x] = ','
    elif kind == 'garage':
        for y in range(5, H - 4, 8):
            for x in range(5, W - 4, 9):
                try_place(m, rect(x, y, 2, 2), 'O', protect)
        for _ in range(30):
            if rnd.random() < 0.5: cells = rect(rnd.randint(2, W - 5), rnd.randint(2, H - 4), 3, 2)
            else: cells = rect(rnd.randint(2, W - 4), rnd.randint(2, H - 5), 2, 3)
            try_place(m, cells, 'V', protect)
        # rampas/paredes internas
        for _ in range(3):
            if rnd.random() < 0.5: try_place(m, rect(rnd.randint(6, W - 20), rnd.randint(6, H - 7), rnd.randint(8, 14), 1), '#', protect)
            else: try_place(m, rect(rnd.randint(6, W - 7), rnd.randint(6, H - 16), 1, rnd.randint(6, 10)), '#', protect)
    elif kind == 'roof':
        for _ in range(5):
            w, h = rnd.randint(4, 8), rnd.randint(3, 6)
            try_place(m, rect(rnd.randint(3, W - w - 3), rnd.randint(3, H - h - 3), w, h), '#', protect)
        for _ in range(22):
            try_place(m, rect(rnd.randint(2, W - 4), rnd.randint(2, H - 4), rnd.choice([1, 2]), rnd.choice([1, 2])), 'K', protect)
        for _ in range(8):
            try_place(m, rect(rnd.randint(2, W - 4), rnd.randint(2, H - 4), 2, 1), 'C', protect)
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                if m.g[y][x] == base and rnd.random() < 0.04: m.g[y][x] = ':'
    elif kind == 'garden':
        # muros de cerca-viva (paredes) em labirinto
        for _ in range(16):
            if rnd.random() < 0.5: cells = rect(rnd.randint(3, W - 12), rnd.randint(3, H - 4), rnd.randint(5, 10), 1)
            else: cells = rect(rnd.randint(3, W - 4), rnd.randint(3, H - 12), 1, rnd.randint(5, 9))
            try_place(m, cells, '#', protect)
        cx, cy = W // 2 - 1, H // 2 - 1
        try_place(m, rect(cx, cy, 3, 3), 'O', protect)
        for y in range(cy - 3, cy + 6):
            for x in range(cx - 3, cx + 6):
                if m.ok(x, y) and m.g[y][x] == base: m.g[y][x] = '_'
        for _ in range(14):
            try_place(m, rect(rnd.randint(2, W - 4), rnd.randint(2, H - 3), 2, 1), 'T', protect)
        for _ in range(16):
            try_place(m, [(rnd.randint(2, W - 3), rnd.randint(2, H - 3))], 'p', protect)
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                if m.g[y][x] == base and ((x // 4 + y // 4) % 5 == 0): m.g[y][x] = ','
    return m, rnd, None

# ---------------------------------------------------------------- povoamento
def bfs_dist(m, sx, sy):
    d = {(sx, sy): 0}; q = deque([(sx, sy)])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if (nx, ny) not in d and m.g[ny][nx] not in SOLID:
                d[(nx, ny)] = d[(x, y)] + 1; q.append((nx, ny))
    return d

def populate(m, rnd, n_enemies, mix, items, barrels, lights_every):
    fl = floors(m)
    corner = rnd.choice([(0, 0), (1, 0), (0, 1), (1, 1)])
    def score(c):
        x, y = c
        return (x if corner[0] == 0 else m.w - x) + (y if corner[1] == 0 else m.h - y)
    # início: canto, com espaço livre em volta
    cand = sorted(fl, key=score)
    start = None
    for c in cand:
        x, y = c
        if all(m.g[y + dy][x + dx] not in SOLID for dx in (-1, 0, 1) for dy in (-1, 0, 1)): start = c; break
    sx, sy = start
    dist = bfs_dist(m, sx, sy)
    # saída 2x2 o mais longe possível
    best = None
    for (x, y), dd in sorted(dist.items(), key=lambda kv: -kv[1]):
        if all((x + i, y + j) in dist for i in (0, 1) for j in (0, 1)):
            best = (x, y); break
    ex, ey = best
    m.g[sy][sx] = 'P'
    for i in (0, 1):
        for j in (0, 1): m.g[ey + j][ex + i] = 'X'
    used = {(sx, sy)} | {(ex + i, ey + j) for i in (0, 1) for j in (0, 1)}
    def free(minstart, avoid, sep):
        pool = [c for c, dd in dist.items() if dd >= minstart and c not in used and m.g[c[1]][c[0]] in '.,:_']
        rnd.shuffle(pool)
        for c in pool:
            if all(abs(c[0] - a[0]) + abs(c[1] - a[1]) >= sep for a in avoid): return c
        return pool[0] if pool else None
    enemies = []
    types = rnd.choices(list(mix), weights=list(mix.values()), k=n_enemies)
    for t in types:
        c = free(10, enemies, 5)
        if not c: break
        m.g[c[1]][c[0]] = t; used.add(c); enemies.append(c)
    placed = []
    for ch in items:
        c = free(3, placed, 8)
        if c: m.g[c[1]][c[0]] = ch; used.add(c); placed.append(c)
    # barris junto a paredes
    nb = 0
    pool = [c for c in dist if c not in used and m.g[c[1]][c[0]] in '.,:_']
    rnd.shuffle(pool)
    bl = []
    for (x, y) in pool:
        if nb >= barrels: break
        if dist[(x, y)] < 6: continue
        if any(m.g[y + dy][x + dx] == '#' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) and all(abs(x - a[0]) + abs(y - a[1]) > 6 for a in bl):
            m.g[y][x] = '%'; used.add((x, y)); bl.append((x, y)); nb += 1
    # luzes
    ls = []
    for (x, y) in pool:
        if (x, y) in used or m.g[y][x] not in '.,:_': continue
        if all(abs(x - a[0]) + abs(y - a[1]) >= lights_every for a in ls):
            m.g[y][x] = rnd.choice('*^&'); ls.append((x, y))
    return m

# ---------------------------------------------------------------- fases 5-14
LEVEL_SPECS = [
    # (semente, estilo, W, H, inimigos, mistura)
    (501, ('open', 'docks', '.'), 64, 44, 22, {'g': 5, 'n': 2, 'f': 3, 'm': 1}),
    (602, ('bsp', 3, 7, ['train', 'pillars', 'crates', 'counter'], {'.': 3, ':': 3, '_': 1}), 62, 42, 23, {'g': 5, 'n': 3, 'f': 2, 'm': 1}),
    (703, ('open', 'garage', '.'), 62, 44, 24, {'g': 4, 'n': 3, 'f': 3, 'm': 1, 'e': 1}),
    (804, ('bsp', 4, 6, ['rows', 'tables', 'counter', 'sofa', 'pillars'], {',': 4, '.': 2, '_': 1}), 60, 42, 25, {'g': 4, 'n': 3, 'f': 2, 'm': 1, 'e': 2}),
    (905, ('bsp', 4, 6, ['pedestal', 'pedestal', 'pillars', 'plant', 'sofa'], {'_': 3, '.': 2, ',': 1}), 60, 42, 25, {'g': 3, 'n': 2, 'f': 3, 'm': 1, 'e': 2}),
    (1006, ('bsp', 3, 7, ['rows', 'pillars', 'crates', 'plant'], {'.': 3, ',': 2, ':': 1}), 58, 44, 25, {'g': 3, 'n': 3, 'f': 2, 'm': 2, 'e': 2}),
    (1107, ('bsp', 4, 6, ['counter', 'crates', 'crates', 'rows', 'pillars'], {'.': 3, ':': 2, '_': 1}), 62, 44, 27, {'g': 3, 'n': 3, 'f': 3, 'm': 2, 'e': 2}),
    (1208, ('bsp', 5, 6, ['tables', 'tables', 'counter', 'sofa', 'plant'], {',': 3, '.': 2, ':': 1}), 64, 44, 28, {'g': 2, 'n': 3, 'f': 3, 'm': 1, 'e': 3}),
    (1309, ('open', 'roof', '.'), 62, 44, 28, {'g': 2, 'n': 2, 'f': 4, 'm': 1, 'e': 3}),
    (1410, ('open', 'garden', '.'), 64, 46, 30, {'g': 2, 'n': 3, 'f': 3, 'm': 2, 'e': 4}),
]
ITEMS = ['a', 'a', '+', '2', '3', 'a', '+', '4']

def gen_all():
    out = []
    for i, (seed, style, W, H, ne, mix) in enumerate(LEVEL_SPECS):
        s = seed
        while True:
            if style[0] == 'open':
                m, rnd, _ = make_open(s, W, H, style[2], style[1])
            else:
                m, rnd, _ = make_bsp(s, W, H, style[1], style[2], style[3], style[4])
            if connected(m) and len(floors(m)) > W * H * 0.35:
                break
            s += 1000
        populate(m, rnd, ne, mix, ITEMS, 5 + i // 2, 9)
        out.append(m.text())
    return out
