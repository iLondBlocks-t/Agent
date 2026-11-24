import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

ApplicationWindow {
    id: window
    objectName: "nrmaosShellWindow"
    visible: true
    visibility: Window.FullScreen
    title: "nrmaOS"
    color: darkTheme ? "#10141d" : "#edf1f7"

    property bool darkTheme: true
    property color panelColor: darkTheme ? "#1b2230" : "#ffffff"
    property color mainText: darkTheme ? "#f3f6fb" : "#172033"
    property color mutedText: darkTheme ? "#aab5c7" : "#637087"
    property color accentColor: darkTheme ? "#7c9cff" : "#496de2"
    property string launchMessage: "اختر تطبيقًا للبدء"

    Rectangle {
        id: topBar
        anchors.top: parent.top
        anchors.left: parent.left
        anchors.right: parent.right
        height: 68
        color: window.panelColor
        border.color: darkTheme ? "#293244" : "#e0e6ef"
        border.width: 1

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 28
            anchors.rightMargin: 28
            spacing: 16

            Rectangle {
                Layout.preferredWidth: 36
                Layout.preferredHeight: 36
                radius: 11
                color: window.accentColor
                Text {
                    anchors.centerIn: parent
                    text: "n"
                    color: "white"
                    font.pixelSize: 23
                    font.bold: true
                }
            }
            Text {
                text: "nrmaOS"
                color: window.mainText
                font.pixelSize: 18
                font.bold: true
            }
            Item { Layout.fillWidth: true }
            Text {
                text: "مساحة العمل"
                color: window.mutedText
                font.pixelSize: 14
            }
            Rectangle {
                Layout.preferredWidth: 1
                Layout.preferredHeight: 24
                color: darkTheme ? "#394356" : "#d9e0eb"
            }
            Text {
                id: clock
                text: Qt.formatDateTime(new Date(), "ddd  hh:mm")
                color: window.mainText
                font.pixelSize: 14
                Timer {
                    interval: 30000
                    running: true
                    repeat: true
                    onTriggered: clock.text = Qt.formatDateTime(new Date(), "ddd  hh:mm")
                }
            }
        }
    }

    ColumnLayout {
        anchors.top: topBar.bottom
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.margins: 36
        spacing: 20

        Item { Layout.fillHeight: true }

        Rectangle {
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: Math.min(680, window.width - 48)
            Layout.preferredHeight: 250
            radius: 24
            color: window.panelColor
            border.color: darkTheme ? "#293244" : "#e0e6ef"
            border.width: 1

            ColumnLayout {
                anchors.centerIn: parent
                spacing: 12
                Text {
                    Layout.alignment: Qt.AlignHCenter
                    text: "مرحبًا بك في nrmaOS"
                    color: window.mainText
                    font.pixelSize: 30
                    font.bold: true
                }
                Text {
                    Layout.alignment: Qt.AlignHCenter
                    text: "مساحة بسيطة لتطبيقاتك اليومية"
                    color: window.mutedText
                    font.pixelSize: 16
                }
                Text {
                    Layout.alignment: Qt.AlignHCenter
                    Layout.topMargin: 8
                    text: window.launchMessage
                    color: window.accentColor
                    font.pixelSize: 14
                }
            }
        }

        Item { Layout.fillHeight: true }

        Rectangle {
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: Math.min(690, window.width - 48)
            Layout.preferredHeight: 104
            radius: 24
            color: window.panelColor
            border.color: darkTheme ? "#293244" : "#e0e6ef"
            border.width: 1

            RowLayout {
                anchors.fill: parent
                anchors.margins: 14
                spacing: 12

                Button {
                    objectName: "terminalButton"
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    onClicked: launcher.openApp("terminal")
                    leftPadding: 16
                    background: Rectangle {
                        radius: 16
                        color: parent.down ? Qt.darker(window.accentColor, 1.15)
                                           : (parent.hovered ? (darkTheme ? "#293754" : "#edf1ff") : "transparent")
                    }
                    contentItem: Row {
                        spacing: 12
                        Rectangle {
                            width: 44; height: 44; radius: 14
                            anchors.verticalCenter: parent.verticalCenter
                            color: darkTheme ? "#293754" : "#edf1ff"
                            Text { anchors.centerIn: parent; text: ">_"; color: window.accentColor; font.pixelSize: 17; font.bold: true }
                        }
                        Column {
                            anchors.verticalCenter: parent.verticalCenter
                            Text { text: "Terminal"; color: window.mainText; font.pixelSize: 15; font.bold: true }
                            Text { text: "فتح الطرفية"; color: window.mutedText; font.pixelSize: 12 }
                        }
                    }
                }

                Rectangle { Layout.preferredWidth: 1; Layout.fillHeight: true; Layout.margins: 5; color: darkTheme ? "#394356" : "#e4e9f1" }

                Button {
                    objectName: "filesButton"
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    onClicked: launcher.openApp("files")
                    leftPadding: 16
                    background: Rectangle {
                        radius: 16
                        color: parent.down ? Qt.darker(window.accentColor, 1.15)
                                           : (parent.hovered ? (darkTheme ? "#293754" : "#edf1ff") : "transparent")
                    }
                    contentItem: Row {
                        spacing: 12
                        Rectangle {
                            width: 44; height: 44; radius: 14
                            anchors.verticalCenter: parent.verticalCenter
                            color: darkTheme ? "#293754" : "#edf1ff"
                            Text { anchors.centerIn: parent; text: "▰"; color: window.accentColor; font.pixelSize: 22 }
                        }
                        Column {
                            anchors.verticalCenter: parent.verticalCenter
                            Text { text: "Files"; color: window.mainText; font.pixelSize: 15; font.bold: true }
                            Text { text: "فتح الملفات"; color: window.mutedText; font.pixelSize: 12 }
                        }
                    }
                }

                Button {
                    objectName: "settingsButton"
                    Layout.preferredWidth: 58
                    Layout.fillHeight: true
                    Accessible.name: "تبديل المظهر"
                    onClicked: window.darkTheme = !window.darkTheme
                    background: Rectangle {
                        radius: 16
                        color: parent.down ? Qt.darker(window.accentColor, 1.15)
                                           : (parent.hovered ? (darkTheme ? "#293754" : "#edf1ff") : "transparent")
                    }
                    contentItem: Text {
                        text: window.darkTheme ? "☀" : "☾"
                        color: window.accentColor
                        font.pixelSize: 24
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                    }
                    ToolTip.visible: hovered
                    ToolTip.text: "تبديل المظهر الفاتح / الداكن"
                }
            }
        }

        Text {
            Layout.alignment: Qt.AlignHCenter
            text: "الإعدادات: زر الشمس/القمر يبدّل بين المظهرين الفاتح والداكن"
            color: window.mutedText
            font.pixelSize: 12
        }
    }

    Connections {
        target: launcher
        function onAppLaunchResult(appId, started) {
            if (started) {
                window.launchMessage = appId === "terminal" ? "تم تشغيل Terminal" : "تم تشغيل Files"
            } else {
                window.launchMessage = appId === "terminal"
                    ? "تعذر تشغيل xterm — تحقق من تثبيته"
                    : (appId === "files" ? "تعذر تشغيل pcmanfm — تحقق من تثبيته" : "تطبيق غير مسموح")
            }
        }
    }
}
