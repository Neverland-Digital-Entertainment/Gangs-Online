"""
港漫風格地板貼圖（可以無縫重複鋪）

    python tools/ground/make_ground_textures.py

輸出 tools/ground/textures/：
  pavement.png / .webp   行人路：港式 50cm 方階磚，一張 = 6m × 6m（512px，12 × 12 塊）
  asphalt.png / .webp    馬路：瀝青，一張 = 12m × 12m（1024px）
  layout.json            每張貼圖代表幾多米（restyle_ground.py 讀）

風格同大廈貼圖（tools/buildings/make_atlas.py）一致：平塗色、網點、墨線裂紋；
按遊戲鏡頭距離（約 20–25 像素／米）設計：磚 50cm、磚縫 3px，遠睇睇到格仔但唔會出斜紋（摩爾紋）。
"""

import json
import math
import os
import random

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "textures")

rng = random.Random(1997)


def jitter(c, amount):
    """只變深淺唔變色（每個 channel 加同一個數），唔會變成粉紅／粉綠拼布"""
    k = rng.randint(-amount, amount)
    return tuple(max(0, min(255, v + k)) for v in c)


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)


def wrapped(size, fn):
    """喺 9 個位置畫同一樣嘢（偏移 ±size），跨邊界都無縫"""
    for dx in (-size, 0, size):
        for dy in (-size, 0, size):
            fn(dx, dy)


def blob(d, size, cx, cy, rx, ry, color):
    wrapped(size, lambda dx, dy: d.ellipse((cx - rx + dx, cy - ry + dy, cx + rx + dx, cy + ry + dy), fill=color))


def crack(d, size, x, y, steps, step_len, color, width):
    pts = [(x, y)]
    ang = rng.uniform(0, 6.283)
    for _ in range(steps):
        ang += rng.uniform(-0.7, 0.7)
        x += step_len * math.cos(ang)
        y += step_len * math.sin(ang)
        pts.append((x, y))
    wrapped(size, lambda dx, dy: d.line([(px + dx, py + dy) for px, py in pts], fill=color, width=width))


def screentone(img, box, spacing, radius, color):
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = box
    for yy in range(y0 + spacing // 2, y1, spacing):
        off = spacing // 2 if ((yy - y0) // spacing) % 2 else 0
        for xx in range(x0 + off, x1, spacing):
            d.ellipse((xx - radius, yy - radius, xx + radius, yy + radius), fill=color)


def pavement(size=512, n=12):
    """港式方階磚：暖灰色，每塊深淺少少唔同；幾塊有網點（陰影／舊磚）、水漬、香口膠漬、裂紋"""
    base = (201, 196, 185)
    joint = (166, 159, 147)
    img = Image.new("RGB", (size, size), base)
    d = ImageDraw.Draw(img)
    cell = size / n
    for i in range(n):
        for j in range(n):
            box = (round(i * cell), round(j * cell), round((i + 1) * cell) - 1, round((j + 1) * cell) - 1)
            d.rectangle(box, fill=jitter(base, 7))
            if rng.random() < 0.18:
                screentone(img, box, spacing=5, radius=1, color=shade(base, 0.91))
                d = ImageDraw.Draw(img)
    # 磚縫：3px，喺 cell 倍數兩邊（鋪埋一齊都係 3px）
    for k in range(n + 1):
        p = round(k * cell)
        for q in (p - 2, p - 1, p):
            q %= size
            d.line([(q, 0), (q, size - 1)], fill=joint)
            d.line([(0, q), (size - 1, q)], fill=joint)
    for _ in range(5):  # 水漬
        blob(d, size, rng.randrange(size), rng.randrange(size), rng.randint(8, 20), rng.randint(6, 14),
             shade(base, 0.94))
    for _ in range(14):  # 香口膠漬
        r = rng.randint(2, 3)
        blob(d, size, rng.randrange(size), rng.randrange(size), r, r, (146, 140, 132))
    for _ in range(4):  # 裂紋
        crack(d, size, rng.randrange(size), rng.randrange(size), 4, 6, (112, 106, 100), 2)
    return img


def asphalt(size=1024):
    """瀝青：深藍灰底、雜點、墨線裂紋。唔畫補丁同大片陰影：每 12m 重複一次，一格格好易睇得出"""
    base = (74, 76, 84)
    img = Image.new("RGB", (size, size), base)
    d = ImageDraw.Draw(img)
    for _ in range(16000):  # 雜點
        x, y = rng.randrange(size), rng.randrange(size)
        c = (104, 106, 114) if rng.random() < 0.55 else (54, 55, 62)
        d.point((x, y), fill=c)
        if rng.random() < 0.25:
            d.point(((x + 1) % size, y), fill=c)
    for _ in range(6):  # 裂紋
        crack(d, size, rng.randrange(size), rng.randrange(size), 7, 16, (40, 41, 47), 2)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    layout = {}
    for name, img, metres in (("pavement", pavement(), 6.0), ("asphalt", asphalt(), 12.0)):
        img.save(os.path.join(OUT, f"{name}.png"), optimize=True)
        img.save(os.path.join(OUT, f"{name}.webp"), quality=90, method=6)
        layout[name] = {"file": f"{name}.webp", "metres": metres, "px": img.size[0]}
        print(f"{name}: {img.size[0]}px = {metres}m，webp {os.path.getsize(os.path.join(OUT, name + '.webp')) // 1024} KB")
    with open(os.path.join(OUT, "layout.json"), "w", encoding="utf-8") as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
