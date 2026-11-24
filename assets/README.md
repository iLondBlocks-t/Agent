# nrmaOS Visual Assets (`assets/`)

Original MIT-licensed brand artwork and deterministic build-time wallpaper generation:

- `icons/nrmaos-logo.svg` — Original vector nrmaOS emblem used by the login greeter, launcher, and `.desktop` entries.
- `generate_assets.py` — Zero-dependency Python PNG generator invoked during `scripts/stage-chroot.sh` to create five crisp 1920x1080 gradient wallpapers (`aurora-dark.png`, `atlas-twilight.png`, `sahara-dawn.png`, `ocean-glass.png`, `daylight-mist.png`) without storing binary image bloat in Git.
- `install-into-chroot.sh` — Installs wallpapers, icons, and the `nrmaOS-Login` LightDM GTK3 theme into the live root filesystem.
