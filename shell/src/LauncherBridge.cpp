#include "LauncherBridge.h"

#include <QProcess>

LauncherBridge::LauncherBridge(QObject *parent)
    : QObject(parent)
{
}

bool LauncherBridge::openApp(const QString &appId)
{
    QString program;
    if (appId == QStringLiteral("terminal")) {
        program = QStringLiteral("xterm");
    } else if (appId == QStringLiteral("files")) {
        program = QStringLiteral("pcmanfm");
    } else {
        emit appLaunchResult(appId, false);
        return false;
    }

    // Use a fixed executable and an empty argument list; never invoke a shell.
    const bool started = QProcess::startDetached(program, QStringList{});
    emit appLaunchResult(appId, started);
    return started;
}
