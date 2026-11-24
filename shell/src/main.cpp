#include "LauncherBridge.h"

#include <QDir>
#include <QFileInfo>
#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QUrl>

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);
    app.setApplicationName(QStringLiteral("nrmaOS Shell"));
    app.setOrganizationName(QStringLiteral("nrmaOS"));

    LauncherBridge launcher;
    QQmlApplicationEngine engine;
    engine.rootContext()->setContextProperty(QStringLiteral("launcher"), &launcher);

    const QString sourceQml = QDir(QStringLiteral(NRMAOS_SOURCE_QML_DIR)).filePath(QStringLiteral("Main.qml"));
    const QString installedQml = QDir(QStringLiteral(NRMAOS_INSTALL_QML_DIR)).filePath(QStringLiteral("Main.qml"));
    const QString qmlPath = QFileInfo::exists(sourceQml) ? sourceQml : installedQml;
    engine.load(QUrl::fromLocalFile(qmlPath));

    if (engine.rootObjects().isEmpty()) {
        return 1;
    }
    return app.exec();
}
