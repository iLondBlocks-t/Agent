import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    id: win
    visible: true
    width: 980
    height: 640
    minimumWidth: 760
    minimumHeight: 480
    title: "nrma Settings"
    color: dark ? "#0f1626" : "#f2f6fc"

    property bool dark: settings.darkTheme
    property color sideBg: dark ? "#161f33" : "#ffffff"
    property color cardBg: dark ? "#1c2740" : "#ffffff"
    property color subtleBg: dark ? "#243252" : "#e8effa"
    property color textMain: dark ? "#f3f6fc" : "#151e30"
    property color textMuted: dark ? "#93a2bd" : "#5e6d87"
    property color accent: settings.accentColor || "#5e8bff"

    property string currentPage: settings.initialPage || "appearance"

    Connections {
        target: settings
        function onInitialPageChanged() {
            win.currentPage = settings.initialPage
        }
    }

    RowLayout {
        anchors.fill: parent
        spacing: 0

        // Left Navigation Sidebar
        Rectangle {
            Layout.preferredWidth: 230
            Layout.fillHeight: true
            color: win.sideBg

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 16
                spacing: 6

                RowLayout {
                    spacing: 10
                    Layout.bottomMargin: 10
                    Rectangle {
                        width: 30; height: 30; radius: 9
                        color: win.accent
                        Text { anchors.centerIn: parent; text: "n"; color: "#ffffff"; font.bold: true; font.pixelSize: 16 }
                    }
                    Text {
                        text: "nrma Settings"
                        color: win.textMain
                        font.pixelSize: 16
                        font.bold: true
                    }
                }

                Repeater {
                    model: [
                        { id: "appearance", label: "Appearance", glyph: "◐" },
                        { id: "wallpaper", label: "Wallpaper Manager", glyph: "▣" },
                        { id: "display", label: "Display & Windows", glyph: "◧" },
                        { id: "remote-desktop", label: "Remote Desktop", glyph: "⇄" },
                        { id: "runtime", label: "nrma Runtime (EXE)", glyph: "⊞" },
                        { id: "about", label: "About nrmaOS", glyph: "ⓘ" }
                    ]
                    delegate: Rectangle {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 38
                        radius: 10
                        color: win.currentPage === modelData.id
                            ? win.accent
                            : (navMouse.containsMouse ? win.subtleBg : "transparent")

                        RowLayout {
                            anchors.fill: parent
                            anchors.leftMargin: 12
                            anchors.rightMargin: 12
                            spacing: 10
                            Text {
                                text: modelData.glyph
                                color: win.currentPage === modelData.id ? "#ffffff" : win.accent
                                font.pixelSize: 14
                                font.bold: true
                            }
                            Text {
                                Layout.fillWidth: true
                                text: modelData.label
                                color: win.currentPage === modelData.id ? "#ffffff" : win.textMain
                                font.pixelSize: 13
                                font.bold: win.currentPage === modelData.id
                            }
                        }

                        MouseArea {
                            id: navMouse
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: {
                                win.currentPage = modelData.id
                                if (modelData.id === "remote-desktop") settings.refreshRdpStatus()
                                else if (modelData.id === "runtime") settings.refreshRuntimeStatus()
                                else if (modelData.id === "display") settings.refreshDisplayModes()
                            }
                        }
                    }
                }

                Item { Layout.fillHeight: true }

                Button {
                    Layout.fillWidth: true
                    text: "↻ Refresh Status"
                    onClicked: settings.refreshAll()
                }
            }
        }

        // Right Content Scroll Pane
        ScrollView {
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true

            ColumnLayout {
                width: Math.max(520, win.width - 270)
                spacing: 16

                Item { height: 6 }

                // ============================================================
                // PAGE 1: APPEARANCE
                // ============================================================
                ColumnLayout {
                    visible: win.currentPage === "appearance"
                    Layout.fillWidth: true
                    Layout.leftMargin: 24
                    Layout.rightMargin: 24
                    spacing: 14

                    Text { text: "Appearance"; color: win.textMain; font.pixelSize: 22; font.bold: true }
                    Text { text: "Personalize nrmaOS theme, accent palette, motion, and dock sizing."; color: win.textMuted; font.pixelSize: 13 }

                    Rectangle {
                        Layout.fillWidth: true; radius: 14; color: win.cardBg
                        implicitHeight: themeCol.implicitHeight + 28
                        ColumnLayout {
                            id: themeCol
                            anchors.fill: parent; anchors.margins: 14; spacing: 12

                            RowLayout {
                                Layout.fillWidth: true
                                Text { text: "Color Theme"; color: win.textMain; font.pixelSize: 14; font.bold: true }
                                Item { Layout.fillWidth: true }
                                Button {
                                    text: "☾ Dark"
                                    highlighted: settings.darkTheme
                                    onClicked: settings.darkTheme = true
                                }
                                Button {
                                    text: "☀ Light"
                                    highlighted: !settings.darkTheme
                                    onClicked: settings.darkTheme = false
                                }
                            }

                            RowLayout {
                                Layout.fillWidth: true
                                Text { text: "Accent Color"; color: win.textMain; font.pixelSize: 14; font.bold: true }
                                Item { Layout.fillWidth: true }
                                Repeater {
                                    model: ["#5e8bff", "#22c55e", "#f59e0b", "#a855f7", "#f43f5e"]
                                    delegate: Rectangle {
                                        width: 28; height: 28; radius: 14
                                        color: modelData
                                        border.width: settings.accentColor === modelData ? 3 : 0
                                        border.color: "#ffffff"
                                        MouseArea {
                                            anchors.fill: parent
                                            cursorShape: Qt.PointingHandCursor
                                            onClicked: settings.accentColor = modelData
                                        }
                                    }
                                }
                            }

                            RowLayout {
                                Layout.fillWidth: true
                                Text { text: "Dock Icon Size (" + settings.dockIconSize + " px)"; color: win.textMain; font.pixelSize: 14 }
                                Item { Layout.fillWidth: true }
                                Slider {
                                    from: 38; to: 64; stepSize: 2
                                    value: settings.dockIconSize
                                    onMoved: settings.dockIconSize = Math.round(value)
                                }
                            }

                            CheckBox {
                                text: "Reduce desktop animation motion (recommended for remote RDP or low-power VMs)"
                                checked: settings.reducedMotion
                                onToggled: settings.reducedMotion = checked
                            }
                        }
                    }
                }

                // ============================================================
                // PAGE 2: WALLPAPER MANAGER
                // ============================================================
                ColumnLayout {
                    visible: win.currentPage === "wallpaper"
                    Layout.fillWidth: true
                    Layout.leftMargin: 24
                    Layout.rightMargin: 24
                    spacing: 14

                    Text { text: "nrma Wallpaper Manager"; color: win.textMain; font.pixelSize: 22; font.bold: true }
                    Text { text: "Select an original nrmaOS background or specify a custom image file."; color: win.textMuted; font.pixelSize: 13 }

                    Flow {
                        Layout.fillWidth: true
                        spacing: 12
                        Repeater {
                            model: settings.wallpapers
                            delegate: Rectangle {
                                width: 210
                                height: 142
                                radius: 14
                                color: win.cardBg
                                border.width: settings.wallpaperPath === modelData.path ? 3 : 1
                                border.color: settings.wallpaperPath === modelData.path ? win.accent : win.subtleBg

                                ColumnLayout {
                                    anchors.fill: parent
                                    anchors.margins: 8
                                    spacing: 6
                                    Image {
                                        Layout.fillWidth: true
                                        Layout.fillHeight: true
                                        source: "file://" + modelData.path
                                        fillMode: Image.PreserveAspectCrop
                                        asynchronous: true
                                    }
                                    Text {
                                        Layout.fillWidth: true
                                        text: modelData.name
                                        color: win.textMain
                                        font.pixelSize: 12
                                        font.bold: true
                                        elide: Text.ElideRight
                                    }
                                }

                                MouseArea {
                                    anchors.fill: parent
                                    cursorShape: Qt.PointingHandCursor
                                    onClicked: settings.wallpaperPath = modelData.path
                                }
                            }
                        }
                    }

                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 8
                        TextField {
                            id: customWallField
                            Layout.fillWidth: true
                            text: settings.wallpaperPath
                            placeholderText: "/path/to/custom-wallpaper.png"
                        }
                        Button {
                            text: "Apply Path"
                            onClicked: settings.wallpaperPath = customWallField.text
                        }
                    }
                }

                // ============================================================
                // PAGE 3: DISPLAY & WINDOWS
                // ============================================================
                ColumnLayout {
                    visible: win.currentPage === "display"
                    Layout.fillWidth: true
                    Layout.leftMargin: 24
                    Layout.rightMargin: 24
                    spacing: 14

                    Text { text: "Display & Window Management"; color: win.textMain; font.pixelSize: 22; font.bold: true }
                    Text { text: "Configure active Xorg output resolution and review nrmaOS window management controls."; color: win.textMuted; font.pixelSize: 13 }

                    Rectangle {
                        Layout.fillWidth: true; radius: 14; color: win.cardBg
                        implicitHeight: dispCol.implicitHeight + 28
                        ColumnLayout {
                            id: dispCol
                            anchors.fill: parent; anchors.margins: 14; spacing: 10
                            Text { text: "Current Resolution: " + (settings.currentResolution || "Automatic"); color: win.textMain; font.pixelSize: 14; font.bold: true }
                            Flow {
                                Layout.fillWidth: true
                                spacing: 8
                                Repeater {
                                    model: settings.availableResolutions
                                    delegate: Button {
                                        text: modelData
                                        highlighted: modelData === settings.currentResolution
                                        onClicked: settings.setDisplayResolution(modelData)
                                    }
                                }
                            }
                            Text {
                                Layout.fillWidth: true
                                wrapMode: Text.WordWrap
                                text: "Shortcuts: Ctrl+Space or Super opens nrma App Launcher • Alt+Tab cycles windows • Top Bar buttons (◧ ◨ ⬜) snap any focused window Left, Right, or Maximized between Top Bar and Dock."
                                color: win.textMuted
                                font.pixelSize: 12
                            }
                        }
                    }
                }

                // ============================================================
                // PAGE 4: SETTINGS > REMOTE DESKTOP (xrdp + xorgxrdp)
                // ============================================================
                ColumnLayout {
                    visible: win.currentPage === "remote-desktop"
                    Layout.fillWidth: true
                    Layout.leftMargin: 24
                    Layout.rightMargin: 24
                    spacing: 14

                    RowLayout {
                        Layout.fillWidth: true
                        ColumnLayout {
                            spacing: 2
                            Text { text: "Remote Desktop (RDP)"; color: win.textMain; font.pixelSize: 22; font.bold: true }
                            Text {
                                text: "Connect from Windows Remote Desktop or Android RDP clients into an isolated nrmaOS Xorg session."
                                color: win.textMuted; font.pixelSize: 12
                            }
                        }
                        Item { Layout.fillWidth: true }
                        Rectangle {
                            height: 28
                            width: statusLbl.implicitWidth + 20
                            radius: 14
                            color: settings.rdpStatus.active ? "#1e7e5c" : "#374151"
                            Text {
                                id: statusLbl
                                anchors.centerIn: parent
                                text: settings.rdpStatus.active ? "● Server Running" : "○ Disabled (Default)"
                                color: "#ffffff"
                                font.pixelSize: 12
                                font.bold: true
                            }
                        }
                    }

                    // Server Control + Port + Subnet + Resolution Card
                    Rectangle {
                        Layout.fillWidth: true; radius: 14; color: win.cardBg
                        implicitHeight: rdpMainCol.implicitHeight + 28
                        ColumnLayout {
                            id: rdpMainCol
                            anchors.fill: parent; anchors.margins: 14; spacing: 10

                            RowLayout {
                                Layout.fillWidth: true
                                Text {
                                    text: "Endpoint: " + (settings.rdpStatus.connection_endpoint || "Offline")
                                    color: win.textMain; font.pixelSize: 15; font.bold: true
                                }
                                Button {
                                    text: "Copy Address"
                                    onClicked: settings.copyToClipboard(settings.rdpStatus.connection_endpoint || "")
                                }
                                Item { Layout.fillWidth: true }
                                Button {
                                    text: settings.rdpStatus.active ? "Disable Remote Desktop" : "Enable Remote Desktop"
                                    onClicked: settings.setRdpEnabled(
                                        !settings.rdpStatus.active,
                                        parseInt(rdpPortField.text) || 3389,
                                        rdpSubnetsField.text,
                                        rdpResBox.currentText
                                    )
                                }
                            }

                            GridLayout {
                                Layout.fillWidth: true
                                columns: 2
                                columnSpacing: 12
                                rowSpacing: 8

                                Text { text: "Listening TCP Port:"; color: win.textMain; font.pixelSize: 13 }
                                RowLayout {
                                    TextField {
                                        id: rdpPortField
                                        text: String(settings.rdpStatus.port || 3389)
                                        Layout.preferredWidth: 110
                                    }
                                    Button {
                                        text: "Update Port"
                                        onClicked: settings.setRdpPort(parseInt(rdpPortField.text) || 3389)
                                    }
                                }

                                Text { text: "Trusted Firewall Subnets:"; color: win.textMain; font.pixelSize: 13 }
                                TextField {
                                    id: rdpSubnetsField
                                    Layout.fillWidth: true
                                    text: (settings.rdpStatus.allowed_subnets || ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]).join(", ")
                                }

                                Text { text: "Session Resolution:"; color: win.textMain; font.pixelSize: 13 }
                                ComboBox {
                                    id: rdpResBox
                                    model: ["dynamic", "1920x1080", "1600x900", "1366x768", "1280x720"]
                                    onActivated: settings.setRdpResolution(currentText)
                                }
                            }
                        }
                    }

                    // Security Status Checklist Card
                    Rectangle {
                        Layout.fillWidth: true; radius: 14; color: win.cardBg
                        implicitHeight: secCol.implicitHeight + 24
                        ColumnLayout {
                            id: secCol
                            anchors.fill: parent; anchors.margins: 12; spacing: 6
                            Text { text: "Security Status"; color: win.textMain; font.pixelSize: 14; font.bold: true }
                            Text {
                                text: (settings.rdpStatus.root_login_blocked ? "✓" : "⚠") + " Root & system accounts (UID < 1000) blocked via PAM + sesman.ini"
                                color: settings.rdpStatus.root_login_blocked ? "#34d399" : "#f87171"; font.pixelSize: 12
                            }
                            Text {
                                text: (settings.rdpStatus.firewall_active ? "✓" : "○") + " UFW Firewall active (incoming restricted to trusted local subnets)"
                                color: settings.rdpStatus.firewall_active ? "#34d399" : win.textMuted; font.pixelSize: 12
                            }
                            Text {
                                text: (settings.rdpStatus.tls_configured ? "✓ TLSv1.2/TLSv1.3 Active — SHA256: " + settings.rdpStatus.tls_fingerprint_sha256 : "○ Per-machine TLS certificate will be generated upon enabling RDP")
                                color: settings.rdpStatus.tls_configured ? "#34d399" : win.textMuted; font.pixelSize: 11
                                elide: Text.ElideRight; Layout.fillWidth: true
                            }
                        }
                    }

                    // User Access & Password Provisioning Card
                    Rectangle {
                        Layout.fillWidth: true; radius: 14; color: win.cardBg
                        implicitHeight: userCol.implicitHeight + 24
                        ColumnLayout {
                            id: userCol
                            anchors.fill: parent; anchors.margins: 12; spacing: 8
                            Text { text: "Authorized Local Accounts (Never Stored in Plaintext)"; color: win.textMain; font.pixelSize: 14; font.bold: true }

                            Repeater {
                                model: settings.rdpStatus.eligible_users || []
                                delegate: RowLayout {
                                    Layout.fillWidth: true
                                    spacing: 8
                                    property bool isAuth: (settings.rdpStatus.authorized_users || []).indexOf(modelData) >= 0

                                    Text {
                                        text: modelData + (isAuth ? "  (Authorized)" : "  (Not authorized)")
                                        color: isAuth ? "#34d399" : win.textMain
                                        font.pixelSize: 13
                                        font.bold: true
                                    }
                                    Button {
                                        text: parent.isAuth ? "Revoke" : "Authorize"
                                        onClicked: settings.setRdpUserAccess(modelData, !parent.isAuth)
                                    }
                                    TextField {
                                        id: pwInput
                                        Layout.preferredWidth: 180
                                        placeholderText: "New password (8+ chars)"
                                        echoMode: TextInput.Password
                                    }
                                    Button {
                                        text: "Set Password"
                                        onClicked: {
                                            if (settings.setRdpUserPassword(modelData, pwInput.text)) {
                                                pwInput.text = ""
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Connected Sessions & Connection Instructions Card
                    Rectangle {
                        Layout.fillWidth: true; radius: 14; color: win.cardBg
                        implicitHeight: connCol.implicitHeight + 24
                        ColumnLayout {
                            id: connCol
                            anchors.fill: parent; anchors.margins: 12; spacing: 6
                            Text {
                                text: "Connected Remote Sessions: " + ((settings.rdpStatus.connected_sessions || []).length)
                                color: win.textMain; font.pixelSize: 14; font.bold: true
                            }
                            Repeater {
                                model: settings.rdpStatus.connected_sessions || []
                                delegate: Text {
                                    text: "• User '" + modelData.user + "' on " + modelData.display + " (PID " + modelData.pid + ", " + modelData.backend + ")"
                                    color: "#34d399"; font.pixelSize: 12
                                }
                            }
                            Text {
                                Layout.topMargin: 6
                                text: "How to Connect:\n• Windows: Open Remote Desktop Connection (mstsc.exe) → Computer: " + (settings.rdpStatus.connection_endpoint || "<ip>:3389") + "\n• Android: Install Microsoft Remote Desktop (Windows App) or aFreeRDP → Add PC: " + (settings.rdpStatus.connection_endpoint || "<ip>:3389") + "\n• Outside LAN: Never expose port 3389 directly on a router. Connect over WireGuard, Tailscale, or an SSH tunnel."
                                color: win.textMuted; font.pixelSize: 12; wrapMode: Text.WordWrap; Layout.fillWidth: true
                            }
                        }
                    }
                }

                // ============================================================
                // PAGE 5: nrma RUNTIME (OPTIONAL WINE & EXE COMPATIBILITY)
                // ============================================================
                ColumnLayout {
                    visible: win.currentPage === "runtime"
                    Layout.fillWidth: true
                    Layout.leftMargin: 24
                    Layout.rightMargin: 24
                    spacing: 14

                    Text { text: "nrma Runtime — Windows EXE Layer"; color: win.textMain; font.pixelSize: 22; font.bold: true }
                    Text {
                        Layout.fillWidth: true; wrapMode: Text.WordWrap
                        text: settings.runtimeStatus.compatibility_notice || "Wine is an optional compatibility layer. Compatibility varies by Windows application and is never universal."
                        color: win.textMuted; font.pixelSize: 12
                    }

                    // Engine Status Card
                    Rectangle {
                        Layout.fillWidth: true; radius: 14; color: win.cardBg
                        implicitHeight: rtEngineCol.implicitHeight + 24
                        ColumnLayout {
                            id: rtEngineCol
                            anchors.fill: parent; anchors.margins: 12; spacing: 8
                            RowLayout {
                                Layout.fillWidth: true
                                Text {
                                    text: "Wine Engine: " + (settings.runtimeStatus.wine_version || "Not installed (Optional)")
                                    color: win.textMain; font.pixelSize: 14; font.bold: true
                                }
                                Item { Layout.fillWidth: true }
                                Button {
                                    visible: !settings.runtimeStatus.wine_installed
                                    text: "Install Optional Wine Engine"
                                    onClicked: settings.installWineEngine()
                                }
                            }
                            Text {
                                text: "Base nrmaOS omits Wine to preserve fast boot and a small ISO footprint. Installing Wine downloads packages from configured Debian repositories."
                                color: win.textMuted; font.pixelSize: 12; wrapMode: Text.WordWrap; Layout.fillWidth: true
                            }
                        }
                    }

                    // EXE Inspector & Launcher Card
                    Rectangle {
                        Layout.fillWidth: true; radius: 14; color: win.cardBg
                        implicitHeight: exeCol.implicitHeight + 24
                        ColumnLayout {
                            id: exeCol
                            anchors.fill: parent; anchors.margins: 12; spacing: 8
                            Text { text: "Inspect, Launch, or Create Shortcut for .exe / .msi"; color: win.textMain; font.pixelSize: 14; font.bold: true }

                            RowLayout {
                                Layout.fillWidth: true; spacing: 8
                                TextField {
                                    id: exePathField
                                    Layout.fillWidth: true
                                    text: settings.inspectedExe.path || ""
                                    placeholderText: "/home/nrma/Downloads/Setup.exe"
                                }
                                Button {
                                    text: "Inspect PE Header"
                                    onClicked: settings.inspectExecutable(exePathField.text)
                                }
                            }

                            RowLayout {
                                Layout.fillWidth: true; spacing: 8
                                TextField {
                                    id: exePrefixField
                                    Layout.preferredWidth: 160
                                    text: "default"
                                    placeholderText: "Prefix name"
                                }
                                TextField {
                                    id: exeShortcutName
                                    Layout.fillWidth: true
                                    placeholderText: "Shortcut Name in App Launcher"
                                }
                                Button {
                                    text: "Run in Prefix"
                                    onClicked: settings.runExecutableInPrefix(exePathField.text, exePrefixField.text)
                                }
                                Button {
                                    text: "+ Shortcut"
                                    onClicked: settings.createLauncherShortcut(exePathField.text, exeShortcutName.text, exePrefixField.text)
                                }
                            }

                            Text {
                                visible: (settings.inspectedExe.filename || "") !== ""
                                Layout.fillWidth: true; wrapMode: Text.WordWrap
                                text: "Executable: " + (settings.inspectedExe.filename || "")
                                    + "  •  Arch: " + (settings.inspectedExe.architecture || "")
                                    + "  •  Format: " + (settings.inspectedExe.pe_format || "")
                                    + "  •  Subsystem: " + (settings.inspectedExe.subsystem || "")
                                    + "\nNotes: " + ((settings.inspectedExe.notes || []).join(" | "))
                                color: win.accent; font.pixelSize: 12
                            }
                        }
                    }

                    // Prefix Management Card
                    Rectangle {
                        Layout.fillWidth: true; radius: 14; color: win.cardBg
                        implicitHeight: pfxCol.implicitHeight + 24
                        ColumnLayout {
                            id: pfxCol
                            anchors.fill: parent; anchors.margins: 12; spacing: 8
                            Text { text: "Isolated Wine Prefixes (" + (settings.runtimeStatus.prefix_count || 0) + ")"; color: win.textMain; font.pixelSize: 14; font.bold: true }

                            RowLayout {
                                Layout.fillWidth: true; spacing: 8
                                TextField {
                                    id: newPfxName
                                    Layout.fillWidth: true
                                    placeholderText: "New prefix name (e.g. office-tools)"
                                }
                                Button {
                                    text: "Create Prefix"
                                    onClicked: {
                                        if (settings.createWinePrefix(newPfxName.text, "win64")) {
                                            newPfxName.text = ""
                                        }
                                    }
                                }
                            }

                            Repeater {
                                model: settings.runtimeStatus.prefixes || []
                                delegate: RowLayout {
                                    Layout.fillWidth: true
                                    Text {
                                        Layout.fillWidth: true
                                        text: modelData.name + "  (" + modelData.arch + ")  —  " + modelData.path
                                        color: win.textMuted; font.pixelSize: 12; elide: Text.ElideRight
                                    }
                                    Button {
                                        text: "Delete"
                                        onClicked: settings.removeWinePrefix(modelData.name)
                                    }
                                }
                            }
                        }
                    }
                }

                // ============================================================
                // PAGE 6: ABOUT nrmaOS
                // ============================================================
                ColumnLayout {
                    visible: win.currentPage === "about"
                    Layout.fillWidth: true
                    Layout.leftMargin: 24
                    Layout.rightMargin: 24
                    spacing: 14

                    Text { text: "About nrmaOS"; color: win.textMain; font.pixelSize: 22; font.bold: true }

                    Rectangle {
                        Layout.fillWidth: true; radius: 14; color: win.cardBg
                        implicitHeight: aboutCol.implicitHeight + 28
                        ColumnLayout {
                            id: aboutCol
                            anchors.fill: parent; anchors.margins: 14; spacing: 8
                            Text { text: settings.aboutInfo.osName || "nrmaOS"; color: win.textMain; font.pixelSize: 18; font.bold: true }
                            Text { text: "Hostname: " + (settings.aboutInfo.hostname || ""); color: win.textMain; font.pixelSize: 13 }
                            Text { text: "Session: " + (settings.aboutInfo.sessionType || ""); color: win.textMain; font.pixelSize: 13 }
                            Text { text: "Processor: " + (settings.aboutInfo.cpu || ""); color: win.textMain; font.pixelSize: 13 }
                            Text { text: "Total Memory: " + (settings.aboutInfo.memory || ""); color: win.textMain; font.pixelSize: 13 }
                            Text { text: "Linux Kernel: " + (settings.aboutInfo.kernel || ""); color: win.textMuted; font.pixelSize: 12 }
                            Text { text: "Foundation: " + (settings.aboutInfo.debianBase || "Debian GNU/Linux stable") + " • Qt " + (settings.aboutInfo.qtVersion || "6"); color: win.textMuted; font.pixelSize: 12 }
                            Text {
                                Layout.fillWidth: true; wrapMode: Text.WordWrap; Layout.topMargin: 6
                                text: "nrmaOS original shell, utilities, and documentation are licensed under the MIT License. Underlying Linux kernel, Debian base packages, Xorg, Openbox, Mesa, Qt 6, xrdp, and optional Wine components remain under their respective upstream open-source licenses."
                                color: win.textMuted; font.pixelSize: 12
                            }
                        }
                    }
                }

                Item { height: 24 }
            }
        }
    }

    footer: Rectangle {
        visible: settings.feedbackMessage !== ""
        height: visible ? 28 : 0
        color: win.sideBg
        Text {
            anchors.verticalCenter: parent.verticalCenter
            anchors.left: parent.left
            anchors.leftMargin: 16
            text: settings.feedbackMessage
            color: win.accent
            font.pixelSize: 12
        }
    }
}
