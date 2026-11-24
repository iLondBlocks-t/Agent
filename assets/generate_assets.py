#!/usr/bin/env python3
"""Deterministic, zero-dependency generator for nrmaOS default PNG wallpapers."""

from pathlib import Path
import struct
import sys
import zlib


WALLPAPER_THEMES = {
    "aurora-dark.png": ((13, 18, 30), (26, 45, 84), (42, 92, 138)),
    "atlas-twilight.png": ((18, 16, 34), (48, 38, 86), (92, 68, 138)),
    "sahara-dawn.png": ((28, 22, 32), (76, 48, 62), (168, 98, 76)),
    "ocean-glass.png": ((10, 24, 34), (18, 62, 82), (38, 122, 136)),
    "daylight-mist.png": ((214, 224, 240), (230, 237, 248), (186, 206, 238)),
}


def _png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)


def write_gradient_png(
    out_path: Path,
    c_top: tuple[int, int, int],
    c_mid: tuple[int, int, int],
    c_bot: tuple[int, int, int],
    width: int = 1920,
    height: int = 1080,
) -> None:
    # Precompute horizontal shimmer offset once (fast, crisp 1920px scanlines)
    x_shimmer = [int(14 * (i / max(1, width - 1))) for i in range(width)]
    compressor = zlib.compressobj(level=3)
    compressed_parts = []

    half = max(1, height // 2)
    for y in range(height):
        if y < half:
            t = y / half
            base_r = int(c_top[0] + (c_mid[0] - c_top[0]) * t)
            base_g = int(c_top[1] + (c_mid[1] - c_top[1]) * t)
            base_b = int(c_top[2] + (c_mid[2] - c_top[2]) * t)
        else:
            t = (y - half) / max(1, height - half - 1)
            base_r = int(c_mid[0] + (c_bot[0] - c_mid[0]) * t)
            base_g = int(c_mid[1] + (c_bot[1] - c_mid[1]) * t)
            base_b = int(c_mid[2] + (c_bot[2] - c_mid[2]) * t)

        # Filter byte 1 (Sub) makes horizontal smooth gradients compress tiny & fast
        row = bytearray(1 + width * 3)
        row[0] = 1
        prev_r = prev_g = prev_b = 0
        idx = 1
        for dx in x_shimmer:
            r = min(255, max(0, base_r + dx))
            g = min(255, max(0, base_g + (dx // 2)))
            b = min(255, max(0, base_b + dx))
            row[idx] = (r - prev_r) & 0xFF
            row[idx + 1] = (g - prev_g) & 0xFF
            row[idx + 2] = (b - prev_b) & 0xFF
            prev_r, prev_g, prev_b = r, g, b
            idx += 3
        chunk = compressor.compress(bytes(row))
        if chunk:
            compressed_parts.append(chunk)

    compressed_parts.append(compressor.flush())
    idat_data = b"".join(compressed_parts)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", ihdr)
        + _png_chunk(b"IDAT", idat_data)
        + _png_chunk(b"IEND", b"")
    )
    out_path.write_bytes(png)


def main() -> int:
    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("generated-wallpapers")
    out_dir.mkdir(parents=True, exist_ok=True)
    for filename, (c1, c2, c3) in WALLPAPER_THEMES.items():
        write_gradient_png(out_dir / filename, c1, c2, c3)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
