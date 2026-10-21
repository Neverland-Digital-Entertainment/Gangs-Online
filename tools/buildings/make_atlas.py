"""
港漫風格大廈共用貼圖（atlas）產生器

輸出：
  tools/buildings/atlas/hk_comic_atlas.png   （1024×1024，原圖，方便人手修改）
  tools/buildings/atlas/hk_comic_atlas.webp  （無損 WebP，嵌入 GLB 用）
  tools/buildings/atlas/atlas_layout.json    （每個區域嘅像素範圍 + 實際尺寸，build_buildings.py 讀）

版面（像素）：
  y   0–448  上層外牆 14 款，每款 512×64 = 闊 24m × 一層 3m（2 欄 × 7 行）
  y 448–832  地舖 6 款，每款 512×128 = 闊 18m × 4.5m（2 欄 × 3 行）
  y 832–848  女兒牆（parapet）2 款
  y 848–912  天台 2 款（天台唔放任何物件，遊戲視角睇唔到）
  y 912–928  簷篷邊 + 純墨色（描邊／牆角線／地腳線）
  y 928–1024 直招牌 16 個，每個 64×96

風格：粗黑描邊、平塗色、網點（screentone）同斜線陰影 —— 港漫味。
"""

import json
import math
import os
import random

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "atlas")
FONT_PATH = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"

SIZE = 1024
INK = (24, 20, 28)
WHITE = (250, 248, 240)

rng = random.Random(19)


def font(px):
    return ImageFont.truetype(FONT_PATH, px)


# ---------------------------------------------------------------- 筆觸工具

def ink_rect(d, box, fill=None, width=2):
    d.rectangle(box, fill=fill, outline=INK, width=width)


def hatch(d, box, spacing=4, color=INK, width=1, direction=1):
    """斜線陰影（港漫常用）"""
    x0, y0, x1, y1 = box
    h = y1 - y0
    start = x0 - h if direction > 0 else x0
    for x in range(int(start), int(x1 + h), spacing):
        if direction > 0:
            d.line([(x, y1), (x + h, y0)], fill=color, width=width)
        else:
            d.line([(x, y0), (x + h, y1)], fill=color, width=width)


def clip_hatch(img, box, spacing=4, color=INK, width=1, direction=1):
    """只喺 box 範圍內畫斜線（避免畫出界）"""
    x0, y0, x1, y1 = [int(v) for v in box]
    if x1 <= x0 or y1 <= y0:
        return
    tile = img.crop((x0, y0, x1, y1))
    td = ImageDraw.Draw(tile)
    hatch(td, (0, 0, x1 - x0, y1 - y0), spacing, color, width, direction)
    img.paste(tile, (x0, y0))


