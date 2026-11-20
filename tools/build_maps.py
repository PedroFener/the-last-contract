#!/usr/bin/env python3
"""Gera js/maps.js do THE LAST CONTRACT a partir de construções programáticas.
Legenda (ver README): # parede, W janela, . , : _ pisos, C K S V O T p props sólidos,
P jogador, X saída, g n f m e B inimigos, R reforço, 1-4 armas, a munição, + kit, % barril,
* ^ & luzes neon."""
import sys, json

class M:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.g = [['#'] * w for _ in range(h)]
    def fill(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                s.g[y][x] = c
    def put(s, x, y, c):
        s.g[y][x] = c
    def puts(s, pts, c):
        for x, y in pts:
            s.g[y][x] = c
    def text(s):
        return [''.join(r) for r in s.g]

def L1():
    m = M(52, 34)
    # Fileira superior de salas
    m.fill(1, 1, 8, 7, '_')      # A escritório inicial
    m.fill(10, 1, 24, 7, '.')    # B escritório aberto
    m.fill(26, 1, 37, 7, ',')    # C sala de reuniões
    m.fill(39, 1, 50, 7, '.')    # D depósito
    m.fill(9, 4, 9, 5, '.'); m.fill(25, 2, 25, 3, '.'); m.fill(38, 5, 38, 6, '.')
    # Corredor / saguão
    m.fill(1, 9, 50, 14, ':')
    for x in (4, 5): m.put(x, 8, '_')
    for x in (17, 18): m.put(x, 8, '.')
    for x in (31, 32): m.put(x, 8, ',')
    for x in (44, 45): m.put(x, 8, '.')
    m.fill(12, 11, 13, 12, 'O'); m.fill(24, 11, 25, 12, 'O'); m.fill(37, 11, 38, 12, 'O')
    # Fileira inferior
    m.fill(1, 16, 12, 24, ':')   # E banheiro
    m.fill(14, 16, 26, 24, '.')  # F servidores
    m.fill(28, 16, 39, 24, ',')  # G sala de descanso
    m.fill(41, 16, 50, 24, '_')  # K segurança
    for x in (6, 7): m.put(x, 15, ':')
    for x in (20, 21): m.put(x, 15, '.')
    for x in (33, 34): m.put(x, 15, ',')
    for x in (45, 46): m.put(x, 15, '_')
    # Galpão / saída
    m.fill(1, 26, 50, 32, '.')
    for x in (3, 4): m.put(x, 25, ':')
    for x in (15, 16): m.put(x, 25, '.')
    for x in (37, 38): m.put(x, 25, ',')
    for x in (47, 48): m.put(x, 25, '_')
    # Props
    m.puts([(13, 3), (14, 3), (19, 3), (20, 3), (13, 5), (14, 5), (19, 5), (20, 5)], 'T')
    m.fill(29, 4, 34, 4, 'T')
    m.puts([(41, 2), (42, 2), (41, 3), (42, 3), (46, 5), (47, 5), (46, 6), (47, 6)], 'C')
    m.fill(3, 16, 3, 18, '#'); m.fill(6, 16, 6, 18, '#'); m.fill(9, 16, 9, 18, '#')
    m.fill(16, 18, 24, 18, 'K'); m.fill(16, 21, 24, 21, 'K')
    m.fill(30, 18, 32, 18, 'S'); m.fill(30, 22, 32, 22, 'S'); m.put(36, 20, 'T')
    m.fill(43, 18, 44, 18, 'K'); m.put(49, 17, 'p'); m.put(41, 23, 'p')
    m.puts([(8, 28), (9, 28), (8, 29), (9, 29), (22, 27), (23, 27), (28, 30), (29, 30), (28, 31), (29, 31), (42, 27), (43, 27), (42, 28)], 'C')
    m.puts([(2, 1), (8, 1), (10, 7), (50, 1)], 'p')
    # Entidades
    m.put(3, 4, 'P'); m.put(6, 6, 'a')
    m.put(16, 2, 'g'); m.put(22, 6, 'g'); m.put(11, 2, '4')
    m.put(28, 2, 'g'); m.put(35, 6, 'n')
    m.put(48, 3, 'm'); m.put(44, 2, '%'); m.put(40, 6, 'g')
    m.put(8, 11, 'g'); m.put(30, 10, 'n'); m.put(45, 13, 'g'); m.put(19, 13, '%')
    m.put(5, 21, 'g'); m.put(25, 17, 'g'); m.put(15, 23, 'g')
    m.put(35, 20, 'm'); m.put(38, 23, '+')
    m.put(47, 20, 'n'); m.put(49, 23, 'a')
    m.put(20, 29, 'g'); m.put(33, 28, 'n'); m.put(11, 31, 'g'); m.put(6, 28, '2'); m.put(25, 31, '%')
    m.puts([(48, 30), (49, 30), (48, 31), (49, 31)], 'X')
    # Luzes
    m.puts([(4, 2), (31, 6), (45, 4), (20, 12), (6, 22), (44, 21), (40, 29)], '*')
    m.puts([(17, 6), (43, 10), (22, 23), (12, 29)], '^')
    m.puts([(8, 13), (34, 17), (30, 13)], '&')
    return m

def L2():
    m = M(58, 38)
    # Entrada (baixo-esquerda)
    m.fill(1, 29, 11, 36, '_')
    # Chapelaria / hall
    m.fill(13, 29, 26, 36, ',')
    m.fill(12, 32, 12, 33, ',')
    # Salão principal
    m.fill(13, 8, 44, 27, '.')
    m.fill(19, 28, 20, 28, ',')
    m.fill(21, 12, 35, 21, ':')     # pista de dança
    m.fill(16, 10, 16, 23, 'K')     # bar vertical
    m.fill(26, 9, 30, 9, 'K')       # cabine DJ
    m.puts([(38, 10), (39, 10), (40, 10), (38, 13), (39, 13), (40, 13), (38, 23), (39, 23), (40, 23)], 'S')
    m.puts([(39, 11), (39, 24)], 'T')
    m.puts([(21, 25), (22, 25), (33, 25), (34, 25)], 'T')
    m.puts([(43, 9), (14, 26), (43, 26)], 'p')
    # Banheiros (esquerda)
    m.fill(1, 8, 11, 17, ':')
    m.fill(12, 12, 12, 13, ':')
    m.fill(3, 8, 3, 10, '#'); m.fill(6, 8, 6, 10, '#'); m.fill(9, 8, 9, 10, '#')
    # Depósito (esquerda)
    m.fill(1, 19, 11, 27, '.')
    m.fill(12, 21, 12, 22, '.'); m.fill(5, 18, 6, 18, '.'); m.fill(4, 28, 5, 28, '_')
    m.puts([(2, 20), (3, 20), (2, 21), (8, 24), (9, 24), (9, 25), (2, 26), (3, 26)], 'C')
    # VIP (direita)
    m.fill(46, 8, 56, 18, ',')
    m.fill(45, 10, 45, 11, ',')
    m.fill(48, 10, 51, 10, 'S'); m.fill(48, 14, 51, 14, 'S'); m.fill(49, 12, 50, 12, 'T')
    m.fill(55, 9, 55, 11, 'S')
    # Bastidores (direita-baixo)
    m.fill(46, 20, 56, 36, '.')
    m.fill(45, 23, 45, 24, '.'); m.fill(50, 19, 51, 19, ',')
    m.fill(28, 29, 44, 36, '.')     # cozinha / carga
    m.fill(45, 32, 45, 33, '.'); m.fill(36, 28, 37, 28, '.')
    m.fill(27, 32, 27, 33, ',')
    m.puts([(30, 31), (31, 31), (32, 31), (30, 34), (31, 34), (32, 34)], 'K')
    m.puts([(48, 22), (49, 22), (48, 23), (54, 28), (55, 28), (54, 29), (48, 33), (49, 33)], 'C')
    # Escritório do dono (topo)
    m.fill(30, 1, 56, 6, '_')
    m.fill(52, 7, 53, 7, ',')
    m.fill(36, 7, 37, 7, '.')
    m.fill(40, 3, 43, 3, 'K'); m.puts([(31, 1), (56, 1)], 'p')
    m.fill(46, 1, 46, 4, '#')
    m.fill(46, 3, 46, 3, '_')
    m.puts([(1, 1)], '#')
    # Entidades
    m.put(4, 33, 'P'); m.put(8, 35, 'a')
    m.put(18, 31, 'g'); m.put(24, 34, 'g'); m.put(15, 35, '+')
    m.put(24, 14, 'g'); m.put(31, 18, 'g'); m.put(28, 16, 'n'); m.put(15, 15, 'g'); m.put(28, 8, 'm')
    m.put(41, 21, 'n'); m.put(19, 24, '%'); m.put(42, 15, 'g')
    m.put(5, 13, 'g'); m.put(10, 15, '2')
    m.put(7, 22, 'm'); m.put(4, 25, 'a')
    m.put(52, 16, 'n'); m.put(54, 12, 'g'); m.put(47, 9, '%'); m.put(56, 17, '5')
    m.put(52, 25, 'g'); m.put(50, 30, 'm'); m.put(55, 35, '+')
    m.put(34, 33, 'g'); m.put(41, 30, 'n'); m.put(29, 35, '%')
    m.put(34, 4, 'g'); m.put(44, 5, 'n'); m.put(50, 2, 'g')
    m.puts([(54, 2), (55, 2), (54, 3), (55, 3)], 'X')
    # Luzes neon
    m.puts([(22, 13), (34, 20), (17, 9), (41, 25), (6, 31), (51, 24)], '*')
    m.puts([(34, 13), (22, 20), (28, 11), (5, 12), (41, 33)], '^')
    m.puts([(28, 17), (49, 12), (39, 11), (20, 33), (33, 5), (52, 34), (7, 23)], '&')
    return m

def L3():
    m = M(66, 42)
    # Tudo começa como prédio (parede). Ruas e calçadas são escavadas.
    m.fill(1, 15, 64, 15, '_'); m.fill(1, 16, 64, 22, '.'); m.fill(1, 23, 64, 23, '_')   # rua horizontal
    m.fill(30, 1, 30, 40, '_'); m.fill(31, 1, 36, 40, '.'); m.fill(37, 1, 37, 40, '_')   # rua vertical
    m.fill(30, 15, 37, 23, '.')
    # Becos
    m.fill(8, 24, 10, 40, ',')       # beco inicial (baixo-esquerda)
    m.fill(1, 37, 7, 40, ',')
    m.fill(11, 30, 29, 32, ',')       # beco baixo
    m.fill(18, 24, 20, 29, ',')
    m.fill(44, 24, 46, 40, ',')       # beco baixo-direita
    m.fill(38, 34, 43, 36, ',')
    m.fill(47, 30, 64, 32, ',')
    m.fill(14, 1, 16, 14, ',')        # beco topo-esquerda
    m.fill(1, 6, 13, 8, ',')
    m.fill(17, 4, 29, 6, ',')
    m.fill(48, 1, 50, 14, ',')        # beco topo-direita (saída)
    m.fill(51, 1, 64, 3, ',')
    m.fill(38, 8, 47, 10, ',')
    m.fill(55, 4, 57, 14, ',')
    # Pátio interno (praça)
    m.fill(2, 26, 7, 34, '_')
    m.fill(53, 34, 63, 40, '_')
    m.fill(52, 33, 52, 33, ','); m.fill(53, 33, 53, 33, '_')
    # Carros (cobertura)
    m.fill(5, 17, 7, 18, 'V'); m.fill(18, 20, 20, 21, 'V'); m.fill(25, 17, 27, 18, 'V')
    m.fill(41, 19, 43, 20, 'V'); m.fill(52, 17, 54, 18, 'V'); m.fill(59, 20, 61, 21, 'V')
    m.fill(32, 5, 33, 7, 'V'); m.fill(34, 27, 35, 29, 'V'); m.fill(32, 35, 33, 37, 'V'); m.fill(34, 11, 35, 13, 'V')
    # Caçambas / caixas
    m.puts([(9, 27), (19, 26), (13, 31), (14, 31), (45, 27), (46, 38), (40, 35), (58, 31), (59, 31), (15, 9), (11, 7), (22, 5), (49, 6), (56, 9), (42, 9), (60, 2), (61, 2)], 'C')
    m.puts([(30, 25), (37, 13), (12, 23), (52, 15), (23, 15)], 'p')
    # Entidades
    m.put(9, 39, 'P'); m.put(3, 38, 'a'); m.put(4, 30, '3')
    m.put(19, 28, 'g'); m.put(24, 31, 'n'); m.put(5, 27, 'g')
    m.put(12, 19, 'f'); m.put(22, 17, 'g'); m.put(28, 21, 'n'); m.put(16, 22, '%')
    m.put(33, 30, 'g'); m.put(36, 38, 'f'); m.put(31, 24, '%')
    m.put(44, 21, 'g'); m.put(50, 16, 'f'); m.put(57, 22, 'n'); m.put(62, 18, 'g'); m.put(47, 22, '+')
    m.put(45, 33, 'm'); m.put(58, 36, 'g'); m.put(55, 31, 'f'); m.put(62, 39, 'a')
    m.put(34, 9, 'g'); m.put(32, 2, 'f'); m.put(36, 4, '%')
    m.put(15, 3, 'g'); m.put(5, 7, 'm'); m.put(25, 5, 'n'); m.put(2, 7, '+')
    m.put(43, 9, 'g'); m.put(49, 11, 'f'); m.put(56, 6, 'n'); m.put(53, 2, 'g')
    m.puts([(62, 1), (63, 1), (62, 2), (63, 2)], 'X')
    # Postes (luzes)
    m.puts([(4, 15), (20, 15), (38, 23), (54, 23), (9, 33)], '*')
    m.puts([(13, 23), (30, 9), (37, 30), (46, 15), (61, 23), (28, 15)], '^')
    m.puts([(19, 31), (45, 35), (15, 6), (49, 9), (58, 38), (5, 29), (60, 2)], '&')
    return m

def L4():
    m = M(62, 42)
    # Saguão (baixo)
    m.fill(18, 33, 43, 40, '_')
    m.fill(20, 35, 24, 35, 'K')       # recepção
    m.puts([(35, 36), (36, 36), (37, 36), (35, 38), (36, 38), (37, 38)], 'S')
    m.puts([(19, 33), (42, 33), (19, 40), (42, 40)], 'p')
    m.fill(26, 37, 27, 38, 'O'); m.fill(32, 34, 33, 35, 'O')
    # Corredor principal vertical
    m.fill(29, 3, 32, 32, ',')
    # Corredores horizontais
    m.fill(2, 11, 59, 12, ','); m.fill(2, 22, 59, 23, ',')
    m.fill(2, 3, 59, 3, ',')
    m.fill(2, 3, 2, 32, ','); m.fill(59, 3, 59, 32, ',')
    m.fill(2, 32, 17, 32, ','); m.fill(44, 32, 59, 32, ',')
    m.fill(17, 33, 17, 34, ','); m.fill(44, 33, 44, 34, ',')
    # Quartos: blocos entre corredores
    rooms = []
    for (x0, x1) in ((4, 11), (13, 20), (22, 27), (34, 39), (41, 48), (50, 57)):
        for (y0, y1) in ((5, 9), (14, 20), (25, 30)):
            rooms.append((x0, y0, x1, y1))
    import random
    rnd = random.Random(7)
    for i, (x0, y0, x1, y1) in enumerate(rooms):
        m.fill(x0, y0, x1, y1, '.')
        w = x1 - x0
        # porta: para o corredor acima (y0-1) ou abaixo
        dx = x0 + w // 2
        if y0 == 5:
            m.fill(dx, 4, dx + 1, 4, '.')
        elif y0 == 14:
            m.fill(dx, 13, dx + 1, 13, '.')
        else:
            m.fill(dx, 24, dx + 1, 24, '.')
        # banheiro (canto)
        bx = x1 - 2
        m.fill(bx, y1 - 1, x1, y1, ':')
        m.fill(bx - 1, y1 - 1, bx - 1, y1, '#')
        m.put(bx, y1 - 2, '#'); m.put(bx + 1, y1 - 2, ':') if False else None
        m.put(x1, y1 - 2, '#')
        # cama
        m.fill(x0, y0 + 1, x0 + 1, y0 + 2, 'S')
        m.put(x0 + w - 1, y0, 'p') if w > 5 else None
    # Sala de segurança do hotel (centro dos corredores)
    # Elevadores (topo)
    m.fill(27, 1, 34, 2, '_')
    m.fill(28, 1, 33, 1, '_')
    m.fill(27, 3, 28, 3, ',')
    # Entidades
    m.put(30, 39, 'P'); m.put(22, 38, 'a'); m.put(40, 34, '+')
    m.put(24, 34, 'g'); m.put(38, 39, 'g'); m.put(28, 34, '%')
    m.put(30, 28, 'e'); m.put(31, 17, 'g'); m.put(30, 7, 'n')
    m.put(10, 22, 'f'); m.put(50, 23, 'f'); m.put(45, 11, 'e'); m.put(15, 12, 'g')
    m.put(2, 18, 'n'); m.put(59, 27, 'm'); m.put(59, 8, 'g'); m.put(3, 6, 'e')
    # Quartos com inimigos
    m.put(7, 27, 'g'); m.put(16, 16, 'm'); m.put(24, 27, 'n'); m.put(36, 16, 'g')
    m.put(45, 27, 'e'); m.put(53, 16, 'n'); m.put(8, 7, 'g'); m.put(53, 7, 'e')
    m.put(17, 6, 'a'); m.put(44, 7, '3'); m.put(37, 27, '+'); m.put(55, 28, 'a'); m.put(9, 16, '2')
    m.put(24, 7, '%'); m.put(38, 22, '%')
    m.put(31, 1, 'e')
    m.puts([(29, 1), (30, 1), (29, 2), (30, 2)], 'X')
    # Luzes
    m.puts([(30, 12), (30, 22), (10, 3), (50, 3), (2, 27), (59, 17), (25, 39)], '*')
    m.puts([(16, 11), (45, 23), (36, 39), (30, 2), (7, 17), (54, 27)], '^')
    m.puts([(45, 12), (16, 23), (31, 32), (20, 7), (40, 7), (24, 28), (53, 18)], '&')
    return m

def L5():
    m = M(60, 46)
    # Pátio de entrada (baixo)
    m.fill(20, 36, 39, 44, '_')
    m.fill(28, 35, 31, 35, ':')
    m.puts([(22, 38), (37, 38), (22, 42), (37, 42)], 'p')
    m.fill(24, 40, 25, 40, 'C'); m.fill(34, 40, 35, 40, 'C')
    # Galeria (meio)
    m.fill(6, 25, 53, 34, ':')
    m.fill(10, 27, 11, 28, 'O'); m.fill(10, 31, 11, 32, 'O'); m.fill(48, 27, 49, 28, 'O'); m.fill(48, 31, 49, 32, 'O')
    m.fill(20, 29, 22, 30, 'K'); m.fill(37, 29, 39, 30, 'K')
    # Alas laterais
    m.fill(1, 12, 10, 23, ','); m.fill(49, 12, 58, 23, ',')
    m.fill(4, 24, 5, 24, ','); m.fill(54, 24, 55, 24, ',')
    m.fill(3, 14, 4, 15, 'S'); m.fill(55, 14, 56, 15, 'S'); m.fill(7, 20, 8, 20, 'T'); m.fill(51, 20, 52, 20, 'T')
    # Arena do chefe (topo)
    m.fill(12, 2, 47, 22, '.')
    m.fill(11, 16, 11, 17, ','); m.fill(48, 16, 48, 17, ',')
    m.fill(28, 23, 31, 24, ':')
    for (x, y) in ((17, 6), (26, 6), (33, 6), (42, 6), (17, 13), (42, 13), (17, 19), (26, 18), (33, 18), (42, 19)):
        m.fill(x, y, x + 1, y + 1, 'O')
    m.fill(27, 11, 32, 12, 'K')    # mesa do chefe
    # Entidades
    m.put(29, 43, 'P'); m.put(21, 43, 'a'); m.put(38, 43, '+')
    m.put(26, 38, 'g'); m.put(33, 37, 'n'); m.put(29, 38, '%')
    m.put(15, 27, 'e'); m.put(44, 32, 'e'); m.put(29, 27, 'f'); m.put(24, 33, 'm'); m.put(35, 26, 'n')
    m.put(7, 30, '3'); m.put(52, 30, '2'); m.put(8, 26, '%'); m.put(51, 33, '%')
    m.put(5, 17, 'e'); m.put(2, 13, 'a'); m.put(9, 22, '+')
    m.put(54, 17, 'f'); m.put(57, 13, 'a'); m.put(50, 22, '+')
    m.put(29, 4, 'B')
    m.puts([(14, 3), (45, 3), (14, 21), (45, 21)], 'R')
    m.puts([(22, 9), (37, 9), (22, 16), (37, 16)], '%')
    # Luzes
    m.puts([(29, 3), (14, 12), (45, 12), (29, 21), (8, 29), (51, 29), (29, 41)], '*')
    m.puts([(20, 3), (39, 3), (20, 21), (39, 21), (5, 13), (54, 13)], '^')
    m.puts([(29, 15), (24, 33), (35, 33), (29, 37), (6, 22), (53, 22)], '&')
    return m

def check(name, rows):
    w = len(rows[0])
    assert all(len(r) == w for r in rows), name
    # alcance via BFS a partir de P
    H = len(rows)
    solid = set('#WCKSVOTp')
    start = [(x, y) for y in range(H) for x in range(w) if rows[y][x] == 'P']
    assert len(start) == 1, (name, 'P')
    seen = {start[0]}; q = [start[0]]
    while q:
        x, y = q.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < H and (nx, ny) not in seen and rows[ny][nx] not in solid:
                seen.add((nx, ny)); q.append((nx, ny))
    bad = []
    for y in range(H):
        for x in range(w):
            c = rows[y][x]
            if c in 'XgnfmeBR12345a+%' and (x, y) not in seen:
                bad.append((c, x, y))
            if (x in (0, w - 1) or y in (0, H - 1)) and c != '#':
                bad.append(('borda', c, x, y))
    counts = {}
    for r in rows:
        for c in r:
            if c in 'gnfmeB':
                counts[c] = counts.get(c, 0) + 1
    print(name, f'{w}x{H}', 'inimigos', sum(counts.values()), counts, 'PROBLEMAS:' if bad else 'ok', bad)
    return not bad

if __name__ == '__main__':
    out = []
    ok = True
    import gen_maps
    gen = gen_maps.gen_all()
    allmaps = [('L1', L1().text()), ('L2', L2().text()), ('L3', L3().text()), ('L4', L4().text())]
    allmaps += [('G%d' % (i + 5), r) for i, r in enumerate(gen)]
    allmaps += [('L15', L5().text())]
    for name, rows in allmaps:
        ok &= check(name, rows)
        out.append(rows)
    js = '// Mapas gerados (ASCII editável). Legenda no README.md\n"use strict";\nconst MAPS = [\n'
    for rows in out:
        js += '[\n' + ',\n'.join(json.dumps(r) for r in rows) + '\n],\n'
    js += '];\n'
    open(sys.argv[1], 'w').write(js)
    if not ok:
        sys.exit(1)
