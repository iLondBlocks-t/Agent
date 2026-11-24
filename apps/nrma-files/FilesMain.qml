import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    id: win
    visible: true
    width: 920
    height: 580
    minimumWidth: 640
    minimumHeight: 420
    title: "nrma Files — " + fm.currentPath
    color: dark ? "#111726" : "#f3f6fc"

    property bool dark: fm.darkTheme
    property color panelBg: dark ? "#182136" : "#ffffff"
    property color cardBg: dark ? "#1f2b44" : "#eaeff9"
    property color textMain: dark ? "#f2f6fc" : "#151e30"
    property color textMuted: dark ? "#93a2bd" : "#5e6d87"
    property color accent: "#5e8bff"

    property string ctxPath: ""
    property string ctxName: ""
    property bool ctxIsExe: false

    header: Rectangle {
        height: 52
        color: win.panelBg
        Rectangle {
            anchors.bottom: parent.bottom
            width: parent.width
            height: 1
            color: win.dark ? "#28354f" : "#dce4f2"
        }

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 14
            anchors.rightMargin: 14
            spacing: 8

            Button {
                text: "↑ Up"
                onClicked: fm.goUp()
            }
            Button {
                text: "⌂ Home"
                onClicked: fm.goHome()
            }
            Button {
                text: "↻"
                onClicked: fm.refresh()
            }

            TextField {
                id: pathBar
                Layout.fillWidth: true
                text: fm.currentPath
                color: win.textMain
                background: Rectangle {
                    radius: 8
                    color: win.cardBg
                }
                onAccepted: fm.currentPath = text
            }

            TextField {
                Layout.preferredWidth: 180
                placeholderText: "Filter files..."
                placeholderTextColor: win.textMuted
                color: win.textMain
                background: Rectangle {
                    radius: 8
                    color: win.cardBg
                }
                onTextChanged: fm.filterQuery = text
            }

            Button {
                text: "+ Folder"
                onClicked: newFolderPopup.open()
            }
            Button {
                text: "Paste"
                onClicked: fm.pasteClipboard()
            }
        }
    }

    RowLayout {
        anchors.fill: parent
        spacing: 0

        // Sidebar Places & Storage Meter
        Rectangle {
            Layout.preferredWidth: 210
            Layout.fillHeight: true
            color: win.panelBg

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 12
                spacing: 6

                Text {
                    text: "PLACES"
                    color: win.textMuted
                    font.pixelSize: 11
                    font.bold: true
                }

                Repeater {
                    model: fm.places
                    delegate: Rectangle {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 34
                        radius: 9
                        color: fm.currentPath === modelData.path
                            ? win.accent
                            : (placeMouse.containsMouse ? win.cardBg : "transparent")

                        Text {
                            anchors.verticalCenter: parent.verticalCenter
                            anchors.left: parent.left
                            anchors.leftMargin: 10
                            text: modelData.label
                            color: fm.currentPath === modelData.path ? "#ffffff" : win.textMain
                            font.pixelSize: 13
                            font.bold: fm.currentPath === modelData.path
                        }

                        MouseArea {
                            id: placeMouse
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: fm.currentPath = modelData.path
                        }
                    }
                }

                Item { Layout.fillHeight: true }

                Rectangle {
                    Layout.fillWidth: true
                    radius: 10
                    color: win.cardBg
                    implicitHeight: storageCol.implicitHeight + 16

                    ColumnLayout {
                        id: storageCol
                        anchors.fill: parent
                        anchors.margins: 8
                        spacing: 5
                        Text {
                            text: "Storage"
                            color: win.textMain
                            font.pixelSize: 12
                            font.bold: true
                        }
                        ProgressBar {
                            Layout.fillWidth: true
                            from: 0.0
                            to: 1.0
                            value: fm.storageRatio
                        }
                        Text {
                            Layout.fillWidth: true
                            text: fm.storageSummary
                            color: win.textMuted
                            font.pixelSize: 11
                            elide: Text.ElideRight
                        }
                    }
                }
            }
        }

        // Main File List
        ListView {
            id: fileList
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            margins: 12
            spacing: 4
            model: fm.entries

            delegate: Rectangle {
                width: fileList.width - 24
                x: 12
                height: 42
                radius: 10
                color: rowMouse.containsMouse ? win.cardBg : "transparent"

                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 12
                    anchors.rightMargin: 12
                    spacing: 10

                    Rectangle {
                        Layout.preferredWidth: 28
                        Layout.preferredHeight: 28
                        radius: 7
                        color: modelData.isDir ? "#284475" : (modelData.isExe ? "#432c68" : win.cardBg)
                        Text {
                            anchors.centerIn: parent
                            text: modelData.isDir ? "▤" : (modelData.isExe ? "⊞" : "▫")
                            color: modelData.isExe ? "#d0abff" : win.accent
                            font.pixelSize: 14
                            font.bold: true
                        }
                    }

                    Text {
                        Layout.fillWidth: true
                        text: modelData.name
                        color: win.textMain
                        font.pixelSize: 13
                        font.bold: modelData.isDir
                        elide: Text.ElideRight
                    }

                    Rectangle {
                        visible: modelData.isExe
                        Layout.preferredHeight: 20
                        Layout.preferredWidth: 96
                        radius: 6
                        color: "#3b295e"
                        Text {
                            anchors.centerIn: parent
                            text: "nrma Runtime"
                            color: "#d8beff"
                            font.pixelSize: 10
                            font.bold: true
                        }
                    }

                    Text {
                        Layout.preferredWidth: 90
                        horizontalAlignment: Text.AlignRight
                        text: modelData.sizeText
                        color: win.textMuted
                        font.pixelSize: 12
                    }

                    Text {
                        Layout.preferredWidth: 130
                        horizontalAlignment: Text.AlignRight
                        text: modelData.modified
                        color: win.textMuted
                        font.pixelSize: 11
                    }
                }

                MouseArea {
                    id: rowMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    acceptedButtons: Qt.LeftButton | Qt.RightButton
                    onDoubleClicked: function(mouse) {
                        if (mouse.button === Qt.LeftButton) {
                            fm.openEntry(modelData.path)
                        }
                    }
                    onClicked: function(mouse) {
                        if (mouse.button === Qt.RightButton) {
                            win.ctxPath = modelData.path
                            win.ctxName = modelData.name
                            win.ctxIsExe = modelData.isExe
                            itemMenu.popup()
                        } else if (modelData.isDir) {
                            fm.openEntry(modelData.path)
                        }
                    }
                }
            }

            Text {
                anchors.centerIn: parent
                visible: fm.entries.length === 0
                text: "Empty folder"
                color: win.textMuted
                font.pixelSize: 14
            }
        }
    }

    footer: Rectangle {
        height: 28
        color: win.panelBg
        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 14
            anchors.rightMargin: 14
            Text {
                text: fm.entries.length + " items"
                color: win.textMuted
                font.pixelSize: 11
            }
            Item { Layout.fillWidth: true }
            Text {
                text: fm.statusMessage
                color: win.accent
                font.pixelSize: 11
            }
        }
    }

    Menu {
        id: itemMenu
        MenuItem {
            text: win.ctxIsExe ? "Open with nrma Runtime" : "Open"
            onTriggered: fm.openEntry(win.ctxPath)
        }
        MenuItem {
            visible: win.ctxIsExe
            height: visible ? implicitHeight : 0
            text: "Inspect EXE Compatibility..."
            onTriggered: fm.inspectInRuntime(win.ctxPath)
        }
        MenuItem {
            visible: win.ctxIsExe
            height: visible ? implicitHeight : 0
            text: "Create App Launcher Shortcut"
            onTriggered: fm.createExeShortcut(win.ctxPath)
        }
        MenuItem {
            text: "Copy"
            onTriggered: fm.copyItem(win.ctxPath)
        }
        MenuItem {
            text: "Delete"
            onTriggered: fm.deleteItem(win.ctxPath)
        }
    }

    Popup {
        id: newFolderPopup
        anchors.centerIn: parent
        width: 320
        modal: true
        padding: 16
        ColumnLayout {
            anchors.fill: parent
            spacing: 10
            Text {
                text: "Create New Folder"
                font.bold: true
                font.pixelSize: 14
            }
            TextField {
                id: folderNameInput
                Layout.fillWidth: true
                placeholderText: "Folder name"
                onAccepted: {
                    if (fm.createFolder(text)) {
                        text = ""
                        newFolderPopup.close()
                    }
                }
            }
            RowLayout {
                Layout.fillWidth: true
                Item { Layout.fillWidth: true }
                Button {
                    text: "Cancel"
                    onClicked: newFolderPopup.close()
                }
                Button {
                    text: "Create"
                    onClicked: {
                        if (fm.createFolder(folderNameInput.text)) {
                            folderNameInput.text = ""
                            newFolderPopup.close()
                        }
                    }
                }
            }
        }
    }
}
