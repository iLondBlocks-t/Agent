#!/usr/bin/env bash
# Run a Blender (bpy) script with the loader stubs this sandbox needs.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export LD_LIBRARY_PATH="$ROOT/toolchain/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
exec python3 "$@"
