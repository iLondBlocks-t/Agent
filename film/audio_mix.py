"""Sound mix for zombies_reels. build.py runs this inside the film folder.
SFX + ambience ONLY: no voiceover, no music. Weather, footsteps, doors, distant groans.
Groans are synthesized here (numpy) as low formant moans — no samples, no AI audio."""
import json, os, sys
import numpy as np
sys.path.insert(0, os.environ["STICKMAN_SCRIPTS"])
from audio_kit import Mix, SR, _lp, _bp

info = json.load(open("film.json"))
D = info["dur"]
m = Mix(D, seed=11)

# ---- synthesized distant groan (a low, breathy formant moan) ---------------
def moan(t, f0=118, dur=1.5, g=.3, p=0., w=.5, fall=.10, vib=4.4):
    n = int(dur * SR); k = np.arange(n) / SR
    f = f0 * (1 + .022 * np.sin(2 * np.pi * vib * k + 1.1)) * (1 - fall * k / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = (np.sin(ph) + .5 * np.sin(2 * ph) + .24 * np.sin(3 * ph) + .1 * np.sin(4 * ph))
    s = _lp(s, 1150)
    breath = _bp(m.noise(n), 260, 1700) * .35
    env = np.minimum(1, k / .34) * np.clip(1 - (k - (dur - .55)) / .5, 0, 1)
    m.put(t, (s + breath) * env, g, p, w)

def chorus(t):
    moan(t,        96, 2.6, .16, -.5, .6)
    moan(t + .45, 112, 2.4, .15,  .1, .6)
    moan(t + .9,  128, 2.2, .14,  .5, .6)

# ---- beds (curve = time, level) --------------------------------------------
SFX = True
if SFX:
    # street world: city bed until the vanish, then wind takes over
    m.street_bed([(0, 1), (6.7, 1), (7.45, .10), (7.8, .30), (20.5, .32),
                  (23.6, .30), (24.5, 0), (45.3, 0), (45.9, .5), (57, .55), (D, .6)])
    m.wind_bed([(0, .18), (6.9, .18), (7.5, 0), (7.9, .42), (20.4, .38),
                (23.8, .1), (24.6, 0), (45.4, 0), (45.9, .5), (D, .65)])
    m.rain_bed([(0, .3), (24.3, .3), (24.9, .10), (45.3, .10), (45.9, .32), (D, .36)])
    # cafe world: quiet room under the rain
    m.room_bed([(0, 0), (24.6, 0), (25.2, .6), (44.8, .6), (45.4, 0), (D, 0)])
    # held-breath near-silence around the glass face and the handle
    m.air_bed([(0, 0), (31.4, 0), (32.0, .55), (38.3, .55), (38.9, .12),
               (41.4, .12), (41.9, 0), (D, 0)])
    # low pressure drone (a sustained tone, not music): rises with the threat
    m.drone([(0, 0), (16.4, 0), (18.0, .30), (24.0, .26), (24.7, .10),
             (31.5, .22), (41.4, .30), (45.3, .34), (46.0, .26), (56.0, .3), (D, .36)])

    # ---- footsteps from the film's plant times ----------------------------
    for t in info["plants"].get("hero", []):        # street shoes (concrete)
        m.boots(t - .03, pan=.05, g=.34, surface="concrete")
    for t in info["plants"].get("heroC", []):       # cafe floor (wood)
        m.boots(t - .03, pan=.1, g=.30, surface="wood")
    for t in info["plants"].get("wman", []):        # the woman, until she isn't
        m.step(t - .03, pan=-.35, g=.17, surface="concrete")
    for t in info["plants"].get("str", []):
        m.step(t - .03, pan=.4, g=.15, surface="concrete")
    for key, pan in (("zA", -.3), ("zB", .15), ("zC", .4)):   # dragging shamble steps
        for t in info["plants"].get(key, []):
            m.sfx(f"footstep-concrete-00{int(t * 97) % 5}", t - .03, .55, 1300, .13, pan, .4)
    for t in info["plants"].get("zapp", []):        # creep up to the door
        m.sfx(f"footstep-wood-00{int(t * 97) % 5}", t - .03, .5, 1100, .1, .3, .35)

    # ---- picture events ----------------------------------------------------
    for e in info["events"]:
        t, k, pan = e["t"], e["k"], e.get("pan", 0.)
        if k == "vanish":                            # the moment everyone goes
            m.whoosh(t, 0, 1.15, .34)
            m.nb(t + .05, 90, 320, .8, .2, .5, .3)
        elif k == "drop":
            m.sfx("impactglass-light-001", t, .66, 2400, .26, -.25, .3)
        elif k == "drop2":
            m.sfx("impactglass-light-003", t, .7, 2600, .12, -.25, .25)
        elif k == "groan":
            moan(t, 112 + int(pan * 40), 1.7, .2, pan, .55)
        elif k == "latch":
            m.sfx("metallatch", t, .7, 3200, .3, .3, .3)
        elif k == "doorburst":
            m.sfx("dooropen-1", t, .7, 2600, .4, .3, .35)
            m.sfx("creak2", t + .2, .6, 1900, .2, .3, .45)
        elif k == "doorstop":
            m.door_stop(t, pan=.3)
        elif k == "doorclose":
            m.sfx("doorclose-1", t, .68, 2200, .42, .2, .4)
        elif k == "cloth1":
            m.cloth(t, pan=.1, g=.14)
        elif k == "cloth2":
            m.cloth(t, pan=-.1, g=.12)
        elif k == "knock":                           # a knock from outside the door
            m.sfx("impactsoft-heavy-002", t, .4, 420, .5, .2, .5)
            m.sfx("impactwood-medium-001", t + .18, .45, 900, .2, .2, .4)
        elif k == "moanNear":
            moan(t, 138, 2.2, .3, .2, .6, fall=.14, vib=3.6)
        elif k == "scratch":                         # something passes the window
            for i in range(4):
                m.nb(t + i * .34, 300, 1500, .22, .02, .16, .34 - i * .05, .35)
            m.cloth(t + .4, pan=.4, g=.16)
        elif k == "rattle":
            m.sfx("metallatch", t, .8, 3400, .24, .3, .3)
            m.sfx("impactwood-medium-001", t + .07, .7, 1400, .16, .3, .35)
        elif k == "creak":
            m.sfx("creak1", t, .5, 1700, .3, .25, .55)
            m.sfx("creak3", t + .7, .45, 1500, .18, .25, .5)
        elif k == "pull":
            m.sfx("creak2", t, .5, 1800, .26, .2, .5)
            m.sfx("impactwood-medium-002", t + .5, .6, 1200, .2, .2, .45)
        elif k == "moanGap":
            moan(t, 124, 1.3, .28, .1, .6)
        elif k == "chorus":
            chorus(t)
            m.crowd(t, t + 3.2, .08)

m.write("audio.wav")
