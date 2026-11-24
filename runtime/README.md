# nrma Runtime (`runtime/`)

Optional Windows `.exe` / `.msi` compatibility layer and prefix manager for nrmaOS:

- `nrma-runtime` — CLI and backend engine providing:
  - PE32/PE32+ binary header analysis (`nrma-runtime inspect <file.exe> [--json]`) detecting CPU architecture (`x86`, `x86_64`, `ARM64`), Windows GUI vs Console vs Kernel Driver subsystem, and `.NET CLR` metadata without requiring Wine to be installed first.
  - Isolated per-application Wine prefixes (`~/.local/share/nrma-runtime/prefixes/<name>`).
  - App Launcher `.desktop` shortcut generation (`nrma-runtime create-shortcut`).
  - Opt-in Wine engine installation (`nrma-runtime install-engine`) from Debian repositories so the base ISO remains small.
- `nrma-runtime-mime.xml`, `nrma-runtime.desktop`, and `nrma-runtime-action.desktop` — XDG MIME registrations and right-click context actions associating `.exe` and `.msi` files with **nrma Runtime**.
