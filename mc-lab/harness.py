#!/usr/bin/env python3
"""
harness.py -- run a real game process in this sandbox, record its live framebuffer
to MP4 with FFmpeg, and expose a control socket so a SEPARATE process can inject
keyboard/mouse input.

Why a harness instead of Xvfb + xdotool + a screen grabber:
  * This sandbox has no X server and none is installable (apt has no reachable
    mirror; no Xvfb/Xorg binary exists on PyPI, npm or in git sources; the pure-Java
    WeirdX server itself needs a host display to draw into).
  * So the display backend is SDL2's "dummy" video driver: the game renders into a
    real in-memory framebuffer through its normal, unmodified render path.
  * Input is injected into SDL2's real device state (SDL_GetKeyboardState array +
    SDL_WarpMouseInWindow + posted SDL events), i.e. the same layer where OS input
    would arrive. The game reads it through its own unmodified input code.
  * Frames are captured at present time by wrapping pygame.display.flip(), which is
    exactly the image the game hands to the display.

The game itself is never modified: it is imported and run as-is.
"""

import ctypes
import json
import os
import re
import socket
import subprocess
import sys
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
GAME_DIR = os.path.join(HERE, "src", "TheBigEye_minicraft-py")
OUT_DIR = os.path.join(HERE, "output")
STILL_DIR = os.path.join(OUT_DIR, "stills")
SOCK_PATH = "/tmp/mc-control.sock"
FFMPEG = os.path.join(HERE, "ffmpeg-bin", "ffmpeg")

WIDTH, HEIGHT, FPS = 960, 540, 32
VIDEO = sys.argv[1] if len(sys.argv) > 1 else os.path.join(OUT_DIR, "gameplay.mp4")

os.makedirs(STILL_DIR, exist_ok=True)
os.environ["SDL_VIDEODRIVER"] = "dummy"   # no X server available in this sandbox
os.environ["SDL_AUDIODRIVER"] = "dummy"   # no sound card either
os.environ["PYGAME_HIDE_SUPPORT_PROMPT"] = "1"

import pygame  # noqa: E402  (must come after the env vars above)

# ---------------------------------------------------------------- SDL internals
def load_sdl():
    """dlopen the SDL2 library already loaded by pygame -> same instance."""
    maps = open("/proc/self/maps").read()
    paths = sorted(set(re.findall(r"(/\S*libSDL2-2[^ ]*\.so[.\d]*)", maps)))
    if not paths:
        raise RuntimeError("SDL2 library not found in /proc/self/maps")
    sdl = ctypes.CDLL(paths[0])
    sdl.SDL_GetKeyboardState.restype = ctypes.POINTER(ctypes.c_uint8)
    return sdl, paths[0]


# USB-HID / SDL scancodes for the keys this game binds
SCANCODES = {
    "a": 4, "b": 5, "c": 6, "d": 7, "e": 8, "f": 9, "g": 10, "h": 11, "i": 12,
    "j": 13, "k": 14, "l": 15, "m": 16, "n": 17, "o": 18, "p": 19, "q": 20,
    "r": 21, "s": 22, "t": 23, "u": 24, "v": 25, "w": 26, "x": 27, "y": 28, "z": 29,
    "1": 30, "2": 31, "3": 32, "4": 33, "5": 34, "6": 35, "7": 36, "8": 37,
    "9": 38, "0": 39,
    "return": 40, "escape": 41, "backspace": 42, "tab": 43, "space": 44,
    "f1": 58, "f2": 59, "f3": 60, "f4": 61, "f5": 62, "f12": 69,
    "right": 79, "left": 80, "down": 81, "up": 82,
    "lctrl": 224, "lshift": 225, "lalt": 226,
}

SDL = None
KB = None           # pointer to SDL's real keyboard state array
INIT = None         # the running game's Initializer object
LOCK = threading.Lock()
FRAMES = 0
T0 = time.time()
FFPROC = None


def verify_scancodes():
    """Self-test: poking each scancode must show up in pygame.key.get_pressed()."""
    bad = []
    for name, sc in SCANCODES.items():
        kconst = getattr(pygame, "K_" + name, None)
        if kconst is None:
            continue
        KB[sc] = 1
        ok = bool(pygame.key.get_pressed()[kconst])
        KB[sc] = 0
        if not ok:
            bad.append(name)
    return bad


