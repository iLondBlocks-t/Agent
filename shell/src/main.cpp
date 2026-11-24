#include "LauncherBridge.h"
#include "NotificationCenter.h"
#include "ShellIpcServer.h"
#include "SystemControlBridge.h"
#include "SystemSettings.h"
#include "WindowManagerBridge.h"

#include <QCommandLineParser>
#include <QDir>
#include <QFileInfo>
#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QTimer>
#include <QUrl>

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);
    app.setApplicationName(QStringLiteral("nrmaOS Shell"));
    app.setApplicationVersion(QStringLiteral("0.1.0"));
    app.setOrganizationName(QStringLiteral("nrmaOS"));

    QCommandLineParser parser;
    parser.setApplicationDescription(QStringLiteral("nrmaOS Desktop Environment Shell"));
    parser.addHelpOption();
    parser.addVersionOption();
    QCommandLineOption selfTestOpt(QStringLiteral("self-test"),
                                   QStringLiteral("Load QML scene, verify root objects, and exit 0"));
    parser.addOption(selfTestOpt);
    parser.process(app);

    SystemSettings settings;
    WindowManagerBridge windowManager;
    LauncherBridge launcher;
    SystemControlBridge sysControl;
    NotificationCenter notifications(&settings);
    ShellIpcServer ipc(&settings, &windowManager, &launcher, &sysControl, &notifications);
    ipc.startListening();

    QQmlApplicationEngine engine;
    engine.rootContext()->setContextProperty(QStringLiteral("systemSettings"), &settings);
    engine.rootContext()->setContextProperty(QStringLiteral("windowManager"), &windowManager);
    engine.rootContext()->setContextProperty(QStringLiteral("launcher"), &launcher);
    engine.rootContext()->setContextProperty(QStringLiteral("systemControl"), &sysControl);
    engine.rootContext()->setContextProperty(QStringLiteral("notificationCenter"), &notifications);
    engine.rootContext()->setContextProperty(QStringLiteral("shellIpc"), &ipc);

    const QString sourceQml = QDir(QStringLiteral(NRMAOS_SOURCE_QML_DIR)).filePath(QStringLiteral("Main.qml"));
    const QString installedQml = QDir(QStringLiteral(NRMAOS_INSTALL_QML_DIR)).filePath(QStringLiteral("Main.qml"));
    const QString qmlPath = QFileInfo::exists(sourceQml) ? sourceQml : installedQml;
    engine.load(QUrl::fromLocalFile(qmlPath));

    if (engine.rootObjects().isEmpty()) {
        return 1;
    }

    if (parser.isSet(selfTestOpt)) {
        QTimer::singleShot(120, &app, &QCoreApplication::quit);
    }

    return app.exec();
}
