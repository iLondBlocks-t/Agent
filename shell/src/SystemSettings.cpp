#include "SystemSettings.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonDocument>
#include <QJsonObject>
#include <QSaveFile>
#include <QStandardPaths>
#include <QVariantMap>

SystemSettings::SystemSettings(QObject *parent)
    : QObject(parent)
{
    m_softwareRender = (qEnvironmentVariable("NRMAOS_SOFTWARE_RENDER") == QStringLiteral("1"));
    if (m_softwareRender) {
        m_reducedMotion = true;
    }

    reload();
    refreshWallpapers();

    const QFileInfo cfgInfo(configFilePath());
    QDir().mkpath(cfgInfo.absolutePath());
    if (!cfgInfo.exists()) {
        save();
    }
    m_watcher.addPath(cfgInfo.absolutePath());
    if (QFileInfo::exists(configFilePath())) {
        m_watcher.addPath(configFilePath());
    }

    connect(&m_watcher, &QFileSystemWatcher::fileChanged, this, [this](const QString &path) {
        reload();
        if (QFileInfo::exists(path) && !m_watcher.files().contains(path)) {
            m_watcher.addPath(path);
        }
    });
    connect(&m_watcher, &QFileSystemWatcher::directoryChanged, this, [this](const QString &) {
        const QString cfg = configFilePath();
        if (QFileInfo::exists(cfg) && !m_watcher.files().contains(cfg)) {
            m_watcher.addPath(cfg);
            reload();
        }
    });
}

QString SystemSettings::configFilePath() const
{
    const QString base = QStandardPaths::writableLocation(QStandardPaths::ConfigLocation);
    return QDir(base.isEmpty() ? QDir::homePath() + QStringLiteral("/.config") : base)
        .filePath(QStringLiteral("nrmaos/settings.json"));
}

void SystemSettings::reload()
{
    QFile file(configFilePath());
    if (!file.open(QIODevice::ReadOnly)) {
        return;
    }
    const QJsonDocument doc = QJsonDocument::fromJson(file.readAll());
    if (!doc.isObject()) {
        return;
    }
    const QJsonObject obj = doc.object();
    m_darkTheme = obj.value(QStringLiteral("darkTheme")).toBool(m_darkTheme);
    m_accentColor = obj.value(QStringLiteral("accentColor")).toString(m_accentColor);
    m_wallpaperPath = obj.value(QStringLiteral("wallpaperPath")).toString(m_wallpaperPath);
    m_reducedMotion = obj.value(QStringLiteral("reducedMotion")).toBool(m_reducedMotion);
    m_dockIconSize = qBound(38, obj.value(QStringLiteral("dockIconSize")).toInt(m_dockIconSize), 68);
    m_doNotDisturb = obj.value(QStringLiteral("doNotDisturb")).toBool(m_doNotDisturb);
    emit settingsChanged();
}

void SystemSettings::save() const
{
    const QString path = configFilePath();
    QDir().mkpath(QFileInfo(path).absolutePath());
    QSaveFile out(path);
    if (!out.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        return;
    }
    QJsonObject obj;
    obj.insert(QStringLiteral("darkTheme"), m_darkTheme);
    obj.insert(QStringLiteral("accentColor"), m_accentColor);
    obj.insert(QStringLiteral("wallpaperPath"), m_wallpaperPath);
    obj.insert(QStringLiteral("reducedMotion"), m_reducedMotion);
    obj.insert(QStringLiteral("dockIconSize"), m_dockIconSize);
    obj.insert(QStringLiteral("doNotDisturb"), m_doNotDisturb);
    out.write(QJsonDocument(obj).toJson(QJsonDocument::Indented));
    out.commit();
}

void SystemSettings::setDarkTheme(bool enabled)
{
    if (m_darkTheme == enabled) {
        return;
    }
    m_darkTheme = enabled;
    save();
    emit settingsChanged();
}

void SystemSettings::setAccentColor(const QString &color)
{
    if (color.isEmpty() || m_accentColor == color) {
        return;
    }
    m_accentColor = color;
    save();
    emit settingsChanged();
}

QString SystemSettings::wallpaperPath() const
{
    return QFileInfo::exists(m_wallpaperPath) ? m_wallpaperPath : QString();
}

void SystemSettings::setWallpaperPath(const QString &path)
{
    if (path.isEmpty() || m_wallpaperPath == path) {
        return;
    }
    m_wallpaperPath = path;
    save();
    emit settingsChanged();
}

void SystemSettings::setReducedMotion(bool enabled)
{
    if (m_reducedMotion == enabled) {
        return;
    }
    m_reducedMotion = enabled;
    save();
    emit settingsChanged();
}

void SystemSettings::setDockIconSize(int px)
{
    const int bounded = qBound(38, px, 68);
    if (m_dockIconSize == bounded) {
        return;
    }
    m_dockIconSize = bounded;
    save();
    emit settingsChanged();
}

void SystemSettings::setDoNotDisturb(bool enabled)
{
    if (m_doNotDisturb == enabled) {
        return;
    }
    m_doNotDisturb = enabled;
    save();
    emit settingsChanged();
}

void SystemSettings::refreshWallpapers()
{
    QVariantList items;
    const QStringList dirs = {
        QStringLiteral("/usr/share/nrmaos/wallpapers"),
        QDir::homePath() + QStringLiteral("/Pictures/Wallpapers")
    };
    for (const QString &dirPath : dirs) {
        QDir dir(dirPath);
        if (!dir.exists()) {
            continue;
        }
        const QFileInfoList files = dir.entryInfoList(
            {QStringLiteral("*.png"), QStringLiteral("*.jpg"), QStringLiteral("*.jpeg")},
            QDir::Files | QDir::Readable,
            QDir::Name);
        for (const QFileInfo &fi : files) {
            QVariantMap entry;
            QString label = fi.completeBaseName().replace(QLatin1Char('-'), QLatin1Char(' '));
            if (!label.isEmpty()) {
                label[0] = label[0].toUpper();
            }
            entry.insert(QStringLiteral("name"), label);
            entry.insert(QStringLiteral("path"), fi.absoluteFilePath());
            items.append(entry);
        }
    }
    m_wallpapers = items;
    emit wallpapersChanged();
}

bool SystemSettings::createDesktopFolder(const QString &folderName)
{
    const QString trimmed = folderName.trimmed();
    if (trimmed.isEmpty() || trimmed.contains(QLatin1Char('/')) || trimmed == QStringLiteral(".") || trimmed == QStringLiteral("..")) {
        return false;
    }
    QDir desktopDir(QDir::homePath() + QStringLiteral("/Desktop"));
    if (!desktopDir.exists()) {
        QDir().mkpath(desktopDir.absolutePath());
    }
    return desktopDir.mkdir(trimmed);
}