# ------------------------------------------------------------------- recording
def start_ffmpeg(path):
    cmd = [
        FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-stats",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{WIDTH}x{HEIGHT}",
        "-r", str(FPS), "-i", "-",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", path,
    ]
    log = open(os.path.join(OUT_DIR, "ffmpeg.log"), "wb")
    return subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=log), cmd


def capture_frame():
    """Grab the live display surface and feed it to FFmpeg."""
    global FRAMES
    if FFPROC is None or FFPROC.stdin.closed:
        return
    try:
        surf = pygame.display.get_surface()
        if surf is None:
            return
        raw = pygame.image.tostring(surf, "RGB")
        with LOCK:
            FFPROC.stdin.write(raw)
            FRAMES += 1
    except (BrokenPipeError, ValueError, OSError):
        pass


def install_capture_hook():
    """Wrap pygame.display.flip so every presented frame is recorded."""
    real_flip = pygame.display.flip
    real_update = pygame.display.update

    def flip_hook(*a, **kw):
        r = real_flip(*a, **kw)
        capture_frame()
        return r

    def update_hook(*a, **kw):
        r = real_update(*a, **kw)
        capture_frame()
        return r

    pygame.display.flip = flip_hook
    pygame.display.update = update_hook


# ---------------------------------------------------------------- input inject
def key_down(name):
    sc = SCANCODES[name]
    KB[sc] = 1
    kconst = getattr(pygame, "K_" + name, None)
    if kconst is not None:
        try:
            pygame.event.post(pygame.event.Event(pygame.KEYDOWN, key=kconst, scancode=sc, mod=0))
        except Exception:
            pass


def key_up(name):
    sc = SCANCODES[name]
    KB[sc] = 0
    kconst = getattr(pygame, "K_" + name, None)
    if kconst is not None:
        try:
            pygame.event.post(pygame.event.Event(pygame.KEYUP, key=kconst, scancode=sc, mod=0))
        except Exception:
            pass


def type_text(text):
    """Deliver text the way a keyboard/IME would: TEXTINPUT events."""
    for ch in text:
        pygame.event.post(pygame.event.Event(pygame.TEXTINPUT, text=ch))


def mouse_move(x, y):
    SDL.SDL_WarpMouseInWindow(None, int(x), int(y))   # real SDL mouse state
    old = pygame.mouse.get_pos()
    pygame.event.post(pygame.event.Event(
        pygame.MOUSEMOTION, pos=(int(x), int(y)),
        rel=(int(x) - old[0], int(y) - old[1]), buttons=(0, 0, 0)))


def mouse_button(button, down):
    et = pygame.MOUSEBUTTONDOWN if down else pygame.MOUSEBUTTONUP
    pygame.event.post(pygame.event.Event(et, pos=pygame.mouse.get_pos(), button=button))


# ------------------------------------------------------------------ game state
def game_state():
    st = {
        "recorded_frames": FRAMES,
        "capture_fps": round(FRAMES / max(time.time() - T0, 1e-6), 1),
        "elapsed_s": round(time.time() - T0, 1),
    }
    try:
        st["mouse_pos"] = list(pygame.mouse.get_pos())
    except Exception:
        st["mouse_pos"] = None
    try:
        g = INIT.game
        st["menu"] = type(g.menu).__name__ if g.menu is not None else None
        st["debug_overlay"] = bool(g.debug)
        st["world_loaded"] = bool(g.world.loaded)
        st["world_seed"] = str(g.world.seed)
        st["world_chunks"] = len(g.world.chunks)
        p = g.world.player
        st["player_pos"] = [round(float(p.position.x), 2), round(float(p.position.y), 2)]
        st["player_health"] = int(p.health)
        st["ticks"] = int(g.updater.ticks)
        st["game_time"] = int(g.game_time)
    except Exception as exc:  # noqa: BLE001
        st["state_error"] = repr(exc)
    return st


def save_still(path):
    surf = pygame.display.get_surface()
    if surf is not None:
        pygame.image.save(surf, path)
        return True
    return False


