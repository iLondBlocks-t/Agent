#!/usr/bin/env python3
"""Unit and security contract tests for nrma Runtime, nrma-rdpctl, nrma-tailscalectl,
QEMU/Tailscale RDP session bootstrapper, and GitHub Actions workflows."""

import importlib.machinery
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import struct
import subprocess
import tempfile
import unittest
import zipfile

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
        cls.tailscalectl = load_script_module("nrma_tailscalectl_mod", "remote-desktop/nrma-tailscalectl")
        cls.rdp_session = load_script_module("rdp_qemu_session_mod", "scripts/rdp_qemu_session.py")
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

    def test_rdp_subnet_validation_blocks_public_and_unscoped_cgnat(self):
        valid = self.rdpctl.validate_subnets(
            ["192.168.1.0/24", "10.0.2.2/32"],
            allow_public_unsafe=False,
        )
        self.assertEqual(valid, ["192.168.1.0/24", "10.0.2.2/32"])

        with self.assertRaises(ValueError):
            self.rdpctl.validate_subnets(["0.0.0.0/0"], allow_public_unsafe=False)

        with self.assertRaises(ValueError):
            self.rdpctl.validate_subnets(["8.8.8.0/24"], allow_public_unsafe=False)

        # Shared CGNAT / Tailscale 100.64.0.0/10 must NOT be opened broadly on untrusted interfaces
        with self.assertRaises(ValueError) as ctx:
            self.rdpctl.validate_subnets(["100.64.0.0/10"], allow_public_unsafe=False)
        self.assertIn("--firewall-mode tailscale", str(ctx.exception))

    def test_rdp_tailscale_firewall_mode_scopes_to_tailscale0(self):
        ts_only = self.rdpctl.build_ufw_rule_commands(3389, ["192.168.1.0/24"], "tailscale")
        self.assertEqual(len(ts_only), 2)
        for cmd in ts_only:
            self.assertEqual(cmd[:4], ["allow", "in", "on", "tailscale0"])
            self.assertNotIn("192.168.1.0/24", cmd)
        self.assertIn("100.64.0.0/10", ts_only[0])
        self.assertIn("fd7a:115c:a1e0::/48", ts_only[1])

        both = self.rdpctl.build_ufw_rule_commands(3389, ["192.168.1.0/24"], "lan+tailscale")
        self.assertEqual(len(both), 3)
        self.assertIn("192.168.1.0/24", both[0])
        self.assertEqual(both[1][:4], ["allow", "in", "on", "tailscale0"])

        lan_qemu = self.rdpctl.build_ufw_rule_commands(3389, ["10.0.2.2/32"], "lan")
        self.assertEqual(len(lan_qemu), 1)
        self.assertIn("10.0.2.2/32", lan_qemu[0])

        with tempfile.TemporaryDirectory() as tmp:
            net_root = Path(tmp)
            self.assertFalse(self.rdpctl.tailscale_interface_info(net_root)["present"])
            (net_root / "tailscale0").mkdir()
            self.assertTrue(self.rdpctl.tailscale_interface_info(net_root)["present"])

    def test_native_tailscalectl_status_parsing(self):
        needs_login_raw = json.dumps(
            {
                "BackendState": "NeedsLogin",
                "AuthURL": "https://login.tailscale.com/a/1234567890abcdef",
                "Self": {"HostName": "nrmaos-laptop", "TailscaleIPs": []},
            }
        )
        st_login = self.tailscalectl.parse_tailscale_status_json(needs_login_raw)
        self.assertFalse(st_login["connected"])
        self.assertTrue(st_login["needs_login"])
        self.assertEqual(st_login["auth_url"], "https://login.tailscale.com/a/1234567890abcdef")
        self.assertEqual(st_login["device_name"], "nrmaos-laptop")

        running_raw = json.dumps(
            {
                "BackendState": "Running",
                "Version": "1.104.4",
                "CurrentTailnet": {"Name": "user@example.com", "MagicDNSEnabled": True},
                "Self": {
                    "HostName": "nrmaos-workstation",
                    "DNSName": "nrmaos-workstation.tail1234.ts.net.",
                    "TailscaleIPs": ["100.88.77.66", "fd7a:115c:a1e0::1234"],
                },
            }
        )
        st_run = self.tailscalectl.parse_tailscale_status_json(running_raw)
        self.assertTrue(st_run["connected"])
        self.assertFalse(st_run["needs_login"])
        self.assertEqual(st_run["tailnet_ip"], "100.88.77.66")
        self.assertEqual(st_run["magic_dns_name"], "nrmaos-workstation.tail1234.ts.net")

    def test_tailscale_serve_verification_blocks_funnel_and_tls_termination(self):
        good_serve = json.dumps(
            {
                "TCP": {
                    "3389": {
                        "TCPForward": "127.0.0.1:13389",
                    }
                }
            }
        )
        parsed = self.rdp_session.verify_tailscale_serve_config(
            good_serve,
            expected_target="127.0.0.1:13389",
            rdp_port=3389,
        )
        self.assertEqual(parsed["TCP"]["3389"]["TCPForward"], "127.0.0.1:13389")

        # Funnel enabled MUST raise BootstrapError
        funnel_bad = json.dumps(
            {
                "TCP": {"3389": {"TCPForward": "127.0.0.1:13389"}},
                "AllowFunnel": {"nrmaos-rdp-1.tail1234.ts.net:3389": True},
            }
        )
        with self.assertRaises(self.rdp_session.BootstrapError):
            self.rdp_session.verify_tailscale_serve_config(funnel_bad, "127.0.0.1:13389", 3389)

        # Terminating TLS at Serve instead of raw TCP forwarding MUST raise BootstrapError
        tls_term_bad = json.dumps(
            {
                "TCP": {"3389": {"TCPForward": "127.0.0.1:13389", "TerminateTLS": "nrmaos.ts.net"}},
            }
        )
        with self.assertRaises(self.rdp_session.BootstrapError):
            self.rdp_session.verify_tailscale_serve_config(tls_term_bad, "127.0.0.1:13389", 3389)

    def test_credential_privacy_and_age_roundtrip(self):
        # Public repo without recipient MUST fail closed
        with self.assertRaises(self.rdp_session.BootstrapError):
            self.rdp_session.validate_credential_delivery_config("public", "")

        # Malformed recipient MUST fail closed
        with self.assertRaises(self.rdp_session.BootstrapError):
            self.rdp_session.validate_credential_delivery_config("public", "not-an-age-key")

        # Private repo without recipient uses authenticated job summary with collaborator warning
        self.assertEqual(
            self.rdp_session.validate_credential_delivery_config("private", ""),
            "private-summary",
        )

        sample_pw = self.rdp_session.generate_strong_password(24)
        self.assertEqual(len(sample_pw), 24)

        sample_meta = {
            "os_name": "nrmaOS 0.1.0 (Atlas)",
            "device_name": "nrmaos-rdp-999",
            "tailscale_ipv4": "100.70.80.90",
            "magic_dns_name": "nrmaos-rdp-999.tailnet.ts.net",
            "rdp_address": "100.70.80.90:3389",
            "magic_dns_rdp_address": "nrmaos-rdp-999.tailnet.ts.net:3389",
            "rdp_port": 3389,
            "username": "nrma",
            "tls_fingerprint_sha256": "AA:BB:CC:DD",
            "expires_at_utc": "2026-11-24 23:00:00 UTC",
            "max_minutes": 330,
            "qemu_accel": "kvm",
            "cpus": 4,
            "memory_mib": 4096,
        }
        pub_summary = self.rdp_session.build_job_summary_markdown(
            sample_meta,
            delivery_mode="age",
            private_password=sample_pw,
            artifact_name="nrmaos-rdp-credentials-999",
        )
        self.assertNotIn(sample_pw, pub_summary)
        self.assertIn("100.70.80.90:3389", pub_summary)
        self.assertIn("ONLINE", pub_summary)

        priv_summary = self.rdp_session.build_job_summary_markdown(
            sample_meta,
            delivery_mode="private-summary",
            private_password=sample_pw,
        )
        self.assertIn("Security Warning", priv_summary)
        self.assertIn(sample_pw, priv_summary)

        # If `age` + `age-keygen` are installed locally, also run real cryptographic roundtrip + zip helper!
        age_bin = shutil.which("age")
        age_keygen = shutil.which("age-keygen")
        if age_bin and age_keygen:
            with tempfile.TemporaryDirectory() as tmp:
                tmp_dir = Path(tmp)
                key_file = tmp_dir / "key.txt"
                kg = subprocess.run([age_keygen, "-o", str(key_file)], capture_output=True, text=True, check=True)
                m = re.search(
                    r"(age1[0-9a-z]{58})",
                    kg.stdout + "\n" + kg.stderr + "\n" + key_file.read_text(encoding="utf-8"),
                )
                self.assertIsNotNone(m)
                pub_key = m.group(1)

                bundle = self.rdp_session.build_credential_bundle_text(sample_meta, sample_pw)
                armored = self.rdp_session.encrypt_with_age(bundle, pub_key)
                self.assertIn("-----BEGIN AGE ENCRYPTED FILE-----", armored)
                self.assertNotIn(sample_pw, armored)

                age_file = tmp_dir / "nrmaos-rdp-credentials.age.txt"
                age_file.write_text(armored, encoding="utf-8")
                zip_file = tmp_dir / "nrmaos-rdp-credentials-999.zip"
                with zipfile.ZipFile(zip_file, "w") as zf:
                    zf.write(age_file, arcname="nrmaos-rdp-credentials.age.txt")

                helper = ROOT / "scripts" / "decrypt-rdp-credentials.sh"
                dec_zip = subprocess.run(
                    [str(helper), str(zip_file), str(key_file)],
                    capture_output=True,
                    text=True,
                    check=True,
                )
                self.assertIn(f"RDP Password        : {sample_pw}", dec_zip.stdout)

    def test_nrmaos_rdp_workflow_contract(self):
        wf_path = ROOT / ".github" / "workflows" / "nrmaos-rdp.yml"
        self.assertTrue(wf_path.is_file())
        txt = wf_path.read_text(encoding="utf-8")

        self.assertIn("name: nrmaOS Remote Desktop", txt)
        self.assertIn("workflow_dispatch:", txt)
        self.assertNotIn("\n  push:", txt)
        self.assertNotIn("\n  pull_request:", txt)
        self.assertIn("runs-on: ubuntu-24.04", txt)
        self.assertIn("timeout-minutes: 360", txt)
        self.assertNotIn("timeout-minutes: 3600", txt)
        self.assertIn("tailscale/github-action@v4", txt)
        self.assertIn("nrmaos-rdp-${{ github.run_id }}", txt)
        self.assertIn("--host-port 13389", txt)
        self.assertNotIn("funnel", txt.lower())
        self.assertIn("if: always()", txt)

        try:
            import yaml  # type: ignore

            parsed = yaml.safe_load(txt)
            self.assertEqual(parsed["name"], "nrmaOS Remote Desktop")
            triggers = parsed.get("on") or parsed.get(True)
            self.assertEqual(list(triggers.keys()), ["workflow_dispatch"])
        except ImportError:
            pass

    def test_rdp_setup_hook_enforces_disabled_default_root_block_and_reconnect(self):
        hook = (ROOT / "remote-desktop" / "setup-rdp.sh").read_text(encoding="utf-8")
        self.assertIn("pam_succeed_if.so uid >= 1000", hook)
        self.assertIn("AllowRootLogin=false", hook)
        self.assertIn("KillDisconnected=false", hook)
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
