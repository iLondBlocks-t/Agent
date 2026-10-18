#!/usr/bin/env python3
"""
automate.py -- an EXTERNAL automation client (the role xdotool would play if an
X server existed). It talks to harness.py over a unix socket and injects real
keyboard / mouse input into the running game process, then verifies the game
actually reacted by reading the game's own world/player state back.

Run-2 script: continuous movement + combat + mob spawning so the recorded video
is full of live motion.
"""

import json
import math
import os
import socket
import sys
import time

SOCK_PATH = "/tmp/mc-control.sock"
HERE = os.path.dirname(os.path.abspath(__file__))
STILL_DIR = os.path.join(HERE, "output", "stills")
LOG_PATH = os.path.join(HERE, "output", "automation.log")

os.makedirs(STILL_DIR, exist_ok=True)
LOG = open(LOG_PATH, "w", buffering=1)
START = time.time()
S = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)


def log(event, **kw):
    rec = {"t": round(time.time() - START, 2), "event": event, **kw}
    line = json.dumps(rec)
    print(line, flush=True)
    LOG.write(line + "\n")


def connect(timeout=90):
    end = time.time() + timeout
    while time.time() < end:
        try:
            S.connect(SOCK_PATH)
            return True
        except (FileNotFoundError, ConnectionRefusedError):
            time.sleep(0.25)
    raise RuntimeError("harness control socket never appeared")


def send(**msg):
    S.sendall((json.dumps(msg) + "\n").encode())
    buf = b""
    while b"\n" not in buf:
        chunk = S.recv(65536)
        if not chunk:
            raise RuntimeError("harness closed the control socket")
        buf += chunk
    return json.loads(buf.split(b"\n")[0].decode())


def state():
    return send(cmd="state")


def tap(name, ms=160):
    send(cmd="key", name=name, down=True)
    time.sleep(ms / 1000.0)
    send(cmd="key", name=name, down=False)
    time.sleep(0.06)


def hold(name, ms=1000):
    send(cmd="key", name=name, down=True)
    time.sleep(ms / 1000.0)
    send(cmd="key", name=name, down=False)


def combo(mod, name, ms=200):
    send(cmd="key", name=mod, down=True)
    time.sleep(0.05)
    tap(name, ms)
    send(cmd="key", name=mod, down=False)
    time.sleep(0.25)


def still(name):
    path = os.path.join(STILL_DIR, name)
    r = send(cmd="still", path=path)
    log("still_saved", path=os.path.basename(path), ok=r.get("ok"),
        size=os.path.getsize(path) if os.path.exists(path) else 0)


def wait_until(pred, what, timeout=120):
    end = time.time() + timeout
    while time.time() < end:
        st = state()
        if pred(st):
            log("wait_ok", what=what, menu=st.get("menu"), world_loaded=st.get("world_loaded"),
                player_pos=st.get("player_pos"), recorded_frames=st.get("recorded_frames"))
            return st
        time.sleep(0.3)
    raise TimeoutError(f"timed out waiting for {what}; last state={st}")


def main():
    connect()
    log("connected", socket=SOCK_PATH, ping=send(cmd="ping"))

    # ---- phase 1: menus ------------------------------------------------------
    wait_until(lambda s: s.get("menu") == "TitleMenu", "title menu")
    still("01-title-menu.png")
    tap("down", 250); time.sleep(0.3)
    tap("up", 250); time.sleep(0.3)
    still("02-menu-selection.png")
    tap("return", 200)
    wait_until(lambda s: s.get("menu") == "SeedMenu", "seed menu", timeout=20)
    still("03-seed-menu.png")

    SEED = "ARENA-2"
    send(cmd="text", text=SEED)
    time.sleep(0.8)
    still("04-seed-typed.png")
    log("seed_typed", seed=SEED)
    tap("return", 200)
    st = wait_until(lambda s: s.get("menu") is None and s.get("world_loaded"), "world generated")
    log("world_ready", seed=st.get("world_seed"), chunks=st.get("world_chunks"), player=st.get("player_pos"))
    still("05-world-spawn.png")

    # ---- phase 2: F3 live-debug overlay + spawn mobs -------------------------
    tap("f3", 200); time.sleep(0.5)
    log("debug_overlay", on=state().get("debug_overlay"))
    combo("lshift", "g")          # spawn mobs -> living, moving entities
    combo("lshift", "g")
    time.sleep(1.5)
    st = state()
    log("mobs_spawned", chunks=st.get("world_chunks"), pos=st.get("player_pos"))
    still("06-f3-and-mobs.png")

    # ---- phase 3: continuous movement + combat -------------------------------
    pos0 = state()["player_pos"]
    path = ["w", "d", "s", "a"]
    for lap in range(4):
        for k in path:
            hold(k, 1100)
            tap("c", 120)          # swing/attack while exploring
            time.sleep(0.15)
        log("lap_done", lap=lap + 1, pos=state()["player_pos"], ticks=state()["ticks"])
    pos1 = state()["player_pos"]
    log("movement_verified", pos_before=pos0, pos_after=pos1,
        tiles_moved=round(((pos1[0] - pos0[0]) ** 2 + (pos1[1] - pos0[1]) ** 2) ** 0.5, 2))
    still("07-after-exploring.png")

    # ---- phase 4: furniture + more combat ------------------------------------
    combo("lshift", "h")
    time.sleep(0.8)
    hp0 = state().get("player_health")
    for i in range(6):
        tap("c", 130)
        hold("d", 260)
        time.sleep(0.1)
    st = state()
    log("combat_done", health_before=hp0, health_after=st.get("player_health"),
        pos=st.get("player_pos"), chunks=st.get("world_chunks"))
    still("08-after-combat.png")

    # ---- phase 5: mouse automation -------------------------------------------
    m0 = state().get("mouse_pos")
    seen = set()
    for i in range(32):
        x = int(480 + 300 * math.cos(i / 32 * 2 * math.pi))
        y = int(270 + 170 * math.sin(i / 32 * 2 * math.pi))
        send(cmd="mouse_move", x=x, y=y)
        seen.add(tuple(state()["mouse_pos"]))
        time.sleep(0.03)
    send(cmd="mouse_button", button=1, down=True); time.sleep(0.08)
    send(cmd="mouse_button", button=1, down=False)
    log("mouse_verified", pos_before=m0, pos_after=state().get("mouse_pos"), distinct_positions=len(seen))
    still("09-mouse-demo.png")

    # ---- phase 6: final stroll, overlay off, clean ending --------------------
    hold("w", 1500)
    tap("c", 130); time.sleep(0.2)
    tap("f3", 200); time.sleep(0.5)
    hold("d", 1200)
    still("10-final-frame.png")
    fin = state()
    log("final_state", **fin)
    send(cmd="quit")
    log("quit_sent")
    S.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        log("AUTOMATION_ERROR", error=repr(exc))
        sys.exit(1)
