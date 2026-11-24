import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Window

Window {
    id: desktopWindow
    objectName: "nrmaosShellWindow"
    visible: true
    x: 0
    y: 0
    width: Screen.width > 0 ? Screen.width : 1280
    height: Screen.height > 0 ? Screen.height : 800
    flags: Qt.FramelessWindowHint
    title: "nrmaOS Desktop"
    color: darkTheme ? "#0e1525" : "#dfe7f5"

    property bool darkTheme: systemSettings.darkTheme
    property color accentColor: systemSettings.accentColor
    property color barBg: darkTheme ? "#d9121928" : "#e6f7f9fe"
    property color dockBg: darkTheme ? "#d9161f32" : "#e6ffffff"
    property color textPrimary: darkTheme ? "#f3f6fc" : "#151e30"
    property color textMuted: darkTheme ? "#95a4bf" : "#5b6982"
    property int animMs: systemSettings.reducedMotion ? 45 : 160

    property string activeOverlay: ""
    property string toastTitle: ""
    property string toastBody: ""
    property string toastUrgency: "normal"
    property bool toastVisible: false

    function toggleOverlay(name) {
        if (activeOverlay === name) {
            activeOverlay = ""
        } else {
            activeOverlay = name
            if (name === "notifications") {
                notificationCenter.markAllRead()
            }
        }
    }

    Component.onCompleted: {
        windowManager.registerDesktopWindow(desktopWindow)
    }

    Timer {
        interval: 200
        running: true
        repeat: false
        onTriggered: {
            windowManager.registerDesktopWindow(desktopWindow)
            windowManager.registerDockPanel(topBarWindow, 36, 0)
            windowManager.registerDockPanel(dockWindow, 0, 76)
            windowManager.registerShellWindow(overlayWindow)
            windowManager.registerShellWindow(toastWindow)
        }
    }

    // Smooth Procedural Fallback + Image Wallpaper Canvas
    Rectangle {
        anchors.fill: parent
        gradient: Gradient {
            GradientStop { position: 0.0; color: desktopWindow.darkTheme ? "#0d121e" : "#d6e0f0" }
            GradientStop { position: 0.5; color: desktopWindow.darkTheme ? "#1a2d54" : "#e6edf8" }
            GradientStop { position: 1.0; color: desktopWindow.darkTheme ? "#2a5c8a" : "#baceee" }
        }
    }

    Image {
        id: wallpaperImage
        anchors.fill: parent
        source: systemSettings.wallpaperPath ? ("file://" + systemSettings.wallpaperPath) : ""
        fillMode: Image.PreserveAspectCrop
        asynchronous: true
        cache: false
        visible: status === Image.Ready
        opacity: status === Image.Ready ? 1.0 : 0.0
        Behavior on opacity { NumberAnimation { duration: desktopWindow.animMs * 2 } }
    }

    // Subtle empty-desktop workspace greeting when no external window is open
    Column {
        anchors.centerIn: parent
        spacing: 8
        visible: windowManager.windowCount === 0 && desktopWindow.activeOverlay === ""
        opacity: 0.88

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "nrmaOS"
            color: desktopWindow.darkTheme ? "#e8f0ff" : "#162238"
            font.pixelSize: 34
            font.bold: true
        }
        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "Minimal  •  Fluid  •  Ready  —  Press Ctrl+Space or use the Dock below"
            color: desktopWindow.darkTheme ? "#b4c5e4" : "#445470"
            font.pixelSize: 13
        }
    }

    // Desktop Right-Click Context Menu
    MouseArea {
        anchors.fill: parent
        acceptedButtons: Qt.LeftButton | Qt.RightButton
        onClicked: function(mouse) {
            if (mouse.button === Qt.RightButton) {
                desktopContextMenu.x = Math.min(mouse.x, desktopWindow.width - desktopContextMenu.width - 12)
                desktopContextMenu.y = Math.min(mouse.y, desktopWindow.height - desktopContextMenu.height - 90)
                desktopContextMenu.visible = true
            } else {
                desktopContextMenu.visible = false
            }
        }
    }

    Rectangle {
        id: desktopContextMenu
        visible: false
        width: 220
        radius: 14
        color: desktopWindow.darkTheme ? "#f2182236" : "#f7ffffff"
        border.color: desktopWindow.darkTheme ? "#357c9cff" : "#261e293b"
        border.width: 1
        implicitHeight: ctxCol.implicitHeight + 16

        ColumnLayout {
            id: ctxCol
            anchors.fill: parent
            anchors.margins: 8
            spacing: 2

            Repeater {
                model: [
                    { label: "Open nrma Files", action: "files" },
                    { label: "Open Terminal", action: "terminal" },
                    { label: "New Desktop Folder", action: "new-folder" },
                    { label: "Change Wallpaper...", action: "wallpaper" },
                    { label: "Remote Desktop Settings...", action: "rdp" },
                    { label: "System Settings...", action: "settings" }
                ]
                delegate: Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 32
                    radius: 8
                    color: itemHover.containsMouse ? (desktopWindow.darkTheme ? "#293857" : "#e2ebfc") : "transparent"

                    Text {
                        anchors.verticalCenter: parent.verticalCenter
                        anchors.left: parent.left
                        anchors.leftMargin: 10
                        text: modelData.label
                        color: desktopWindow.textPrimary
                        font.pixelSize: 13
                    }

                    MouseArea {
                        id: itemHover
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                            desktopContextMenu.visible = false
                            if (modelData.action === "files") launcher.openApp("files")
                            else if (modelData.action === "terminal") launcher.openApp("terminal")
                            else if (modelData.action === "new-folder") {
                                systemSettings.createDesktopFolder("New Folder")
                                notificationCenter.postNotification("Desktop", "Created ~/Desktop/New Folder", "low")
                            }
                            else if (modelData.action === "wallpaper") launcher.openSettingsPage("wallpaper")
                            else if (modelData.action === "rdp") launcher.openSettingsPage("remote-desktop")
                            else if (modelData.action === "settings") launcher.openApp("settings")
                        }
                    }
                }
            }
        }
    }

    // =====================================================================
    // 1. nrma Top Bar (36px Dock Strut at Top of Screen)
    // =====================================================================
    Window {
        id: topBarWindow
        visible: true
        x: 0
        y: 0
        width: desktopWindow.width
        height: 36
        flags: Qt.FramelessWindowHint | Qt.WindowDoesNotAcceptFocus
        title: "nrmaOS Top Bar"
        color: "transparent"

        Component.onCompleted: windowManager.registerDockPanel(topBarWindow, 36, 0)

        Rectangle {
            anchors.fill: parent
            color: desktopWindow.barBg
            Rectangle {
                anchors.bottom: parent.bottom
                anchors.left: parent.left
                anchors.right: parent.right
                height: 1
                color: desktopWindow.darkTheme ? "#26ffffff" : "#1a0f172a"
            }

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 14
                anchors.rightMargin: 14
                spacing: 12

                // nrma Emblem & Brand Menu Trigger
                Rectangle {
                    Layout.preferredWidth: 24
                    Layout.preferredHeight: 24
                    radius: 7
                    color: desktopWindow.accentColor
                    Text {
                        anchors.centerIn: parent
                        text: "n"
                        color: "#ffffff"
                        font.pixelSize: 14
                        font.bold: true
                    }
                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: desktopWindow.toggleOverlay("launcher")
                    }
                }

                Text {
                    text: "nrmaOS"
                    color: desktopWindow.textPrimary
                    font.pixelSize: 13
                    font.bold: true
                }

                Rectangle {
                    Layout.preferredWidth: 1
                    Layout.preferredHeight: 14
                    color: desktopWindow.darkTheme ? "#33ffffff" : "#22000000"
                }

                // Live Focused Window Title
                Text {
                    Layout.maximumWidth: 320
                    text: windowManager.activeWindowTitle
                    color: desktopWindow.textMuted
                    font.pixelSize: 13
                    elide: Text.ElideRight
                }

                // Quick Window Snapping Controls when a client window is active
                Row {
                    visible: windowManager.activeWindowId !== 0
                    spacing: 4

                    Repeater {
                        model: [
                            { icon: "◧", pos: "left" },
                            { icon: "◨", pos: "right" },
                            { icon: "⬜", pos: "maximize" }
                        ]
                        delegate: Rectangle {
                            width: 24
                            height: 22
                            radius: 6
                            color: snapMouse.containsMouse ? (desktopWindow.darkTheme ? "#2b3b5c" : "#dce6fa") : "transparent"
                            Text {
                                anchors.centerIn: parent
                                text: modelData.icon
                                color: desktopWindow.textPrimary
                                font.pixelSize: 11
                            }
                            MouseArea {
                                id: snapMouse
                                anchors.fill: parent
                                hoverEnabled: true
                                cursorShape: Qt.PointingHandCursor
                                onClicked: windowManager.tileWindow(windowManager.activeWindowId, modelData.pos)
                            }
                        }
                    }
                }

                Item { Layout.fillWidth: true }

                // Remote Desktop Live Indicator Pill (visible whenever xrdp is enabled)
                Rectangle {
                    visible: systemControl.rdpActive
                    Layout.preferredHeight: 22
                    Layout.preferredWidth: rdpBadgeText.implicitWidth + 16
                    radius: 11
                    color: "#1e7e5c"
                    Text {
                        id: rdpBadgeText
                        anchors.centerIn: parent
                        text: "⇄ RDP Active"
                        color: "#ffffff"
                        font.pixelSize: 11
                        font.bold: true
                    }
                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: launcher.openSettingsPage("remote-desktop")
                    }
                }

                // App Launcher Search Button
                Rectangle {
                    Layout.preferredHeight: 24
                    Layout.preferredWidth: 78
                    radius: 8
                    color: searchTopMouse.containsMouse ? (desktopWindow.darkTheme ? "#273552" : "#e1eafb") : "transparent"
                    Text {
                        anchors.centerIn: parent
                        text: "⌕ Apps"
                        color: desktopWindow.textPrimary
                        font.pixelSize: 12
                    }
                    MouseArea {
                        id: searchTopMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: desktopWindow.toggleOverlay("launcher")
                    }
                }

                // Task Switcher Button
                Rectangle {
                    Layout.preferredHeight: 24
                    Layout.preferredWidth: 52
                    radius: 8
                    color: swTopMouse.containsMouse ? (desktopWindow.darkTheme ? "#273552" : "#e1eafb") : "transparent"
                    Text {
                        anchors.centerIn: parent
                        text: "❐ " + windowManager.windowCount
                        color: desktopWindow.textPrimary
                        font.pixelSize: 12
                    }
                    MouseArea {
                        id: swTopMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: desktopWindow.toggleOverlay("switcher")
                    }
                }

                // Theme Quick Toggle Button
                Rectangle {
                    objectName: "settingsButton"
                    Layout.preferredWidth: 28
                    Layout.preferredHeight: 24
                    radius: 8
                    color: themeMouse.containsMouse ? (desktopWindow.darkTheme ? "#273552" : "#e1eafb") : "transparent"
                    Text {
                        anchors.centerIn: parent
                        text: desktopWindow.darkTheme ? "☀" : "☾"
                        color: desktopWindow.accentColor
                        font.pixelSize: 14
                    }
                    MouseArea {
                        id: themeMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: systemSettings.darkTheme = !systemSettings.darkTheme
                    }
                }

                // Notifications Button + Unread Badge
                Rectangle {
                    Layout.preferredWidth: 34
                    Layout.preferredHeight: 24
                    radius: 8
                    color: notifMouse.containsMouse ? (desktopWindow.darkTheme ? "#273552" : "#e1eafb") : "transparent"
                    Row {
                        anchors.centerIn: parent
                        spacing: 3
                        Text {
                            text: "🔔"
                            font.pixelSize: 12
                        }
                        Text {
                            visible: notificationCenter.unreadCount > 0
                            text: notificationCenter.unreadCount
                            color: desktopWindow.accentColor
                            font.pixelSize: 11
                            font.bold: true
                        }
                    }
                    MouseArea {
                        id: notifMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: desktopWindow.toggleOverlay("notifications")
                    }
                }

                // Control Center Trigger
                Rectangle {
                    Layout.preferredWidth: 32
                    Layout.preferredHeight: 24
                    radius: 8
                    color: ccMouse.containsMouse ? (desktopWindow.darkTheme ? "#273552" : "#e1eafb") : "transparent"
                    Text {
                        anchors.centerIn: parent
                        text: "☰"
                        color: desktopWindow.textPrimary
                        font.pixelSize: 13
                    }
                    MouseArea {
                        id: ccMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: desktopWindow.toggleOverlay("controlCenter")
                    }
                }

                // Live Clock
                Text {
                    id: topClock
                    text: Qt.formatDateTime(new Date(), "ddd  HH:mm")
                    color: desktopWindow.textPrimary
                    font.pixelSize: 12
                    font.bold: true
                    Timer {
                        interval: 15000
                        running: true
                        repeat: true
                        onTriggered: topClock.text = Qt.formatDateTime(new Date(), "ddd  HH:mm")
                    }
                }
            }
        }
    }

    // =====================================================================
    // 2. nrma Dock (Floating Centered Pill at Bottom, 76px Strut)
    // =====================================================================
    Window {
        id: dockWindow
        visible: true
        x: 0
        y: desktopWindow.height - 76
        width: desktopWindow.width
        height: 76
        flags: Qt.FramelessWindowHint | Qt.WindowDoesNotAcceptFocus
        title: "nrmaOS Dock"
        color: "transparent"

        Component.onCompleted: windowManager.registerDockPanel(dockWindow, 0, 76)

        Rectangle {
            id: dockPill
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.bottom: parent.bottom
            anchors.bottomMargin: 8
            height: systemSettings.dockIconSize + 16
            width: dockRow.implicitWidth + 24
            radius: 22
            color: desktopWindow.dockBg
            border.color: desktopWindow.darkTheme ? "#357c9cff" : "#261e293b"
            border.width: 1

            RowLayout {
                id: dockRow
                anchors.centerIn: parent
                spacing: 8

                Repeater {
                    model: [
                        { id: "launcher", label: "Launcher", glyph: "❖", objectName: "launcherButton" },
                        { id: "files", label: "nrma Files", glyph: "▤", objectName: "filesButton" },
                        { id: "terminal", label: "Terminal", glyph: ">_", objectName: "terminalButton" },
                        { id: "runtime", label: "nrma Runtime", glyph: "⊞", objectName: "runtimeButton" },
                        { id: "remote-desktop", label: "Remote Desktop", glyph: "⇄", objectName: "rdpButton" },
                        { id: "settings", label: "Settings", glyph: "⚙", objectName: "dockSettingsButton" }
                    ]
                    delegate: Item {
                        Layout.preferredWidth: systemSettings.dockIconSize
                        Layout.preferredHeight: systemSettings.dockIconSize

                        Rectangle {
                            id: iconTile
                            objectName: modelData.objectName
                            anchors.fill: parent
                            radius: 14
                            scale: dockItemMouse.containsMouse ? 1.1 : 1.0
                            color: dockItemMouse.containsMouse
                                ? (desktopWindow.darkTheme ? "#2b3d63" : "#dce7fc")
                                : (desktopWindow.darkTheme ? "#1f2b44" : "#eef3fc")
                            border.color: desktopWindow.darkTheme ? "#337c9cff" : "#d4dff2"
                            border.width: 1

                            Behavior on scale { NumberAnimation { duration: desktopWindow.animMs; easing.type: Easing.OutCubic } }

                            Text {
                                anchors.centerIn: parent
                                text: modelData.glyph
                                color: desktopWindow.accentColor
                                font.pixelSize: Math.round(systemSettings.dockIconSize * 0.42)
                                font.bold: true
                            }
                        }

                        MouseArea {
                            id: dockItemMouse
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: {
                                if (modelData.id === "launcher") {
                                    desktopWindow.toggleOverlay("launcher")
                                } else {
                                    desktopWindow.activeOverlay = ""
                                    launcher.openApp(modelData.id)
                                }
                            }
                        }
                    }
                }

                // Divider before live running X11 client windows
                Rectangle {
                    visible: windowManager.windowCount > 0
                    Layout.preferredWidth: 1
                    Layout.preferredHeight: systemSettings.dockIconSize - 12
                    color: desktopWindow.darkTheme ? "#38ffffff" : "#24000000"
                }

                // Live Running External Windows in Dock
                Repeater {
                    model: windowManager.windows
                    delegate: Item {
                        Layout.preferredWidth: systemSettings.dockIconSize
                        Layout.preferredHeight: systemSettings.dockIconSize

                        Rectangle {
                            anchors.fill: parent
                            radius: 14
                            color: modelData.active
                                ? desktopWindow.accentColor
                                : (winDockMouse.containsMouse
                                    ? (desktopWindow.darkTheme ? "#2b3d63" : "#dce7fc")
                                    : (desktopWindow.darkTheme ? "#1b253a" : "#e6edf9"))

                            Text {
                                anchors.centerIn: parent
                                text: (modelData.title || "W").slice(0, 2)
                                color: modelData.active ? "#ffffff" : desktopWindow.textPrimary
                                font.pixelSize: 13
                                font.bold: true
                            }

                            // Active indicator dot
                            Rectangle {
                                width: 6
                                height: 6
                                radius: 3
                                anchors.bottom: parent.bottom
                                anchors.bottomMargin: 3
                                anchors.horizontalCenter: parent.horizontalCenter
                                color: modelData.active ? "#ffffff" : desktopWindow.accentColor
                            }
                        }

                        MouseArea {
                            id: winDockMouse
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            acceptedButtons: Qt.LeftButton | Qt.RightButton
                            onClicked: function(mouse) {
                                if (mouse.button === Qt.RightButton) {
                                    windowManager.closeWindow(modelData.xid)
                                } else {
                                    windowManager.toggleMinimize(modelData.xid)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // =====================================================================
    // 3. Interactive Overlay Surface (Launcher, Switcher, Control Center, Notifications)
    // =====================================================================
    Window {
        id: overlayWindow
        visible: desktopWindow.activeOverlay !== ""
        x: 0
        y: 0
        width: desktopWindow.width
        height: desktopWindow.height
        flags: Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint
        title: "nrmaOS Overlay"
        color: "#55080d18"

        onVisibleChanged: {
            if (visible) {
                overlayWindow.requestActivate()
                if (desktopWindow.activeOverlay === "launcher") {
                    launcherPanel.resetAndFocus()
                }
            }
        }

        MouseArea {
            anchors.fill: parent
            onClicked: desktopWindow.activeOverlay = ""
        }

        // Prevent clicks inside active card from closing overlay
        LauncherView {
            id: launcherPanel
            visible: desktopWindow.activeOverlay === "launcher"
            anchors.centerIn: parent
            width: Math.min(820, parent.width - 64)
            height: Math.min(540, parent.height - 120)
            darkTheme: desktopWindow.darkTheme
            accentColor: desktopWindow.accentColor
            animMs: desktopWindow.animMs
            onRequestClose: desktopWindow.activeOverlay = ""
        }

        ControlCenterView {
            visible: desktopWindow.activeOverlay === "controlCenter"
            anchors.top: parent.top
            anchors.topMargin: 44
            anchors.right: parent.right
            anchors.rightMargin: 14
            darkTheme: desktopWindow.darkTheme
            accentColor: desktopWindow.accentColor
            onRequestClose: desktopWindow.activeOverlay = ""
        }

        NotificationDrawer {
            visible: desktopWindow.activeOverlay === "notifications"
            anchors.top: parent.top
            anchors.topMargin: 44
            anchors.right: parent.right
            anchors.rightMargin: 14
            darkTheme: desktopWindow.darkTheme
            accentColor: desktopWindow.accentColor
            onRequestClose: desktopWindow.activeOverlay = ""
        }

        TaskSwitcherView {
            visible: desktopWindow.activeOverlay === "switcher"
            anchors.centerIn: parent
            darkTheme: desktopWindow.darkTheme
            accentColor: desktopWindow.accentColor
            onRequestClose: desktopWindow.activeOverlay = ""
        }
    }

    // =====================================================================
    // 4. Non-Focus-Stealing Toast Notification Popup
    // =====================================================================
    Window {
        id: toastWindow
        visible: desktopWindow.toastVisible
        x: desktopWindow.width - width - 16
        y: 46
        width: 320
        height: 76
        flags: Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.WindowDoesNotAcceptFocus | Qt.ToolTip
        color: "transparent"

        Rectangle {
            anchors.fill: parent
            radius: 16
            color: desktopWindow.darkTheme ? "#f2192338" : "#f7ffffff"
            border.color: desktopWindow.toastUrgency === "critical" ? "#ef4444" : desktopWindow.accentColor
            border.width: 1

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 12
                spacing: 3
                Text {
                    Layout.fillWidth: true
                    text: desktopWindow.toastTitle
                    color: desktopWindow.textPrimary
                    font.pixelSize: 13
                    font.bold: true
                    elide: Text.ElideRight
                }
                Text {
                    Layout.fillWidth: true
                    text: desktopWindow.toastBody
                    color: desktopWindow.textMuted
                    font.pixelSize: 12
                    elide: Text.ElideRight
                }
            }

            MouseArea {
                anchors.fill: parent
                onClicked: desktopWindow.toastVisible = false
            }
        }
    }

    Timer {
        id: toastDismissTimer
        interval: 4000
        repeat: false
        onTriggered: desktopWindow.toastVisible = false
    }

    Connections {
        target: notificationCenter
        function onToastRequested(title, body, urgency) {
            desktopWindow.toastTitle = title
            desktopWindow.toastBody = body
            desktopWindow.toastUrgency = urgency
            desktopWindow.toastVisible = true
            toastDismissTimer.restart()
        }
    }

    Connections {
        target: shellIpc
        function onOverlayToggleRequested(overlayName) {
            desktopWindow.toggleOverlay(overlayName)
        }
    }

    Connections {
        target: launcher
        function onAppLaunchResult(appId, started) {
            if (!started) {
                notificationCenter.postNotification(
                    "Application Unavailable",
                    "Could not start '" + appId + "'. Verify package installation.",
                    "critical"
                )
            }
        }
    }
}
