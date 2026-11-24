import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Rectangle {
    id: root
    property bool darkTheme: true
    property color accentColor: "#5e8bff"
    signal requestClose()

    width: Math.min(720, parent ? parent.width - 64 : 680)
    height: 320
    radius: 24
    color: darkTheme ? "#f0161e2e" : "#f5ffffff"
    border.color: darkTheme ? "#357c9cff" : "#241e293b"
    border.width: 1

    Keys.onEscapePressed: root.requestClose()

    MouseArea { anchors.fill: parent }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 20
        spacing: 14

        RowLayout {
            Layout.fillWidth: true
            Text {
                text: "nrma Task Switcher"
                color: root.darkTheme ? "#f3f6fc" : "#151e30"
                font.pixelSize: 16
                font.bold: true
            }
            Item { Layout.fillWidth: true }
            Text {
                text: windowManager.windowCount + " open windows"
                color: root.darkTheme ? "#8b9ab5" : "#5f6e87"
                font.pixelSize: 12
            }
        }

        ListView {
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            spacing: 8
            model: windowManager.windows

            delegate: Rectangle {
                width: ListView.view.width
                height: 54
                radius: 14
                color: modelData.active
                    ? (root.darkTheme ? "#293856" : "#dce6fb")
                    : (root.darkTheme ? "#1d273b" : "#eef2fa")
                border.color: modelData.active ? root.accentColor : "transparent"
                border.width: 1

                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 14
                    anchors.rightMargin: 14
                    spacing: 10

                    Rectangle {
                        Layout.preferredWidth: 34
                        Layout.preferredHeight: 34
                        radius: 10
                        color: root.darkTheme ? "#253454" : "#ffffff"
                        Text {
                            anchors.centerIn: parent
                            text: (modelData.appClass || "W").slice(0, 1).toUpperCase()
                            color: root.accentColor
                            font.pixelSize: 15
                            font.bold: true
                        }
                    }

                    MouseArea {
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                            windowManager.focusWindow(modelData.xid)
                            root.requestClose()
                        }
                        Column {
                            anchors.verticalCenter: parent.verticalCenter
                            width: parent.width
                            Text {
                                width: parent.width
                                text: modelData.title
                                color: root.darkTheme ? "#f3f6fc" : "#151e30"
                                font.pixelSize: 13
                                font.bold: true
                                elide: Text.ElideRight
                            }
                            Text {
                                text: (modelData.appClass || "X11") + (modelData.minimized ? " • Minimized" : "")
                                color: root.darkTheme ? "#94a3bd" : "#5e6d87"
                                font.pixelSize: 11
                            }
                        }
                    }

                    Button {
                        text: "◧"
                        ToolTip.visible: hovered
                        ToolTip.text: "Tile Left"
                        onClicked: {
                            windowManager.tileWindow(modelData.xid, "left")
                            root.requestClose()
                        }
                    }
                    Button {
                        text: "◨"
                        ToolTip.visible: hovered
                        ToolTip.text: "Tile Right"
                        onClicked: {
                            windowManager.tileWindow(modelData.xid, "right")
                            root.requestClose()
                        }
                    }
                    Button {
                        text: "⬜"
                        ToolTip.visible: hovered
                        ToolTip.text: "Toggle Maximize"
                        onClicked: {
                            windowManager.toggleMaximize(modelData.xid)
                            root.requestClose()
                        }
                    }
                    Button {
                        text: "✕"
                        ToolTip.visible: hovered
                        ToolTip.text: "Close Window"
                        onClicked: windowManager.closeWindow(modelData.xid)
                    }
                }
            }

            Text {
                anchors.centerIn: parent
                visible: windowManager.windowCount === 0
                text: "No open windows — choose an app from the Dock or Launcher"
                color: root.darkTheme ? "#8392ac" : "#64738c"
                font.pixelSize: 13
            }
        }
    }
}
