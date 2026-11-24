#!/usr/bin/env python3
"""Static contract checks that do not require Qt development packages."""

from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ShellContractTests(unittest.TestCase):
    def test_launcher_is_fixed_allowlist_and_direct_process(self):
        source = (ROOT / "src" / "LauncherBridge.cpp").read_text(encoding="utf-8")
        self.assertIn('appId == QStringLiteral("terminal")', source)
        self.assertIn('program = QStringLiteral("xterm")', source)
        self.assertIn('appId == QStringLiteral("files")', source)
        self.assertIn('program = QStringLiteral("pcmanfm")', source)
        self.assertIn("QProcess::startDetached(program, QStringList{})", source)
        self.assertIn("appLaunchResult(appId, false)", source)
        self.assertNotIn("/bin/sh", source)
        self.assertNotIn("system(", source)
        self.assertNotIn("popen(", source)

    def test_qml_controls_call_launcher_and_toggle_theme(self):
        qml = (ROOT / "qml" / "Main.qml").read_text(encoding="utf-8")
        self.assertIn("visibility: Window.FullScreen", qml)
        self.assertIn('launcher.openApp("terminal")', qml)
        self.assertIn('launcher.openApp("files")', qml)
        self.assertIn("window.darkTheme = !window.darkTheme", qml)
        self.assertIn('objectName: "settingsButton"', qml)

    def test_installed_qml_location_is_explicit(self):
        cmake = (ROOT / "CMakeLists.txt").read_text(encoding="utf-8")
        self.assertIn('"/usr/lib/nrmaos"', cmake)
        self.assertIn('install(DIRECTORY qml/', cmake)
        self.assertIn("NRMAOS_INSTALL_QML_DIR", cmake)


if __name__ == "__main__":
    unittest.main()
