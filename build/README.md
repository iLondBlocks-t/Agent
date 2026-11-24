# Build configuration and artifacts

`build/` holds build profiles and metadata generated during ISO builds.

- `build/live-build.env` defines canonical image metadata (version, codename, volume ID).
- Generated ISO images, checksums, and build reports are ignored by Git and published through GitHub Actions workflow artifacts.
