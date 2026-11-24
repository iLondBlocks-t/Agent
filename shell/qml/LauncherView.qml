import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Rectangle {
    id: root
    property bool darkTheme: true
    property color accentColor: "#5e8bff"
    property int animMs: 140
    signal requestClose()

    radius: 24
    color: darkTheme ? "#eb151c28" : "#f2f8faff"
    border.color: darkTheme ? "#337c9cff" : "#261e293b"
    border.width: 1

    property string searchQuery: ""
    property var filteredApps: launcher.searchApps(searchQuery)
    property int selectedIndex: 0

    function resetAndFocus() {
        searchField.text = ""
        searchQuery = ""
        launcher.refreshApplications()
        filteredApps = launcher.searchApps("")
        selectedIndex = 0
        searchField.forceActiveFocus()
    }

    Keys.onEscapePressed: root.requestClose()
    Keys.onDownPressed: {
        if (filteredApps.length > 0)
            selectedIndex = (selectedIndex + 1) % filteredApps.length
    }
    Keys.onUpPressed: {
        if (filteredApps.length > 0)
            selectedIndex = (selectedIndex - 1 + filteredApps.length) % filteredApps.length
    }
    Keys.onReturnPressed: {
        if (filteredApps.length > 0 && selectedIndex >= 0 && selectedIndex < filteredApps.length) {
            launcher.openApp(filteredApps[selectedIndex].id)
            root.requestClose()
        }
    }

    MouseArea { anchors.fill: parent }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 24
        spacing: 18

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 48
            radius: 14
            color: root.darkTheme ? "#1f293d" : "#e9eef8"
            border.color: searchField.activeFocus ? root.accentColor : (root.darkTheme ? "#2f3d59" : "#d0daec")
            border.width: 1

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 16
                anchors.rightMargin: 16
                spacing: 10

                Text {
                    text: "⌕"
                    color: root.accentColor
                    font.pixelSize: 19
                    font.bold: true
                }

                TextField {
                    id: searchField
                    objectName: "launcherSearchField"
                    Layout.fillWidth: true
                    placeholderText: "Search nrmaOS apps, settings, or Windows shortcuts..."
                    placeholderTextColor: root.darkTheme ? "#7f8ea8" : "#697791"
                    color: root.darkTheme ? "#f3f6fc" : "#151e30"
                    font.pixelSize: 15
                    background: Item {}
                    onTextChanged: {
                        root.searchQuery = text
                        root.filteredApps = launcher.searchApps(text)
                        root.selectedIndex = 0
                    }
                    Keys.onEscapePressed: root.requestClose()
                    Keys.onReturnPressed: {
                        if (root.filteredApps.length > 0) {
                            launcher.openApp(root.filteredApps[root.selectedIndex].id)
                            root.requestClose()
                        }
                    }
                }

                Text {
                    visible: searchField.text.length > 0
                    text: "ESC"
                    color: root.darkTheme ? "#7f8ea8" : "#697791"
                    font.pixelSize: 11
                }
            }
        }

        GridView {
            id: appGrid
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            cellWidth: Math.floor(width / 3)
            cellHeight: 96
            model: root.filteredApps

            delegate: Item {
                width: appGrid.cellWidth
                height: appGrid.cellHeight

                Rectangle {
                    anchors.fill: parent
                    anchors.margins: 6
                    radius: 16
                    property bool isCurrent: index === root.selectedIndex
                    color: tileArea.containsMouse || isCurrent
                        ? (root.darkTheme ? "#28354f" : "#dfe8fb")
                        : (root.darkTheme ? "#1a2334" : "#ffffff")
                    border.color: isCurrent ? root.accentColor : (root.darkTheme ? "#28344b" : "#e3e9f4")
                    border.width: 1

                    Behavior on color { ColorAnimation { duration: root.animMs } }

                    RowLayout {
                        anchors.fill: parent
                        anchors.margins: 12
                        spacing: 12

                        Rectangle {
                            Layout.preferredWidth: 46
                            Layout.preferredHeight: 46
                            radius: 13
                            color: modelData.isWineApp ? "#3c2e58" : (root.darkTheme ? "#253454" : "#eaf0ff")
                            Text {
                                anchors.centerIn: parent
                                text: modelData.glyph || "◈"
                                color: modelData.isWineApp ? "#c49bff" : root.accentColor
                                font.pixelSize: 20
                                font.bold: true
                            }
                        }

                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 3
                            Text {
                                Layout.fillWidth: true
                                text: modelData.name
                                color: root.darkTheme ? "#f3f6fc" : "#151e30"
                                font.pixelSize: 14
                                font.bold: true
                                elide: Text.ElideRight
                            }
                            Text {
                                Layout.fillWidth: true
                                text: modelData.description
                                color: root.darkTheme ? "#94a3bd" : "#5e6c85"
                                font.pixelSize: 11
                                maximumLineCount: 2
                                wrapMode: Text.WordWrap
                                elide: Text.ElideRight
                            }
                        }
                    }

                    MouseArea {
                        id: tileArea
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onEntered: root.selectedIndex = index
                        onClicked: {
                            launcher.openApp(modelData.id)
                            root.requestClose()
                        }
                    }
                }
            }
        }

        RowLayout {
            Layout.fillWidth: true
            Text {
                text: root.filteredApps.length + " applications available  •  Arrow keys + Enter to launch"
                color: root.darkTheme ? "#8594ae" : "#64728c"
                font.pixelSize: 12
            }
            Item { Layout.fillWidth: true }
            Button {
                text: "Close"
                onClicked: root.requestClose()
                background: Rectangle {
                    radius: 10
                    color: parent.hovered ? (root.darkTheme ? "#2a3752" : "#dce5f7") : "transparent"
                }
                contentItem: Text {
                    text: parent.text
                    color: root.accentColor
                    font.pixelSize: 12
                    font.bold: true
                    horizontalAlignment: Text.AlignHCenter
                }
            }
        }
    }
}
