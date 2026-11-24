#!/bin/sh
# Decrypts an `age`-encrypted nrmaOS Remote Desktop credential bundle locally.
# Accepts either a GitHub Actions `.zip` artifact archive or a `.age` / `.age.txt` file,
# printing the decrypted credentials directly to the terminal without writing plaintext to disk.
set -eu

usage() {
    cat >&2 <<'EOF'
Usage:
  ./scripts/decrypt-rdp-credentials.sh <artifact.zip | credentials.age.txt> [private-key-file]

Arguments:
  <artifact.zip | credentials.age.txt>  Downloaded GitHub Actions artifact zip or .age file
  [private-key-file]                    Path to your local age private key (default: ~/nrmaos-rdp-key.txt
                                        or $NRMAOS_AGE_IDENTITY)
EOF
    exit 2
}

[ $# -ge 1 ] || usage

INPUT_PATH="$1"
KEY_PATH="${2:-${NRMAOS_AGE_IDENTITY:-$HOME/nrmaos-rdp-key.txt}}"

if ! command -v age >/dev/null 2>&1; then
    echo "Error: 'age' is not installed locally." >&2
    echo "Install it first (e.g. 'sudo apt install age', 'brew install age', 'winget install FiloSottile.age', or 'pkg install age' in Termux)." >&2
    exit 1
fi

if [ ! -f "$INPUT_PATH" ]; then
    echo "Error: input file not found: $INPUT_PATH" >&2
    exit 1
fi

if [ ! -f "$KEY_PATH" ]; then
    echo "Error: private key file not found: $KEY_PATH" >&2
    echo "Pass your local key path as the second argument or set NRMAOS_AGE_IDENTITY." >&2
    exit 1
fi

case "$INPUT_PATH" in
    *.zip)
        if command -v unzip >/dev/null 2>&1; then
            unzip -p "$INPUT_PATH" '*.age*' | age --decrypt --identity "$KEY_PATH"
        elif command -v python3 >/dev/null 2>&1; then
            python3 - "$INPUT_PATH" <<'PY' | age --decrypt --identity "$KEY_PATH"
import sys, zipfile
with zipfile.ZipFile(sys.argv[1], "r") as zf:
    names = [n for n in zf.namelist() if ".age" in n]
    if not names:
        raise SystemExit("No .age file found inside zip archive.")
    sys.stdout.buffer.write(zf.read(names[0]))
PY
        else
            echo "Error: neither 'unzip' nor 'python3' is available to extract $INPUT_PATH" >&2
            exit 1
        fi
        ;;
    *)
        age --decrypt --identity "$KEY_PATH" "$INPUT_PATH"
        ;;
esac