def screentone(img, box, spacing=4, radius=1, color=INK):
    """網點"""
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = [int(v) for v in box]
    for yy in range(y0 + spacing // 2, y1, spacing):
        off = (spacing // 2) if ((yy - y0) // spacing) % 2 else 0
        for xx in range(x0 + off, x1, spacing):
            d.ellipse((xx - radius, yy - radius, xx + radius, yy + radius), fill=color)


def jitter(c, amount=10):
    return tuple(max(0, min(255, v + rng.randint(-amount, amount))) for v in c)


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)


def stains(d, box, color, n=6):
    """水漬（由上而下嘅污跡）"""
    x0, y0, x1, y1 = box
    for _ in range(n):
        x = rng.randint(int(x0), int(x1) - 3)
        w = rng.randint(2, 6)
        length = rng.randint(int((y1 - y0) * 0.3), int(y1 - y0))
        d.rectangle((x, y0, x + w, y0 + length), fill=color)


def text_center(d, box, s, size, fill, stroke=INK, stroke_width=2, vertical=False):
    f = font(size)
    x0, y0, x1, y1 = box
    if vertical:
        n = len(s)
        step = (y1 - y0) / max(n, 1)
        for i, ch in enumerate(s):
            cy = y0 + step * (i + 0.5)
            d.text(((x0 + x1) / 2, cy), ch, font=f, fill=fill, anchor="mm",
                   stroke_width=stroke_width, stroke_fill=stroke)
    else:
        d.text(((x0 + x1) / 2, (y0 + y1) / 2), s, font=f, fill=fill, anchor="mm",
               stroke_width=stroke_width, stroke_fill=stroke)


# ---------------------------------------------------------------- 上層外牆（512×64，8 個 3m 開間）

BAY = 64  # 3m 一個開間


def floor_slab(img, d, w, h, wall):
    """每層底部嘅樓板線 + 影"""
    d.rectangle((0, h - 6, w, h), fill=shade(wall, 0.82))
    d.line([(0, h - 6), (w, h - 6)], fill=INK, width=2)
    d.line([(0, h - 1), (w, h - 1)], fill=INK, width=1)


def window(img, d, box, frame, glass=(52, 60, 78), grille=None, open_ratio=0.0):
    x0, y0, x1, y1 = box
    ink_rect(d, box, fill=frame, width=2)
    inner = (x0 + 3, y0 + 3, x1 - 3, y1 - 3)
    d.rectangle(inner, fill=glass)
    # 玻璃反光（港漫式斜白線）
    gx0, gy0, gx1, gy1 = inner
    if rng.random() < 0.7:
        k = rng.randint(2, 6)
        d.line([(gx0 + k, gy1 - 2), (gx0 + k + (gy1 - gy0) // 2, gy0 + 2)], fill=(200, 215, 230), width=2)
        d.line([(gx0 + k + 5, gy1 - 2), (gx0 + k + 5 + (gy1 - gy0) // 3, gy0 + 6)], fill=(150, 170, 190), width=1)
    # 中間窗框
    mx = (x0 + x1) // 2
    d.line([(mx, y0), (mx, y1)], fill=INK, width=2)
    if grille:
        for gx in range(x0 + 4, x1 - 2, 5):
            d.line([(gx, y0 + 2), (gx, y1 - 2)], fill=grille, width=1)
        d.line([(x0 + 2, (y0 + y1) // 2), (x1 - 2, (y0 + y1) // 2)], fill=grille, width=1)
    if open_ratio > 0:
        # 窗內暗影
        clip_hatch(img, (gx0, gy0, gx0 + int((gx1 - gx0) * open_ratio), gy1), 3, (20, 20, 30), 1)


def ac_unit(d, x, y, w=18, h=12):
    ink_rect(d, (x, y, x + w, y + h), fill=(214, 214, 206), width=2)
    for gy in range(y + 3, y + h - 1, 3):
        d.line([(x + 3, gy), (x + w - 3, gy)], fill=(120, 120, 120), width=1)
    d.rectangle((x + 2, y + h, x + w - 2, y + h + 2), fill=INK)


def laundry(d, x0, x1, y):
    d.line([(x0, y), (x1, y)], fill=(140, 110, 70), width=2)
    x = x0 + 2
    while x < x1 - 6:
        w = rng.randint(4, 9)
        h = rng.randint(6, 14)
        c = rng.choice([(220, 60, 60), (240, 240, 230), (70, 110, 200), (240, 200, 60), (90, 160, 90), (200, 120, 180)])
        ink_rect(d, (x, y, x + w, y + h), fill=c, width=1)
        x += w + rng.randint(1, 4)


def strip_tonglau(wall, frame, laundry_p=0.0, grille=None):
    def draw(img, d, w, h):
        d.rectangle((0, 0, w, h), fill=wall)
        screentone(img, (0, 0, w, h), spacing=6, radius=0, color=shade(wall, 0.9))
        stains(d, (0, 0, w, h - 8), shade(wall, 0.88), n=10)
        for b in range(w // BAY):
            x = b * BAY
            # 長窗 + 露台
            window(img, d, (x + 12, y_ := 8, x + 52, 42), frame, grille=grille, open_ratio=rng.choice([0, 0, 0.4]))
            # 窗頂遮陽
            d.rectangle((x + 9, 5, x + 55, 8), fill=shade(wall, 0.7))
            d.line([(x + 9, 8), (x + 55, 8)], fill=INK, width=2)
            # 露台欄杆
            d.rectangle((x + 6, 42, x + 58, 57), fill=shade(wall, 0.92))
            d.line([(x + 6, 42), (x + 58, 42)], fill=INK, width=2)
            for rx in range(x + 9, x + 57, 4):
                d.line([(rx, 43), (rx, 55)], fill=INK, width=1)
            d.line([(x + 6, 55), (x + 58, 55)], fill=INK, width=2)
            clip_hatch(img, (x + 6, 43, x + 58, 47), 3, shade(wall, 0.5), 1)
            if rng.random() < laundry_p:
                laundry(d, x + 8, x + 56, 30)
        # 開間之間嘅柱
        for b in range(w // BAY + 1):
            d.line([(b * BAY, 0), (b * BAY, h)], fill=shade(wall, 0.75), width=2)
        floor_slab(img, d, w, h, wall)
    return draw


def strip_composite(wall, frame, grille_cages=False):
    def draw(img, d, w, h):
        d.rectangle((0, 0, w, h), fill=wall)
        stains(d, (0, 0, w, h - 8), shade(wall, 0.85), n=14)
        # 橫向長窗
        x = 0
        while x < w:
            seg = 64 if rng.random() < 0.7 else 32
            if grille_cages and rng.random() < 0.5:
                # 鐵籠（凸出窗花）
                ink_rect(d, (x + 4, 10, x + seg - 4, 44), fill=(60, 66, 70), width=2)
                for gx in range(x + 7, x + seg - 5, 4):
                    d.line([(gx, 12), (gx, 42)], fill=(150, 160, 160), width=1)
                for gy in range(14, 42, 6):
                    d.line([(x + 6, gy), (x + seg - 6, gy)], fill=(150, 160, 160), width=1)
                d.rectangle((x + 4, 44, x + seg - 4, 47), fill=INK)
            else:
                window(img, d, (x + 4, 12, x + seg - 4, 40), frame, glass=(44, 54, 70))
            if rng.random() < 0.55:
                ac_unit(d, x + rng.randint(6, max(7, seg - 26)), 42)
            x += seg
        d.line([(0, 8), (w, 8)], fill=shade(wall, 0.7), width=2)
        floor_slab(img, d, w, h, wall)
    return draw


def mosaic(img, box, base, cell=4):
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = box
    for yy in range(y0, y1, cell):
        for xx in range(x0, x1, cell):
            d.rectangle((xx, yy, xx + cell - 2, yy + cell - 2), fill=jitter(base, 6))
        d.line([(x0, yy + cell - 1), (x1, yy + cell - 1)], fill=shade(base, 0.85))


def strip_tower(tile):
    def draw(img, d, w, h):
        d.rectangle((0, 0, w, h), fill=shade(tile, 0.85))
        mosaic(img, (0, 0, w, h - 6), tile)
        d = ImageDraw.Draw(img)
        for b in range(w // BAY):
            x = b * BAY
            # 窗台（凸窗）
            ink_rect(d, (x + 8, 9, x + 56, 41), fill=(196, 200, 204), width=2)
            window(img, d, (x + 11, 12, x + 53, 38), (176, 182, 188), glass=(70, 92, 112))
            d.rectangle((x + 8, 41, x + 56, 45), fill=(130, 130, 130))
            d.line([(x + 8, 45), (x + 56, 45)], fill=INK, width=2)
            clip_hatch(img, (x + 8, 45, x + 56, 50), 3, shade(tile, 0.45), 1)
            if rng.random() < 0.6:
                ac_unit(d, x + rng.choice([2, 40]), 46, 18, 10)
        floor_slab(img, d, w, h, tile)
    return draw


def strip_glass():
    def draw(img, d, w, h):
        glass = (66, 120, 150)
        d.rectangle((0, 0, w, h), fill=glass)
        # 反光漸層 + 斜白線（港漫速度線）
        for i in range(0, w, 2):
            t = (math.sin(i / 37.0) + 1) / 2
            c = tuple(int(a + (b - a) * t * 0.35) for a, b in zip(glass, (170, 210, 230)))
            d.line([(i, 0), (i, h)], fill=c)
        for _ in range(10):
            x = rng.randint(-40, w)
            d.line([(x, h - 8), (x + 30, 0)], fill=(230, 245, 250), width=rng.choice([1, 2, 3]))
        for x in range(0, w + 1, 32):
            d.line([(x, 0), (x, h)], fill=INK, width=2)
        d.rectangle((0, h - 12, w, h), fill=(40, 52, 60))
        d.line([(0, h - 12), (w, h - 12)], fill=INK, width=2)
        screentone(img, (0, h - 11, w, h), spacing=4, radius=1, color=(20, 28, 34))
    return draw


def strip_stone():
    def draw(img, d, w, h):
        stone = (176, 172, 162)
        d.rectangle((0, 0, w, h), fill=stone)
        for x in range(0, w, 16):
            d.line([(x, 0), (x, h)], fill=shade(stone, 0.9))
        # 長條窗
        d.rectangle((0, 14, w, 40), fill=(48, 58, 72))
        d.line([(0, 14), (w, 14)], fill=INK, width=2)
        d.line([(0, 40), (w, 40)], fill=INK, width=2)
        for x in range(0, w, 32):
            d.rectangle((x, 10, x + 5, 46), fill=shade(stone, 0.8))
            d.line([(x, 10), (x, 46)], fill=INK, width=1)
            d.line([(x + 5, 10), (x + 5, 46)], fill=INK, width=1)
        for _ in range(6):
            x = rng.randint(0, w)
            d.line([(x, 38), (x + 12, 16)], fill=(150, 170, 190), width=1)
        clip_hatch(img, (0, 40, w, 46), 3, shade(stone, 0.5), 1)
        floor_slab(img, d, w, h, stone)
    return draw


SIGN_WORDS_1F = ["麻雀", "按摩", "補習", "律師", "牙科", "影樓", "髮廊", "桌球"]


def strip_signage():
    def draw(img, d, w, h):
        wall = (210, 200, 180)
        d.rectangle((0, 0, w, h), fill=wall)
        x = 0
        words = SIGN_WORDS_1F[:]
        rng.shuffle(words)
        i = 0
        while x < w:
            seg = 64
            bg, fg = rng.choice([((200, 30, 40), (255, 230, 80)), ((250, 240, 220), (200, 20, 30)),
                                 ((30, 90, 170), (255, 255, 255)), ((250, 200, 40), (30, 30, 30)),
                                 ((20, 130, 80), (255, 250, 220))])
            ink_rect(d, (x + 3, 6, x + seg - 3, 46), fill=bg, width=3)
            stroke, sw = text_stroke(fg)
            text_center(d, (x + 3, 6, x + seg - 3, 46), words[i % len(words)], 22, fg, stroke=stroke, stroke_width=sw)
            i += 1
            x += seg
        clip_hatch(img, (0, 46, w, 52), 3, shade(wall, 0.5), 1)
        floor_slab(img, d, w, h, wall)
    return draw


def strip_blank(wall):
    def draw(img, d, w, h):
        d.rectangle((0, 0, w, h), fill=wall)
        screentone(img, (0, 0, w, h), spacing=5, radius=0, color=shade(wall, 0.88))
        stains(d, (0, 0, w, h), shade(wall, 0.84), n=12)
        for x in (90, 300, 430):
            d.rectangle((x, 0, x + 4, h), fill=(150, 150, 140))
            d.line([(x, 0), (x, h)], fill=INK, width=1)
            d.line([(x + 4, 0), (x + 4, h)], fill=INK, width=1)
            d.rectangle((x - 1, h // 2, x + 5, h // 2 + 3), fill=INK)
        d.line([(0, h - 1), (w, h - 1)], fill=shade(wall, 0.75), width=1)
    return draw


def strip_back(wall):
    def draw(img, d, w, h):
        d.rectangle((0, 0, w, h), fill=wall)
        stains(d, (0, 0, w, h - 6), shade(wall, 0.8), n=16)
        for b in range(w // 48):
            x = b * 48 + rng.randint(0, 10)
            window(img, d, (x + 6, 14, x + 26, 36), (150, 150, 150), glass=(40, 44, 50), grille=(110, 110, 110))
            if rng.random() < 0.7:
                ac_unit(d, x + 26, 30, 16, 11)
        for x in (40, 200, 360):
            d.rectangle((x, 0, x + 3, h), fill=(120, 120, 110))
            d.line([(x, 0), (x, h)], fill=INK, width=1)
        floor_slab(img, d, w, h, wall)
    return draw


UPPER = [
    ("TL_cream", strip_tonglau((232, 218, 178), (60, 110, 80), laundry_p=0.25)),
    ("TL_green", strip_tonglau((168, 204, 164), (110, 60, 40), laundry_p=0.35)),
    ("TL_yellow", strip_tonglau((236, 206, 120), (40, 80, 120), laundry_p=0.5)),
    ("TL_pink", strip_tonglau((226, 170, 168), (40, 40, 40), laundry_p=0.2, grille=(30, 120, 120))),
    ("COMP_blue", strip_composite((166, 192, 210), (190, 190, 190))),
    ("COMP_grey", strip_composite((168, 166, 158), (150, 150, 150), grille_cages=True)),
    ("TOWER_beige", strip_tower((222, 206, 172))),
    ("TOWER_pink", strip_tower((222, 176, 170))),
    ("TOWER_teal", strip_tower((150, 196, 190))),
    ("COMM_glass", strip_glass()),
    ("COMM_stone", strip_stone()),
    ("SIGN_1F", strip_signage()),
    ("BLANK", strip_blank((206, 198, 180))),
    ("BACK", strip_back((180, 176, 166))),
]


# ---------------------------------------------------------------- 地舖（512×128 = 18m × 4.5m）

def shutter(img, d, box, graffiti=False, half=1.0):
    x0, y0, x1, y1 = box
    ys = y0 + int((y1 - y0) * half)
    ink_rect(d, (x0, y0, x1, ys), fill=(160, 164, 166), width=2)
    for yy in range(y0 + 4, ys, 4):
        d.line([(x0 + 2, yy), (x1 - 2, yy)], fill=(110, 114, 116), width=1)
    if graffiti:
        for _ in range(4):
            c = rng.choice([(230, 40, 60), (40, 40, 40), (40, 120, 220), (250, 200, 30)])
            pts = [(rng.randint(x0 + 5, x1 - 5), rng.randint(y0 + 10, ys - 6)) for _ in range(5)]
            d.line(pts, fill=c, width=3)
    if half < 1.0:
        # 半開：下面見到舖內
        d.rectangle((x0 + 2, ys, x1 - 2, y1), fill=(250, 226, 150))
        clip_hatch(img, (x0 + 2, ys, x1 - 2, y1), 4, (190, 150, 80), 1)


def shop_interior(img, d, box, light=(250, 232, 170)):
    x0, y0, x1, y1 = box
    ink_rect(d, box, fill=light, width=2)
    # 貨架 / 人影（簡單色塊）
    for _ in range(5):
        w = rng.randint(6, 16)
        h = rng.randint(10, 30)
        x = rng.randint(x0 + 3, max(x0 + 4, x1 - w - 3))
        c = rng.choice([(200, 60, 50), (60, 120, 200), (230, 180, 40), (80, 160, 90), (240, 240, 240)])
        ink_rect(d, (x, y1 - h - 3, x + w, y1 - 3), fill=c, width=1)
    d.line([(x0, y0 + 6), (x1, y0 + 6)], fill=(255, 255, 230), width=2)


def is_light(c):
    return sum(c) > 560


def text_stroke(fg):
    """淺色字用墨線描邊（港漫招牌味）；深色字唔描黑邊，否則會糊成一嚿"""
    return (INK, 2) if is_light(fg) else (fg, 1)


def fascia(d, box, text, bg, fg, size=24):
    ink_rect(d, box, fill=bg, width=3)
    stroke, sw = text_stroke(fg)
    text_center(d, box, text, size, fg, stroke=stroke, stroke_width=sw)


def pawn_symbol(d, cx, cy, r):
    """大押：蝠鼠吊住金錢（簡化）"""
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(240, 200, 60), outline=INK, width=2)
    d.rectangle((cx - r // 3, cy - r // 3, cx + r // 3, cy + r // 3), fill=(200, 30, 40), outline=INK)
    d.polygon([(cx - r - 10, cy - r - 4), (cx, cy - r + 2), (cx + r + 10, cy - r - 4), (cx, cy - r - 10)],
              fill=(30, 30, 30), outline=INK)


def make_shopstrip(shops):
    def draw(img, d, w, h):
        wall = (190, 182, 168)
        d.rectangle((0, 0, w, h), fill=wall)
        x = 0
        for spec in shops:
            sw = spec.get("w", 128)
            fascia(d, (x + 3, 6, x + sw - 3, 40), spec["name"], spec["bg"], spec["fg"], spec.get("size", 22))
            kind = spec.get("kind", "open")
            body = (x + 6, 46, x + sw - 6, h - 8)
            if kind == "shutter":
                shutter(img, d, body, graffiti=spec.get("graffiti", False))
            elif kind == "half":
                shutter(img, d, body, half=0.45)
            elif kind == "glass":
                shop_interior(img, d, body, light=(230, 240, 236))
                for gx in range(body[0], body[2], 24):
                    d.line([(gx, body[1]), (gx, body[3])], fill=INK, width=2)
            elif kind == "lobby":
                ink_rect(d, body, fill=(60, 54, 50), width=2)
                door = (body[0] + 20, body[1] + 8, body[2] - 20, body[3])
                ink_rect(d, door, fill=(180, 210, 220), width=2)
                d.line([((door[0] + door[2]) // 2, door[1]), ((door[0] + door[2]) // 2, door[3])], fill=INK, width=2)
                clip_hatch(img, (door[0] + 2, door[1] + 2, door[2] - 2, door[3] - 2), 6, (230, 245, 250), 1, -1)
            elif kind == "pawn":
                shop_interior(img, d, body, light=(230, 220, 190))
                ink_rect(d, (body[0] + 10, body[1] + 6, body[2] - 10, body[3]), fill=(60, 30, 26), width=2)
                pawn_symbol(d, (body[0] + body[2]) // 2, body[1] + 30, 12)
            elif kind == "neon":
                ink_rect(d, body, fill=(30, 18, 40), width=2)
                for gy in range(body[1] + 6, body[3], 8):
                    d.line([(body[0] + 4, gy), (body[2] - 4, gy)], fill=(70, 30, 90), width=1)
                stair = (body[0] + 24, body[1] + 14, body[2] - 24, body[3])
                d.rectangle(stair, fill=(120, 40, 60), outline=(255, 80, 180), width=3)
                for gy in range(stair[1] + 6, stair[3], 6):
                    d.line([(stair[0] + 3, gy), (stair[2] - 3, gy)], fill=(60, 20, 30), width=2)
            else:
                shop_interior(img, d, body)
            # 舖與舖之間嘅柱
            d.rectangle((x, 0, x + 3, h), fill=shade(wall, 0.7))
            d.line([(x, 0), (x, h)], fill=INK, width=2)
            x += sw
        # 地腳線
        d.rectangle((0, h - 8, w, h), fill=(70, 66, 62))
        d.line([(0, h - 8), (w, h - 8)], fill=INK, width=2)
        screentone(img, (0, h - 7, w, h), spacing=3, radius=1, color=INK)
    return draw


SHOPS = [
    ("SHOP_old", make_shopstrip([
        dict(name="永昌五金", bg=(30, 110, 60), fg=(255, 250, 220), kind="half"),
        dict(name="和記士多", bg=(250, 240, 220), fg=(200, 20, 30), kind="open"),
        dict(name="", bg=(150, 150, 150), fg=(0, 0, 0), kind="shutter", graffiti=True),
        dict(name="福壽涼茶", bg=(40, 30, 30), fg=(250, 210, 80), kind="open"),
    ])),
    ("SHOP_cafe", make_shopstrip([
        dict(name="金鳳冰室", bg=(200, 30, 40), fg=(255, 230, 80), kind="glass"),
        dict(name="新華茶餐廳", bg=(250, 200, 40), fg=(180, 20, 20), kind="glass", w=192, size=26),
        dict(name="大利粥麵", bg=(250, 245, 230), fg=(30, 60, 140), kind="open", w=192),
    ])),
    ("SHOP_pawn", make_shopstrip([
        dict(name="大押", bg=(180, 20, 30), fg=(255, 220, 60), kind="pawn", size=28),
        dict(name="金行", bg=(200, 30, 40), fg=(255, 230, 120), kind="glass", size=28),
        dict(name="百福藥房", bg=(20, 130, 80), fg=(255, 255, 255), kind="open"),
        dict(name="找換", bg=(20, 60, 150), fg=(255, 230, 80), kind="glass", size=28),
    ])),
    ("SHOP_lobby", make_shopstrip([
        dict(name="置業地產", bg=(250, 250, 250), fg=(20, 60, 160), kind="open"),
        dict(name="大廈入口", bg=(60, 50, 40), fg=(240, 200, 90), kind="lobby", w=192, size=26),
        dict(name="髮型屋", bg=(230, 80, 140), fg=(255, 255, 255), kind="glass", w=192),
    ])),
    ("SHOP_mall", make_shopstrip([
        dict(name="大減價", bg=(230, 30, 40), fg=(255, 255, 255), kind="glass", w=170, size=28),
        dict(name="時裝", bg=(20, 20, 24), fg=(255, 255, 255), kind="glass", w=170, size=28),
        dict(name="商場入口", bg=(40, 60, 90), fg=(255, 230, 120), kind="lobby", w=172, size=26),
    ])),
    ("SHOP_night", make_shopstrip([
        dict(name="卡拉OK", bg=(30, 10, 50), fg=(255, 90, 200), kind="neon", size=26),
        dict(name="夜總會", bg=(20, 10, 30), fg=(90, 240, 255), kind="neon", size=26),
        dict(name="桌球會", bg=(20, 60, 30), fg=(255, 240, 120), kind="neon", size=26),
        dict(name="麻雀館", bg=(150, 20, 30), fg=(255, 230, 90), kind="neon", size=26),
    ])),
]


# ---------------------------------------------------------------- 雜項

def draw_parapet(img, d, box, base, tiled=False):
    x0, y0, x1, y1 = box
    d.rectangle(box, fill=base)
    if tiled:
        mosaic(img, (x0, y0 + 3, x1, y1 - 2), base, cell=4)
        d = ImageDraw.Draw(img)
    d.rectangle((x0, y0, x1, y0 + 3), fill=INK)
    d.line([(x0, y1 - 1), (x1, y1 - 1)], fill=shade(base, 0.6), width=2)


def draw_roof(img, d, box, base):
    x0, y0, x1, y1 = box
    d.rectangle(box, fill=base)
    screentone(img, box, spacing=5, radius=1, color=shade(base, 0.8))
    d = ImageDraw.Draw(img)
    for _ in range(18):
        x = rng.randint(x0, x1 - 30)
        y = rng.randint(y0, y1 - 10)
        d.ellipse((x, y, x + rng.randint(15, 40), y + rng.randint(6, 14)), fill=shade(base, 0.86))
    for x in range(x0, x1, 64):
        d.line([(x, y0), (x, y1)], fill=shade(base, 0.75), width=1)


SIGNS = [
    ("大押", (180, 20, 30), (255, 220, 60)),
    ("麻雀", (20, 20, 30), (255, 80, 120)),
    ("夜總會", (20, 10, 40), (80, 240, 255)),
    ("桌球", (20, 80, 40), (255, 240, 120)),
    ("卡拉OK", (40, 10, 60), (255, 120, 230)),
    ("按摩", (250, 230, 220), (200, 20, 60)),
    ("酒家", (200, 30, 40), (255, 230, 100)),
    ("金行", (220, 160, 30), (160, 20, 20)),
    ("藥房", (20, 120, 70), (255, 255, 255)),
    ("冰室", (250, 250, 240), (30, 80, 180)),
    ("酒店", (30, 30, 80), (255, 210, 90)),
    ("地產", (250, 250, 250), (20, 60, 160)),
    ("涼茶", (40, 30, 30), (250, 200, 80)),
    ("跌打", (230, 210, 150), (150, 20, 20)),
    ("押", (190, 20, 30), (255, 230, 80)),
    ("茶樓", (160, 20, 30), (255, 240, 200)),
]


def draw_sign(img, d, box, text, bg, fg):
    x0, y0, x1, y1 = box
    d.rectangle(box, fill=INK)
    inner = (x0 + 3, y0 + 3, x1 - 3, y1 - 3)
    d.rectangle(inner, fill=bg)
    # 霓虹光暈邊
    d.rectangle((x0 + 6, y0 + 6, x1 - 6, y1 - 6), outline=fg, width=2)
    n = len(text)
    if text == "卡拉OK":
        chars = ["卡", "拉", "OK"]
    else:
        chars = list(text)
    n = len(chars)
    size = 34 if n <= 2 else (24 if n == 3 else 22)
    if n == 1:
        size = 50
    step = (y1 - y0 - 16) / n
    for i, ch in enumerate(chars):
        cy = y0 + 8 + step * (i + 0.5)
        stroke, sw = text_stroke(fg)
        d.text(((x0 + x1) / 2, cy), ch, font=font(size), fill=fg, anchor="mm",
               stroke_width=sw + (1 if stroke == INK else 0), stroke_fill=stroke)
    if text == "大押" or text == "押":
        pawn_symbol(d, (x0 + x1) // 2, y1 - 4, 6)


# ---------------------------------------------------------------- 組合

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    img = Image.new("RGB", (SIZE, SIZE), INK)
    d = ImageDraw.Draw(img)
    layout = {"size": SIZE, "regions": {}}

    def region(name, x, y, w, h, meters_w, meters_h, kind):
        layout["regions"][name] = {"x": x, "y": y, "w": w, "h": h,
                                   "metersW": meters_w, "metersH": meters_h, "kind": kind}

    for i, (name, fn) in enumerate(UPPER):
        col, row = i % 2, i // 2
        x, y, w, h = col * 512, row * 64, 512, 64
        tile = Image.new("RGB", (w, h), INK)
        fn(tile, ImageDraw.Draw(tile), w, h)
        img.paste(tile, (x, y))
        region(name, x, y, w, h, 24.0, 3.0, "upper")

    for i, (name, fn) in enumerate(SHOPS):
        col, row = i % 2, i // 2
        x, y, w, h = col * 512, 448 + row * 128, 512, 128
        tile = Image.new("RGB", (w, h), INK)
        fn(tile, ImageDraw.Draw(tile), w, h)
        img.paste(tile, (x, y))
        region(name, x, y, w, h, 18.0, 4.5, "ground")

    draw_parapet(img, d, (0, 832, 511, 847), (196, 190, 176))
    region("PARAPET_plain", 0, 832, 512, 16, 24.0, 1.0, "parapet")
    draw_parapet(img, d, (512, 832, 1023, 847), (214, 200, 170), tiled=True)
    region("PARAPET_tiled", 512, 832, 512, 16, 24.0, 1.0, "parapet")
    d = ImageDraw.Draw(img)

    draw_roof(img, d, (0, 848, 511, 911), (150, 148, 140))
    region("ROOF_concrete", 0, 848, 512, 64, 24.0, 3.0, "roof")
    d = ImageDraw.Draw(img)
    draw_roof(img, d, (512, 848, 1023, 911), (110, 150, 120))
    region("ROOF_green", 512, 848, 512, 64, 24.0, 3.0, "roof")
    d = ImageDraw.Draw(img)

    # 簷篷邊：淺灰 + 墨線 + 小燈
    d.rectangle((0, 912, 511, 927), fill=(200, 198, 190))
    d.line([(0, 912), (511, 912)], fill=INK, width=2)
    d.line([(0, 926), (511, 926)], fill=INK, width=2)
    for x in range(8, 512, 24):
        d.ellipse((x, 917, x + 5, 922), fill=(255, 240, 160), outline=INK)
    region("CANOPY", 0, 912, 512, 16, 24.0, 0.5, "trim")
    d.rectangle((512, 912, 1023, 927), fill=INK)
    region("INK", 512, 912, 512, 16, 24.0, 1.0, "trim")

    for i, (text, bg, fg) in enumerate(SIGNS):
        x, y = i * 64, 928
        draw_sign(img, d, (x, y, x + 63, y + 95), text, bg, fg)
        region(f"SIGN_{i:02d}", x, y, 64, 96, 1.6, 2.4, "sign")

    png = os.path.join(OUT_DIR, "hk_comic_atlas.png")
    webp = os.path.join(OUT_DIR, "hk_comic_atlas.webp")
    img.save(png, optimize=True)
    img.save(webp, lossless=True, method=6)
    with open(os.path.join(OUT_DIR, "atlas_layout.json"), "w", encoding="utf-8") as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)
    print(f"atlas -> {png} ({os.path.getsize(png)//1024} KB), {webp} ({os.path.getsize(webp)//1024} KB)")


if __name__ == "__main__":
    main()
