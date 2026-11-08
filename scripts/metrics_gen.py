import json, sys, os
from fontTools.ttLib import TTFont

root = sys.argv[1]
files = [
    ("Poppins", 400, "public/fonts/poppins-latin-400-normal.ttf"),
    ("Poppins", 500, "public/fonts/poppins-latin-500-normal.ttf"),
    ("Poppins", 600, "public/fonts/poppins-latin-600-normal.ttf"),
    ("Playfair Display", 500, "public/fonts/playfair-display-latin-500-normal.ttf"),
    ("Playfair Display", 600, "public/fonts/playfair-display-latin-600-normal.ttf"),
]
out = {}
for fam, w, rel in files:
    f = TTFont(os.path.join(root, rel))
    upm = f["head"].unitsPerEm
    cmap = f.getBestCmap()
    hmtx = f["hmtx"]
    adv = {}
    for cp, name in cmap.items():
        if 32 <= cp < 0x2200:
            ch = chr(cp)
            adv[ch] = round(hmtx[name][0] * 1000.0 / upm, 1)
    out.setdefault(fam, {})[str(w)] = adv
print(json.dumps(out, ensure_ascii=False))
