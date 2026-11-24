#pragma once

#include <QObject>
#include <QString>

class LauncherBridge final : public QObject
{
    Q_OBJECT

public:
    explicit LauncherBridge(QObject *parent = nullptr);

    // Accepts an application identifier, never a command line or executable path.
    Q_INVOKABLE bool openApp(const QString &appId);

signals:
    void appLaunchResult(const QString &appId, bool started);
};
