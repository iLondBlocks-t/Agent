#!/usr/bin/env python3
"""Build stub shared libraries for the X11 / GPU / vendor libraries that
Blender's Python wheel links against but that this sandbox does not have
(no package-manager network access).

Offline CPU Cycles rendering never calls these entry points; the stubs only
have to satisfy the dynamic loader so that ``import bpy`` succeeds.
"""
import glob, json, os, re, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", "toolchain", "lib"))

# soname -> True if it needs the xkb versioned-symbol trick
SONAMES = [
    "libSM.so.6", "libICE.so.6", "libXrender.so.1", "libXfixes.so.3", "libXi.so.6",
    "libXt.so.6", "libxkbcommon.so.0", "libGL.so.1", "libGLX.so.0", "libOpenGL.so.0",
    "libEGL.so.1", "libze_loader.so.1", "libcuda.so.1", "libamdhip64.so.6",
    "libMaterialXRenderOsl.so.1", "libMaterialXRenderGlsl.so.1",
    "libMaterialXGenOsl.so.1", "libMaterialXGenMdl.so.1",
]

SKIP = {"__gmon_start__", "__morestack", "__cxa_finalize", "_ITM_deregisterTMCloneTable",
        "_ITM_registerTMCloneTable"}

def leftover_symbols():
    """undefined symbols of the bpy bundle that no library on this box provides"""
    json_path = "/tmp/syms.json"
    if not os.path.exists(json_path):
        subprocess.run(["python3", os.path.join(HERE, "collect_syms.py")],
                       stdout=open(json_path, "w"), check=True)
    data = json.load(open(json_path))
    out = []
    for s in data["leftover"]:
        if s in SKIP or s.startswith(("Py", "_Py")):
            continue                     # provided by the running interpreter
        if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", s):
            continue
        out.append(s)
    return sorted(set(out))

def main():
    syms = leftover_symbols()
    os.makedirs(OUT, exist_ok=True)
    src = os.path.join(OUT, "_arena_stubs.c")
    with open(src, "w") as fh:
        fh.write("/* auto-generated loader stubs - see tools/gen_xstubs.py */\n")
        for s in syms:
            fh.write(f"long {s}(void) {{ return 0; }}\n")
    print(f"{len(syms)} stub symbols")

    xkb_map = os.path.join(OUT, "_xkb.map")
    xkb_syms = [s for s in syms if s.startswith("xkb_")]
    with open(xkb_map, "w") as fh:
        fh.write("V_0.5.0 {\n  global:\n")
        for s in xkb_syms:
            fh.write(f"    {s};\n")
        fh.write("  local: *;\n};\n")

    for name in SONAMES:
        cmd = ["gcc", "-shared", "-fPIC", "-O0", "-w", "-o", os.path.join(OUT, name), src,
               f"-Wl,-soname,{name}"]
        if name.startswith("libxkbcommon"):
            cmd.append(f"-Wl,--version-script={xkb_map}")
        subprocess.run(cmd, check=True)
    print(f"{len(SONAMES)} stub libraries written to {OUT}")

if __name__ == "__main__":
    main()
