#include "ShellIpcServer.h"

#include "LauncherBridge.h"
#include "NotificationCenter.h"
#include "SystemControlBridge.h"
#include "SystemSettings.h"
#include "WindowManagerBridge.h"

#include <QDir>
#include <QFile>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLocalSocket>

#include <sys/stat.h>
#include <unistd.h>

ShellIpcServer::ShellIpcServer(SystemSettings *settings,
                               WindowManagerBridge *wm,
                               LauncherBridge *launcher,
                               SystemControlBridge *sysControl,
                               NotificationCenter *notifications,
                               QObject *parent)
    : QObject(parent)
    , m_settings(settings)
    , m_wm(wm)
    , m_launcher(launcher)
    , m_sysControl(sysControl)
    , m_notifications(notifications)
{
    m_uptime.start();
    connect(&m_server, &QLocalServer::newConnection, this, [this]() {
        while (QLocalSocket *client = m_server.nextPendingConnection()) {
            connect(client, &QLocalSocket::readyRead, this, [this, client]() {
                while (client->canReadLine()) {
                    const QByteArray req = client->readLine().trimmed();
                    const QByteArray resp = handleCommand(req) + "\n";
                    client->write(resp);
                    client->flush();
                }
            });
            connect(client, &QLocalSocket::disconnected, client, &QObject::deleteLater);
        }
    });
}

ShellIpcServer::~ShellIpcServer()
{
    m_server.close();
    if (!m_socketPath.isEmpty()) {
        QLocalServer::removeServer(m_socketPath);
    }
}

bool ShellIpcServer::startListening()
{
    const QString ipcDir = QStringLiteral("/tmp/nrmaos-ipc-%1").arg(static_cast<qulonglong>(::getuid()));
    QDir().mkpath(ipcDir);
    ::chmod(ipcDir.toUtf8().constData(), 0700);

    m_socketPath = ipcDir + QStringLiteral("/shell.sock");
    QLocalServer::removeServer(m_socketPath);
    m_server.setSocketOptions(QLocalServer::UserAccessOption);
    return m_server.listen(m_socketPath);
}

QByteArray ShellIpcServer::handleCommand(const QByteArray &line)
{
    const QJsonDocument reqDoc = QJsonDocument::fromJson(line);
    if (!reqDoc.isObject()) {
        QJsonObject err{{QStringLiteral("ok"), false}, {QStringLiteral("error"), QStringLiteral("invalid json")}};
        return QJsonDocument(err).toJson(QJsonDocument::Compact);
    }

    const QJsonObject req = reqDoc.object();
    const QString cmd = req.value(QStringLiteral("cmd")).toString();
    QJsonObject resp;
    resp.insert(QStringLiteral("ok"), true);

    if (cmd == QStringLiteral("status")) {
        m_wm->refresh();
        resp.insert(QStringLiteral("uptime_ms"), static_cast<qint64>(m_uptime.elapsed()));
        resp.insert(QStringLiteral("dark_theme"), m_settings->darkTheme());
        resp.insert(QStringLiteral("wallpaper"), m_settings->wallpaperPath());
        resp.insert(QStringLiteral("software_render"), m_settings->softwareRender());
        resp.insert(QStringLiteral("active_window"), m_wm->activeWindowTitle());
        resp.insert(QStringLiteral("window_count"), m_wm->windowCount());
        resp.insert(QStringLiteral("windows"), QJsonArray::fromVariantList(m_wm->windows()));
        resp.insert(QStringLiteral("app_count"), m_launcher->applications().size());
        resp.insert(QStringLiteral("unread_notifications"), m_notifications->unreadCount());
        resp.insert(QStringLiteral("rdp_active"), m_sysControl->rdpActive());
        resp.insert(QStringLiteral("local_ip"), m_sysControl->localIp());
    } else if (cmd == QStringLiteral("launch")) {
        const QString appId = req.value(QStringLiteral("app")).toString();
        const bool started = m_launcher->openApp(appId);
        resp.insert(QStringLiteral("ok"), started);
        resp.insert(QStringLiteral("app"), appId);
    } else if (cmd == QStringLiteral("toggle-overlay")) {
        const QString name = req.value(QStringLiteral("overlay")).toString();
        emit overlayToggleRequested(name);
        resp.insert(QStringLiteral("overlay"), name);
    } else if (cmd == QStringLiteral("notify")) {
        const int id = m_notifications->postNotification(
            req.value(QStringLiteral("title")).toString(),
            req.value(QStringLiteral("body")).toString(),
            req.value(QStringLiteral("urgency")).toString(QStringLiteral("normal")));
        resp.insert(QStringLiteral("id"), id);
    } else if (cmd == QStringLiteral("reload-settings")) {
        m_settings->reload();
        m_settings->refreshWallpapers();
        m_launcher->refreshApplications();
    } else if (cmd == QStringLiteral("set-theme")) {
        const QString mode = req.value(QStringLiteral("mode")).toString();
        m_settings->setDarkTheme(mode != QStringLiteral("light"));
    } else if (cmd == QStringLiteral("set-wallpaper")) {
        m_settings->setWallpaperPath(req.value(QStringLiteral("path")).toString());
    } else if (cmd == QStringLiteral("tile")) {
        const qulonglong xid = static_cast<qulonglong>(req.value(QStringLiteral("xid")).toVariant().toULongLong());
        const QString pos = req.value(QStringLiteral("position")).toString();
        resp.insert(QStringLiteral("ok"), m_wm->tileWindow(xid, pos));
    } else {
        resp.insert(QStringLiteral("ok"), false);
        resp.insert(QStringLiteral("error"), QStringLiteral("unknown command: ") + cmd);
    }

    return QJsonDocument(resp).toJson(QJsonDocument::Compact);
}
