#!/usr/bin/env python3
"""Static contract checks for the nrmaOS Qt/QML desktop shell."""

from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ShellContractTests(unittest.TestCase):
    def test_launcher_uses_direct_process_without_shell_injection(self):
        source = (ROOT / "src" / "LauncherBridge.cpp").read_text(encoding="utf-8")
        self.assertIn('QStringLiteral("terminal")', source)
        self.assertIn('QStringLiteral("xterm")', source)
        self.assertIn('QStringLiteral("files")', source)
        self.assertIn('QStringLiteral("nrma-files")', source)
        self.assertIn("QProcess::startDetached(resolved, args)", source)
        self.assertIn("appLaunchResult(appId, false)", source)
        self.assertNotIn("/bin/sh", source)
        self.assertNotIn("system(", source)
        self.assertNotIn("popen(", source)

    def test_window_manager_implements_ewmh_desktop_dock_and_tiling(self):
        wm = (ROOT / "src" / "WindowManagerBridge.cpp").read_text(encoding="utf-8")
        self.assertIn("_NET_WM_WINDOW_TYPE_DESKTOP", wm)
        self.assertIn("_NET_WM_WINDOW_TYPE_DOCK", wm)
        self.assertIn("_NET_WM_STRUT_PARTIAL", wm)
        self.assertIn("_NET_CLIENT_LIST", wm)
        self.assertIn("_NET_ACTIVE_WINDOW", wm)
        self.assertIn("_NET_CLOSE_WINDOW", wm)

    def test_qml_surfaces_cover_all_desktop_components(self):
        qml = (ROOT / "qml" / "Main.qml").read_text(encoding="utf-8")
        self.assertIn('objectName: "nrmaosShellWindow"', qml)
        self.assertIn('title: "nrmaOS Top Bar"', qml)
        self.assertIn('title: "nrmaOS Dock"', qml)
        self.assertIn("LauncherView", qml)
        self.assertIn("ControlCenterView", qml)
        self.assertIn("NotificationDrawer", qml)
        self.assertIn("TaskSwitcherView", qml)
        self.assertIn("systemSettings.darkTheme = !systemSettings.darkTheme", qml)

    def test_installed_qml_location_is_explicit(self):
        cmake = (ROOT / "CMakeLists.txt").read_text(encoding="utf-8")
        self.assertIn('"/usr/lib/nrmaos"', cmake)
        self.assertIn("install(DIRECTORY qml/", cmake)
        self.assertIn("NRMAOS_INSTALL_QML_DIR", cmake)


if __name__ == "__main__":
    unittest.main()
