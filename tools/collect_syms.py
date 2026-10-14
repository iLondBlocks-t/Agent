#!/usr/bin/env python3
"""Work out which undefined symbols in Blender's shared objects are not
provided by any library present on this system."""
import glob, os, subprocess, re, json, sys

BPY = "/usr/local/lib/python3.11/dist-packages/bpy"

def syms(path, defined):
    flag = "--defined-only" if defined else "--undefined-only"
    try:
        out = subprocess.run(["nm", "-D", flag, path], capture_output=True, text=True, timeout=120).stdout
    except Exception:
        return set()
    s = set()
    for line in out.splitlines():
        parts = line.split()
        if not parts:
            continue
        name = parts[-1].split("@")[0]
        if name and not name.startswith("__") or name.startswith("__"):
            if name in ("U", "w", "v", "T", "D", "B", "R", "W", "V", "i"):
                continue
            s.add(name)
    return s

bpy_sos = [p for p in glob.glob(f"{BPY}/**/*.so*", recursive=True)]
undef = set()
for p in bpy_sos:
    undef |= syms(p, False)
defined = set()
for p in bpy_sos:
    defined |= syms(p, True)
sys_libs = (glob.glob("/usr/lib/x86_64-linux-gnu/*.so*") + glob.glob("/usr/lib/python3.11/**/*.so*", recursive=True)
            + glob.glob("/usr/lib/x86_64-linux-gnu/**/*.so*", recursive=True))
for p in sys_libs:
    try:
        if os.path.islink(p) and not os.path.exists(p):
            continue
        defined |= syms(p, True)
    except Exception:
        pass
leftover = sorted(undef - defined)
print(json.dumps({"undef": len(undef), "defined": len(defined), "leftover": leftover}, ensure_ascii=False))