# ------------------------------------------------------------- control server
def handle(conn):
    buf = b""
    while True:
        try:
            data = conn.recv(65536)
        except OSError:
            return
        if not data:
            return
        buf += data
        while b"\n" in buf:
            line, buf = buf.split(b"\n", 1)
            if not line.strip():
                continue
            try:
                msg = json.loads(line.decode())
            except Exception as exc:  # noqa: BLE001
                conn.sendall((json.dumps({"error": repr(exc)}) + "\n").encode())
                continue
            resp = dispatch(msg)
            conn.sendall((json.dumps(resp) + "\n").encode())


def dispatch(msg):
    cmd = msg.get("cmd")
    try:
        if cmd == "key":
            (key_down if msg.get("down", True) else key_up)(msg["name"].lower())
            return {"ok": True, "cmd": cmd, "name": msg["name"], "down": msg.get("down", True)}
        if cmd == "text":
            type_text(msg["text"])
            return {"ok": True, "cmd": cmd, "chars": len(msg["text"])}
        if cmd == "mouse_move":
            mouse_move(msg["x"], msg["y"])
            return {"ok": True, "cmd": cmd, "mouse_pos": list(pygame.mouse.get_pos())}
        if cmd == "mouse_button":
            mouse_button(int(msg.get("button", 1)), bool(msg.get("down", True)))
            return {"ok": True, "cmd": cmd}
        if cmd == "state":
            return {"ok": True, **game_state()}
        if cmd == "still":
            p = msg.get("path") or os.path.join(STILL_DIR, f"still-{int(time.time())}.png")
            return {"ok": save_still(p), "path": p}
        if cmd == "ping":
            return {"ok": True, "pong": True}
        if cmd == "quit":
            threading.Thread(target=_shutdown, daemon=True).start()
            return {"ok": True, "cmd": "quit"}
        return {"ok": False, "error": f"unknown cmd {cmd!r}"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": repr(exc)}


def _shutdown():
    time.sleep(0.3)
    try:
        INIT.running = False
    except Exception:
        pass


def control_server():
    if os.path.exists(SOCK_PATH):
        os.unlink(SOCK_PATH)
    srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    srv.bind(SOCK_PATH)
    srv.listen(4)
    while True:
        try:
            conn, _ = srv.accept()
        except OSError:
            return
        threading.Thread(target=handle, args=(conn,), daemon=True).start()


# ----------------------------------------------------------------------- main
def main():
    global SDL, KB, INIT, FFPROC, T0

    pygame.init()
    pygame.display.set_mode((WIDTH, HEIGHT))
    SDL, libpath = load_sdl()
    KB = SDL.SDL_GetKeyboardState(None)
    bad = verify_scancodes()

    FFPROC, cmd = start_ffmpeg(VIDEO)
    install_capture_hook()
    T0 = time.time()

    threading.Thread(target=control_server, daemon=True).start()

    print(json.dumps({
        "event": "harness_ready",
        "sdl2_library": libpath,
        "video_driver": pygame.display.get_driver(),
        "audio_driver": pygame.mixer.get_init() is not None,
        "resolution": [WIDTH, HEIGHT],
        "target_fps": FPS,
        "ffmpeg": " ".join(cmd),
        "scancode_selftest": "ALL PASS" if not bad else f"FAILED for {bad}",
        "control_socket": SOCK_PATH,
        "game_dir": GAME_DIR,
    }), flush=True)

    os.chdir(GAME_DIR)
    sys.path.insert(0, GAME_DIR)
    from source.core.initializer import Initializer  # noqa: E402

    INIT = Initializer()
    INIT.initialize()
    print(json.dumps({"event": "game_initialized", "menu": type(INIT.game.menu).__name__}), flush=True)

    try:
        INIT.run()                     # <- the real, unmodified game loop
    except KeyboardInterrupt:
        pass
    finally:
        try:
            FFPROC.stdin.close()
            FFPROC.wait(timeout=30)
        except Exception:
            FFPROC.kill()
        print(json.dumps({"event": "game_exited", **game_state(), "video": VIDEO}), flush=True)


if __name__ == "__main__":
    main()
