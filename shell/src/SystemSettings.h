#pragma once

#include <QFileSystemWatcher>
#include <QObject>
#include <QString>
#include <QVariantList>

class SystemSettings final : public QObject
{
    Q_OBJECT
    Q_PROPERTY(bool darkTheme READ darkTheme WRITE setDarkTheme NOTIFY settingsChanged)
    Q_PROPERTY(QString accentColor READ accentColor WRITE setAccentColor NOTIFY settingsChanged)
    Q_PROPERTY(QString wallpaperPath READ wallpaperPath WRITE setWallpaperPath NOTIFY settingsChanged)
    Q_PROPERTY(bool reducedMotion READ reducedMotion WRITE setReducedMotion NOTIFY settingsChanged)
    Q_PROPERTY(bool softwareRender READ softwareRender CONSTANT)
    Q_PROPERTY(int dockIconSize READ dockIconSize WRITE setDockIconSize NOTIFY settingsChanged)
    Q_PROPERTY(bool doNotDisturb READ doNotDisturb WRITE setDoNotDisturb NOTIFY settingsChanged)
    Q_PROPERTY(QVariantList availableWallpapers READ availableWallpapers NOTIFY wallpapersChanged)

public:
    explicit SystemSettings(QObject *parent = nullptr);

    bool darkTheme() const { return m_darkTheme; }
    void setDarkTheme(bool enabled);

    QString accentColor() const { return m_accentColor; }
    void setAccentColor(const QString &color);

    QString wallpaperPath() const { return m_wallpaperPath; }
    void setWallpaperPath(const QString &path);

    bool reducedMotion() const { return m_reducedMotion; }
    void setReducedMotion(bool enabled);

    bool softwareRender() const { return m_softwareRender; }

    int dockIconSize() const { return m_dockIconSize; }
    void setDockIconSize(int px);

    bool doNotDisturb() const { return m_doNotDisturb; }
    void setDoNotDisturb(bool enabled);

    QVariantList availableWallpapers() const { return m_wallpapers; }

    Q_INVOKABLE void reload();
    Q_INVOKABLE void refreshWallpapers();
    Q_INVOKABLE bool createDesktopFolder(const QString &folderName);

signals:
    void settingsChanged();
    void wallpapersChanged();

private:
    QString configFilePath() const;
    void save() const;

    bool m_darkTheme = true;
    QString m_accentColor = QStringLiteral("#5e8bff");
    QString m_wallpaperPath = QStringLiteral("/usr/share/nrmaos/wallpapers/aurora-dark.png");
    bool m_reducedMotion = false;
    bool m_softwareRender = false;
    int m_dockIconSize = 48;
    bool m_doNotDisturb = false;
    QVariantList m_wallpapers;
    QFileSystemWatcher m_watcher;
};
