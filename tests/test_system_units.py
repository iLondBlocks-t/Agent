#!/usr/bin/env python3
"""Unit tests for nrma Runtime, nrma-rdpctl security controls, and asset generation."""

import importlib.machinery
import importlib.util
import os
from pathlib import Path
import struct
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def load_script_module(name: str, rel_path: str):
    full_path = str(ROOT / rel_path)
    loader = importlib.machinery.SourceFileLoader(name, full_path)
    spec = importlib.util.spec_from_loader(name, loader)
    mod = importlib.util.module_from_spec(spec)
    loader.exec_module(mod)
    return mod


class RuntimeAndRdpUnitTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runtime = load_script_module("nrma_runtime_mod", "runtime/nrma-runtime")
        cls.rdpctl = load_script_module("nrma_rdpctl_mod", "remote-desktop/nrma-rdpctl")
        cls.assets = load_script_module("nrma_assets_mod", "assets/generate_assets.py")

    def test_pe64_gui_and_driver_inspection(self):
        with tempfile.TemporaryDirectory() as tmp:
            exe64 = Path(tmp) / "App64.exe"
            dos = bytearray(128)
            dos[0:2] = b"MZ"
            struct.pack_into("<I", dos, 0x3C, 128)
            pe = b"PE\x00\x00" + struct.pack("<HHIIIHH", 0x8664, 1, 0, 0, 0, 240, 0x0022)
            opt = bytearray(240)
            struct.pack_into("<H", opt, 0, 0x020B)
            struct.pack_into("<H", opt, 68, 2)  # Windows GUI
            exe64.write_bytes(bytes(dos + pe + opt))

            info = self.runtime.inspect_pe_executable(exe64)
            self.assertTrue(info["valid_pe"])
            self.assertEqual(info["architecture"], "x86_64")
            self.assertEqual(info["pe_format"], "PE32+ (64-bit)")
            self.assertEqual(info["subsystem"], "Windows GUI")
            self.assertEqual(info["compatibility_tier"], "candidate")

            # Kernel driver (Subsystem=1) must be flagged unsupported
            drv = Path(tmp) / "AntiCheat.sys.exe"
            struct.pack_into("<H", opt, 68, 1)
            drv.write_bytes(bytes(dos + pe + opt))
            drv_info = self.runtime.inspect_pe_executable(drv)
            self.assertEqual(drv_info["compatibility_tier"], "unsupported-driver")

    def test_isolated_prefix_and_shortcut_creation(self):
        with tempfile.TemporaryDirectory() as tmp:
            old_xdg = os.environ.get("XDG_DATA_HOME")
            os.environ["XDG_DATA_HOME"] = tmp
            try:
                meta = self.runtime.create_prefix("Photo Suite", "win64")
                self.assertEqual(meta["name"], "photo-suite")
                self.assertTrue((Path(meta["path"]) / "drive_c").is_dir())

                prefixes = self.runtime.list_prefixes_data()
                self.assertEqual(len(prefixes), 1)

                dummy_exe = Path(tmp) / "PhotoApp.exe"
                dummy_exe.write_bytes(b"MZ" + b"\x00" * 128)
                sc_path = self.runtime.create_shortcut(dummy_exe, "Photo App", "photo-suite")
                self.assertTrue(sc_path.is_file())
                desktop_txt = sc_path.read_text(encoding="utf-8")
                self.assertIn("Name=Photo App", desktop_txt)
                self.assertIn("--prefix photo-suite", desktop_txt)

                self.assertTrue(self.runtime.remove_prefix("photo-suite"))
                self.assertEqual(len(self.runtime.list_prefixes_data()), 0)
            finally:
                if old_xdg is None:
                    os.environ.pop("XDG_DATA_HOME", None)
                else:
                    os.environ["XDG_DATA_HOME"] = old_xdg

    def test_rdp_subnet_validation_blocks_public_exposure_by_default(self):
        valid = self.rdpctl.validate_subnets(["192.168.1.0/24", "10.0.0.0/8"], allow_public_unsafe=False)
        self.assertEqual(valid, ["192.168.1.0/24", "10.0.0.0/8"])

        with self.assertRaises(ValueError):
            self.rdpctl.validate_subnets(["0.0.0.0/0"], allow_public_unsafe=False)

        with self.assertRaises(ValueError):
            self.rdpctl.validate_subnets(["8.8.8.0/24"], allow_public_unsafe=False)

    def test_rdp_setup_hook_enforces_disabled_default_and_root_block(self):
        hook = (ROOT / "remote-desktop" / "setup-rdp.sh").read_text(encoding="utf-8")
        self.assertIn("pam_succeed_if.so uid >= 1000", hook)
        self.assertIn("AllowRootLogin=false", hook)
        self.assertIn("ssl_protocols=TLSv1.2, TLSv1.3", hook)
        self.assertIn("systemctl disable xrdp.service xrdp-sesman.service", hook)
        self.assertIn("rm -f /etc/xrdp/key.pem", hook)

        startwm = (ROOT / "remote-desktop" / "startwm.sh").read_text(encoding="utf-8")
        self.assertIn("exec /usr/bin/nrmaos-session", startwm)
        self.assertIn("export XRDP_SESSION=1", startwm)

    def test_wallpaper_png_generator_outputs_valid_hd_png(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "sample.png"
            self.assets.write_gradient_png(out, (12, 18, 30), (24, 46, 82), (40, 90, 130), width=320, height=180)
            raw = out.read_bytes()
            self.assertEqual(raw[:8], b"\x89PNG\r\n\x1a\n")
            w, h = struct.unpack(">II", raw[16:24])
            self.assertEqual((w, h), (320, 180))


if __name__ == "__main__":
    unittest.main()
