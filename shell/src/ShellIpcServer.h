#pragma once

#include <QElapsedTimer>
#include <QLocalServer>
#include <QObject>
#include <QString>

class LauncherBridge;
class NotificationCenter;
class SystemControlBridge;
class SystemSettings;
class WindowManagerBridge;

class ShellIpcServer final : public QObject
{
    Q_OBJECT

public:
    ShellIpcServer(SystemSettings *settings,
                   WindowManagerBridge *wm,
                   LauncherBridge *launcher,
                   SystemControlBridge *sysControl,
                   NotificationCenter *notifications,
                   QObject *parent = nullptr);
    ~ShellIpcServer() override;

    bool startListening();
    QString socketPath() const { return m_socketPath; }

signals:
    void overlayToggleRequested(const QString &overlayName);

private:
    QByteArray handleCommand(const QByteArray &line);

    SystemSettings *m_settings = nullptr;
    WindowManagerBridge *m_wm = nullptr;
    LauncherBridge *m_launcher = nullptr;
    SystemControlBridge *m_sysControl = nullptr;
    NotificationCenter *m_notifications = nullptr;
    QLocalServer m_server;
    QString m_socketPath;
    QElapsedTimer m_uptime;
};
