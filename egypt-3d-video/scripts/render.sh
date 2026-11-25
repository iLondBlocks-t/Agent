#!/usr/bin/env bash
# Renders the 3-second cinematic. Uses the bundled @sparticuz/chromium as the
# headless browser, with the vendored NSS libraries on the library path.
# The scene is rendered with a software 3D engine on Canvas 2D (no WebGL),
# so no GPU flags are needed.
set -euo pipefail
cd "$(dirname "$0")/.."

export LD_LIBRARY_PATH="$HOME/.local/lib/nss:${LD_LIBRARY_PATH:-}"

CHROME="$(node -e "require('@sparticuz/chromium').default.executablePath().then(p=>process.stdout.write(p))")"
echo "Using browser: $CHROME"

mkdir -p out
npx remotion render "$@" \
  egypt-cinematic \
  egypt-cinematic.mp4 \
  --browser-executable "$CHROME"
