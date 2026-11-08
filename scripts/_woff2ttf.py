
import sys, json
from fontTools.ttLib import TTFont
jobs = json.loads(sys.argv[1])
for j in jobs:
    f = TTFont(j["from"], fontNumber=0)
    f.flavor = None
    f.save(j["ttf"])
print("fonts-ok", len(jobs))
