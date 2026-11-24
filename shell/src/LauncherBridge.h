#pragma once

#include <QMap>
#include <QObject>
#include <QString>
#include <QStringList>
#include <QVariantList>

class LauncherBridge final : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QVariantList applications READ applications NOTIFY applicationsChanged)

public:
    explicit LauncherBridge(QObject *parent = nullptr);

    QVariantList applications() const { return m_applications; }

    // Launches a registered application identifier directly via QProcess::startDetached (never a shell).
    Q_INVOKABLE bool openApp(const QString &appId);
    Q_INVOKABLE bool openSettingsPage(const QString &pageName);
    Q_INVOKABLE QVariantList searchApps(const QString &query) const;
    Q_INVOKABLE void refreshApplications();

signals:
    void appLaunchResult(const QString &appId, bool started);
    void applicationsChanged();

private:
    struct AppSpec {
        QString id;
        QString name;
        QString description;
        QString category;
        QString glyph;
        QString program;
        QString fallbackProgram;
        QStringList args;
        bool isWineApp = false;
    };

    void loadDesktopFilesFrom(const QString &dirPath);

    QMap<QString, AppSpec> m_registry;
    QVariantList m_applications;
};
