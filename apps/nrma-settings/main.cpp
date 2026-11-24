#include "SettingsBackend.h"

#include <QCommandLineParser>
#include <QFileInfo>
#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QTimer>
#include <QUrl>

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);
    app.setApplicationName(QStringLiteral("nrma Settings"));
    app.setOrganizationName(QStringLiteral("nrmaOS"));

    QCommandLineParser parser;
    parser.addHelpOption();
    QCommandLineOption pageOpt(QStringLiteral("page"),
                               QStringLiteral("Initial settings section (appearance, wallpaper, display, remote-desktop, runtime, about)"),
                               QStringLiteral("section"),
                               QStringLiteral("appearance"));
    QCommandLineOption inspectOpt(QStringLiteral("inspect"),
                                  QStringLiteral("Executable path to inspect in nrma Runtime page"),
                                  QStringLiteral("exe"));
    QCommandLineOption selfTestOpt(QStringLiteral("self-test"),
                                   QStringLiteral("Verify QML load and exit"));
    parser.addOption(pageOpt);
    parser.addOption(inspectOpt);
    parser.addOption(selfTestOpt);
    parser.process(app);

    SettingsBackend backend;
    backend.setInitialPage(parser.value(pageOpt));
    if (parser.isSet(inspectOpt)) {
        backend.setInitialPage(QStringLiteral("runtime"));
        backend.inspectExecutable(parser.value(inspectOpt));
    }

    QQmlApplicationEngine engine;
    engine.rootContext()->setContextProperty(QStringLiteral("settings"), &backend);

    const QString srcQml = QStringLiteral(NRMAOS_SETTINGS_SOURCE_QML);
    const QString instQml = QStringLiteral(NRMAOS_SETTINGS_INSTALL_QML);
    engine.load(QUrl::fromLocalFile(QFileInfo::exists(srcQml) ? srcQml : instQml));

    if (engine.rootObjects().isEmpty()) {
        return 1;
    }
    if (parser.isSet(selfTestOpt)) {
        QTimer::singleShot(100, &app, &QCoreApplication::quit);
    }
    return app.exec();
}
