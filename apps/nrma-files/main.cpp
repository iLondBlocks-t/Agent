#include "FileManagerBridge.h"

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
    app.setApplicationName(QStringLiteral("nrma Files"));
    app.setOrganizationName(QStringLiteral("nrmaOS"));

    QCommandLineParser parser;
    parser.addHelpOption();
    QCommandLineOption selfTestOpt(QStringLiteral("self-test"), QStringLiteral("Verify QML load and exit"));
    parser.addOption(selfTestOpt);
    parser.addPositionalArgument(QStringLiteral("directory"), QStringLiteral("Initial directory"), QStringLiteral("[dir]"));
    parser.process(app);

    FileManagerBridge fm;
    if (!parser.positionalArguments().isEmpty()) {
        fm.setCurrentPath(parser.positionalArguments().first());
    }

    QQmlApplicationEngine engine;
    engine.rootContext()->setContextProperty(QStringLiteral("fm"), &fm);

    const QString srcQml = QStringLiteral(NRMAOS_FILES_SOURCE_QML);
    const QString instQml = QStringLiteral(NRMAOS_FILES_INSTALL_QML);
    engine.load(QUrl::fromLocalFile(QFileInfo::exists(srcQml) ? srcQml : instQml));

    if (engine.rootObjects().isEmpty()) {
        return 1;
    }
    if (parser.isSet(selfTestOpt)) {
        QTimer::singleShot(100, &app, &QCoreApplication::quit);
    }
    return app.exec();
}
