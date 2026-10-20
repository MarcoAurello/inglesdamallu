"""Recorta as animações da Mallu de referencias/sprites.jpg e tira o fundo bege.
Saída em assets/mallu/: mallu_corre.png (7 quadros), mallu_pula.png (5 quadros) e as poses
mallu_aponta.png, mallu_pensa.png, mallu_duvida.png e mallu_feliz.png.
Uso: python ferramentas/sprites.py"""
from collections import deque
from pathlib import Path
from PIL import Image
import numpy as np

RAIZ = Path(__file__).resolve().parent.parent
img = np.array(Image.open(RAIZ / 'referencias' / 'sprites.jpg').convert('RGB')).astype(int)
FUNDO = np.array([229, 222, 213])

def recortar(x0, y0, x1, y1):
    cel = img[y0:y1, x0:x1]
    H, W = cel.shape[:2]
    perto = np.abs(cel - FUNDO).sum(axis=2) < 48
    bg = np.zeros((H, W), bool)
    fila = deque([(x, 0) for x in range(W)] + [(x, H - 1) for x in range(W)] +
                 [(0, y) for y in range(H)] + [(W - 1, y) for y in range(H)])
    while fila:
        x, y = fila.popleft()
        if x < 0 or y < 0 or x >= W or y >= H or bg[y, x] or not perto[y, x]:
            continue
        bg[y, x] = True
        fila.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    # fica só com o maior pedaço (pedaços do quadro vizinho somem)
    rot = np.zeros((H, W), int); maior, tam, n = 0, 0, 0
    for yy in range(H):
        for xx in range(W):
            if bg[yy, xx] or rot[yy, xx]:
                continue
            n += 1; q = deque([(xx, yy)]); rot[yy, xx] = n; c = 0
            while q:
                x, y = q.popleft(); c += 1
                for vx, vy in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= vx < W and 0 <= vy < H and not bg[vy, vx] and not rot[vy, vx]:
                        rot[vy, vx] = n; q.append((vx, vy))
            if c > tam: tam, maior = c, n
    corpo = rot == maior
    rgba = np.zeros((H, W, 4), np.uint8)
    rgba[..., :3] = cel
    rgba[..., 3] = np.where(corpo, 255, 0)
    ys, xs = np.where(corpo)
    return Image.fromarray(rgba).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

def folha(nome, celulas):
    quadros = [recortar(*c) for c in celulas]
    w = max(q.width for q in quadros) + 6
    h = max(q.height for q in quadros) + 4
    out = Image.new('RGBA', (w * len(quadros), h), (0, 0, 0, 0))
    for i, q in enumerate(quadros):   # alinhados pelos pés, no centro do quadro
        out.paste(q, (i * w + (w - q.width) // 2, h - q.height - 2), q)
    out.save(RAIZ / 'assets' / 'mallu' / f'{nome}.png', optimize=True)
    print(nome, len(quadros), 'quadros', w, 'x', h)

y0, y1 = 120, 385
folha('mallu_corre', [(x0, y0, x1, y1) for x0, x1 in [(18, 156), (156, 278), (278, 400), (400, 518), (518, 655), (655, 770), (770, 902)]])
folha('mallu_pula', [(x0, 412, x1, 765) for x0, x1 in [(38, 192), (198, 364), (364, 546), (546, 718), (718, 890)]])
for nome, (x0, x1) in zip(['aponta', 'pensa', 'duvida', 'feliz'], [(18, 247), (250, 472), (474, 686), (686, 892)]):
    folha(f'mallu_{nome}', [(x0, 798, x1, 1100)])
