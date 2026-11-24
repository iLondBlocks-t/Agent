import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Rectangle {
    id: root
    property bool darkTheme: true
    property color accentColor: "#5e8bff"
    signal requestClose()

    width: 360
    height: 440
    radius: 22
    color: darkTheme ? "#f0161e2e" : "#f5ffffff"
    border.color: darkTheme ? "#357c9cff" : "#241e293b"
    border.width: 1

    MouseArea { anchors.fill: parent }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 18
        spacing: 12

        RowLayout {
            Layout.fillWidth: true
            Text {
                text: "nrma Notifications"
                color: root.darkTheme ? "#f3f6fc" : "#151e30"
                font.pixelSize: 15
                font.bold: true
            }
            Item { Layout.fillWidth: true }
            Button {
                visible: notificationCenter.notifications.length > 0
                text: "Clear All"
                onClicked: notificationCenter.clearAll()
            }
        }

        ListView {
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            spacing: 8
            model: notificationCenter.notifications

            delegate: Rectangle {
                width: ListView.view.width
                radius: 14
                color: root.darkTheme ? "#202b40" : "#edf2fb"
                border.color: modelData.urgency === "critical" ? "#ef4444" : (root.darkTheme ? "#2e3c59" : "#d8e2f3")
                border.width: 1
                implicitHeight: itemCol.implicitHeight + 20

                ColumnLayout {
                    id: itemCol
                    anchors.fill: parent
                    anchors.margins: 10
                    spacing: 4

                    RowLayout {
                        Layout.fillWidth: true
                        Text {
                            Layout.fillWidth: true
                            text: modelData.title
                            color: root.darkTheme ? "#f3f6fc" : "#151e30"
                            font.pixelSize: 13
                            font.bold: true
                            elide: Text.ElideRight
                        }
                        Text {
                            text: modelData.timestamp
                            color: root.darkTheme ? "#8b9ab5" : "#64738f"
                            font.pixelSize: 11
                        }
                        MouseArea {
                            width: 20
                            height: 20
                            cursorShape: Qt.PointingHandCursor
                            onClicked: notificationCenter.dismissNotification(modelData.id)
                            Text {
                                anchors.centerIn: parent
                                text: "✕"
                                color: root.darkTheme ? "#94a3bd" : "#5e6d87"
                                font.pixelSize: 11
                            }
                        }
                    }

                    Text {
                        visible: (modelData.body || "").length > 0
                        Layout.fillWidth: true
                        text: modelData.body
                        color: root.darkTheme ? "#b6c2d9" : "#44526b"
                        font.pixelSize: 12
                        wrapMode: Text.WordWrap
                    }
                }
            }

            Text {
                anchors.centerIn: parent
                visible: notificationCenter.notifications.length === 0
                text: "No notifications"
                color: root.darkTheme ? "#7f8ea8" : "#6c7a94"
                font.pixelSize: 14
            }
        }
    }
}
