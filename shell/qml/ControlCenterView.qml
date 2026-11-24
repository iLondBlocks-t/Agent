import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Rectangle {
    id: root
    property bool darkTheme: true
    property color accentColor: "#5e8bff"
    signal requestClose()

    width: 360
    radius: 22
    color: darkTheme ? "#f0161e2e" : "#f5ffffff"
    border.color: darkTheme ? "#357c9cff" : "#241e293b"
    border.width: 1

    implicitHeight: mainCol.implicitHeight + 36

    MouseArea { anchors.fill: parent }

    ColumnLayout {
        id: mainCol
        anchors.fill: parent
        anchors.margins: 18
        spacing: 14

        RowLayout {
            Layout.fillWidth: true
            Text {
                text: "nrma Control Center"
                color: root.darkTheme ? "#f3f6fc" : "#151e30"
                font.pixelSize: 15
                font.bold: true
            }
            Item { Layout.fillWidth: true }
            Text {
                text: systemControl.hostname
                color: root.darkTheme ? "#8b9ab5" : "#5e6d87"
                font.pixelSize: 12
            }
        }

        // Quick Toggles Grid
        GridLayout {
            Layout.fillWidth: true
            columns: 2
            rowSpacing: 10
            columnSpacing: 10

            // Theme Toggle Tile
            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 62
                radius: 14
                color: systemSettings.darkTheme ? root.accentColor : (root.darkTheme ? "#222d42" : "#e8eef9")
                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: systemSettings.darkTheme = !systemSettings.darkTheme
                }
                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 12
                    spacing: 2
                    Text {
                        text: systemSettings.darkTheme ? "☾  Dark Mode" : "☀  Light Mode"
                        color: systemSettings.darkTheme ? "#ffffff" : "#151e30"
                        font.pixelSize: 13
                        font.bold: true
                    }
                    Text {
                        text: systemSettings.darkTheme ? "Active" : "Daylight palette"
                        color: systemSettings.darkTheme ? "#dce6ff" : "#5a6882"
                        font.pixelSize: 11
                    }
                }
            }

            // Do Not Disturb Tile
            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 62
                radius: 14
                color: systemSettings.doNotDisturb ? "#7c5cff" : (root.darkTheme ? "#222d42" : "#e8eef9")
                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: systemSettings.doNotDisturb = !systemSettings.doNotDisturb
                }
                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 12
                    spacing: 2
                    Text {
                        text: "🔕  Do Not Disturb"
                        color: systemSettings.doNotDisturb ? "#ffffff" : (root.darkTheme ? "#f3f6fc" : "#151e30")
                        font.pixelSize: 13
                        font.bold: true
                    }
                    Text {
                        text: systemSettings.doNotDisturb ? "Toasts muted" : "Notifications on"
                        color: systemSettings.doNotDisturb ? "#e4dcff" : (root.darkTheme ? "#93a2bc" : "#5a6882")
                        font.pixelSize: 11
                    }
                }
            }

            // Remote Desktop Status Tile
            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 62
                radius: 14
                color: systemControl.rdpActive ? "#1e7e5c" : (root.darkTheme ? "#222d42" : "#e8eef9")
                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: {
                        launcher.openSettingsPage("remote-desktop")
                        root.requestClose()
                    }
                }
                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 12
                    spacing: 2
                    Text {
                        text: "⇄  Remote Desktop"
                        color: systemControl.rdpActive ? "#ffffff" : (root.darkTheme ? "#f3f6fc" : "#151e30")
                        font.pixelSize: 13
                        font.bold: true
                    }
                    Text {
                        text: systemControl.rdpActive ? "Enabled (Configure)" : "Disabled (Secure)"
                        color: systemControl.rdpActive ? "#d0f5e6" : (root.darkTheme ? "#93a2bc" : "#5a6882")
                        font.pixelSize: 11
                    }
                }
            }

            // Motion / Rendering Tile
            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 62
                radius: 14
                color: !systemSettings.reducedMotion ? root.accentColor : (root.darkTheme ? "#222d42" : "#e8eef9")
                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: systemSettings.reducedMotion = !systemSettings.reducedMotion
                }
                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 12
                    spacing: 2
                    Text {
                        text: "✦  Fluid Motion"
                        color: !systemSettings.reducedMotion ? "#ffffff" : (root.darkTheme ? "#f3f6fc" : "#151e30")
                        font.pixelSize: 13
                        font.bold: true
                    }
                    Text {
                        text: systemSettings.reducedMotion ? "Reduced motion" : "Smooth transitions"
                        color: !systemSettings.reducedMotion ? "#dce6ff" : (root.darkTheme ? "#93a2bc" : "#5a6882")
                        font.pixelSize: 11
                    }
                }
            }
        }

        // Network & Memory Status Card
        Rectangle {
            Layout.fillWidth: true
            radius: 14
            color: root.darkTheme ? "#1d273b" : "#eef2fa"
            implicitHeight: sysInfoCol.implicitHeight + 20

            ColumnLayout {
                id: sysInfoCol
                anchors.fill: parent
                anchors.margins: 10
                spacing: 4
                Text {
                    text: "Network IP: " + systemControl.localIp + (systemControl.isRemoteSession ? "  (RDP Session)" : "  (Local Xorg)")
                    color: root.darkTheme ? "#e3eaf7" : "#1b263b"
                    font.pixelSize: 12
                }
                Text {
                    text: "Memory in use: " + systemControl.memorySummary + "  •  Display: " + (systemControl.currentResolution || "Auto")
                    color: root.darkTheme ? "#94a3bd" : "#5d6b85"
                    font.pixelSize: 11
                }
                Text {
                    text: systemControl.audioAvailable
                        ? ("Audio Volume: " + systemControl.volumePercent + "%")
                        : "Audio: No hardware mixer detected"
                    color: root.darkTheme ? "#94a3bd" : "#5d6b85"
                    font.pixelSize: 11
                }
            }
        }

        // Audio Slider (shown only when real audio sink is detected)
        Slider {
            visible: systemControl.audioAvailable
            Layout.fillWidth: true
            from: 0
            to: 100
            value: systemControl.volumePercent
            onMoved: systemControl.setVolume(Math.round(value))
        }

        // Quick Actions Row
        RowLayout {
            Layout.fillWidth: true
            spacing: 8

            Button {
                Layout.fillWidth: true
                text: "Settings"
                onClicked: {
                    launcher.openApp("settings")
                    root.requestClose()
                }
            }
            Button {
                Layout.fillWidth: true
                text: "Wallpapers"
                onClicked: {
                    launcher.openSettingsPage("wallpaper")
                    root.requestClose()
                }
            }
            Button {
                Layout.fillWidth: true
                text: "Log Out"
                onClicked: systemControl.logOut()
            }
        }
    }
}
