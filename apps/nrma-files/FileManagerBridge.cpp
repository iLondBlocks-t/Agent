#include "FileManagerBridge.h"

#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonDocument>
#include <QJsonObject>
#include <QMimeDatabase>
#include <QProcess>
#include <QStandardPaths>
#include <QStorageInfo>
#include <QUrl>
#include <QDesktopServices>
#include <QVariantMap>

namespace {
QString formatBytes(qint64 bytes)
{
    if (bytes < 1024) {
        return QStringLiteral("%1 B").arg(bytes);
    }
    if (bytes < 1024 * 1024) {
        return QStringLiteral("%1 KiB").arg(bytes / 1024.0, 0, 'f', 1);
    }
    if (bytes < 1024LL * 1024LL * 1024LL) {
        return QStringLiteral("%1 MiB").arg(bytes / (1024.0 * 1024.0), 0, 'f', 1);
    }
    return QStringLiteral("%1 GiB").arg(bytes / (1024.0 * 1024.0 * 1024.0), 0, 'f', 2);
}
} // namespace

FileManagerBridge::FileManagerBridge(QObject *parent)
    : QObject(parent)
    , m_currentPath(QDir::homePath())
{
    loadThemePreference();

    const QString home = QDir::homePath();
    QDir().mkpath(home + QStringLiteral("/Desktop"));
    QDir().mkpath(home + QStringLiteral("/Documents"));
    QDir().mkpath(home + QStringLiteral("/Downloads"));

    const QList<QPair<QString, QString>> rawPlaces = {
        {QStringLiteral("Home"), home},
        {QStringLiteral("Desktop"), home + QStringLiteral("/Desktop")},
        {QStringLiteral("Documents"), home + QStringLiteral("/Documents")},
        {QStringLiteral("Downloads"), home + QStringLiteral("/Downloads")},
        {QStringLiteral("Wine Prefixes"), home + QStringLiteral("/.local/share/nrma-runtime/prefixes")},
        {QStringLiteral("System Root"), QStringLiteral("/")}
    };
    for (const auto &pair : rawPlaces) {
        QVariantMap item;
        item.insert(QStringLiteral("label"), pair.first);
        item.insert(QStringLiteral("path"), pair.second);
        m_places.append(item);
    }

    refresh();
}

void FileManagerBridge::loadThemePreference()
{
    const QString base = QStandardPaths::writableLocation(QStandardPaths::ConfigLocation);
    const QString cfgPath = QDir(base.isEmpty() ? QDir::homePath() + QStringLiteral("/.config") : base)
                                .filePath(QStringLiteral("nrmaos/settings.json"));
    QFile file(cfgPath);
    if (file.open(QIODevice::ReadOnly)) {
        const QJsonDocument doc = QJsonDocument::fromJson(file.readAll());
        if (doc.isObject()) {
            m_darkTheme = doc.object().value(QStringLiteral("darkTheme")).toBool(true);
        }
    }
}

void FileManagerBridge::setStatus(const QString &msg)
{
    m_statusMessage = msg;
    emit statusChanged();
}

void FileManagerBridge::setCurrentPath(const QString &path)
{
    QFileInfo fi(path.trimmed());
    if (!fi.exists() || !fi.isDir()) {
        setStatus(QStringLiteral("Directory not found: ") + path);
        return;
    }
    const QString clean = fi.canonicalFilePath().isEmpty() ? fi.absoluteFilePath() : fi.canonicalFilePath();
    if (clean == m_currentPath) {
        return;
    }
    m_currentPath = clean;
    m_filterQuery.clear();
    refresh();
}

void FileManagerBridge::setFilterQuery(const QString &query)
{
    if (m_filterQuery == query) {
        return;
    }
    m_filterQuery = query;
    refresh();
}

void FileManagerBridge::refresh()
{
    loadThemePreference();
    emit themeChanged();

    QDir dir(m_currentPath);
    if (!dir.exists()) {
        dir = QDir(QDir::homePath());
        m_currentPath = dir.absolutePath();
    }

    m_entries.clear();
    QMimeDatabase mimeDb;
    const QFileInfoList list = dir.entryInfoList(
        QDir::Dirs | QDir::Files | QDir::NoDotAndDotDot,
        QDir::DirsFirst | QDir::IgnoreCase | QDir::Name);

    for (const QFileInfo &fi : list) {
        if (!m_filterQuery.trimmed().isEmpty()
            && !fi.fileName().contains(m_filterQuery.trimmed(), Qt::CaseInsensitive)) {
            continue;
        }
        const QString ext = fi.suffix().toLower();
        const bool isExe = !fi.isDir() && (ext == QStringLiteral("exe") || ext == QStringLiteral("msi"));

        QVariantMap map;
        map.insert(QStringLiteral("name"), fi.fileName());
        map.insert(QStringLiteral("path"), fi.absoluteFilePath());
        map.insert(QStringLiteral("isDir"), fi.isDir());
        map.insert(QStringLiteral("isExe"), isExe);
        map.insert(QStringLiteral("sizeText"), fi.isDir() ? QStringLiteral("Folder") : formatBytes(fi.size()));
        map.insert(QStringLiteral("modified"), fi.lastModified().toString(QStringLiteral("yyyy-MM-dd HH:mm")));
        map.insert(QStringLiteral("mime"), fi.isDir() ? QStringLiteral("inode/directory")
                                                      : mimeDb.mimeTypeForFile(fi).name());
        m_entries.append(map);
    }

    QStorageInfo storage(m_currentPath);
    if (storage.isValid() && storage.bytesTotal() > 0) {
        const qint64 used = storage.bytesTotal() - storage.bytesAvailable();
        m_storageRatio = qBound(0.0, static_cast<double>(used) / static_cast<double>(storage.bytesTotal()), 1.0);
        m_storageSummary = QStringLiteral("%1 free of %2")
                               .arg(formatBytes(storage.bytesAvailable()), formatBytes(storage.bytesTotal()));
    } else {
        m_storageRatio = 0.0;
        m_storageSummary = QStringLiteral("Live filesystem");
    }

    emit directoryChanged();
}

void FileManagerBridge::goUp()
{
    QDir dir(m_currentPath);
    if (dir.cdUp()) {
        setCurrentPath(dir.absolutePath());
    }
}

void FileManagerBridge::goHome()
{
    setCurrentPath(QDir::homePath());
}

bool FileManagerBridge::openEntry(const QString &path)
{
    QFileInfo fi(path);
    if (!fi.exists()) {
        return false;
    }
    if (fi.isDir()) {
        setCurrentPath(fi.absoluteFilePath());
        return true;
    }
    const QString ext = fi.suffix().toLower();
    if (ext == QStringLiteral("exe") || ext == QStringLiteral("msi")) {
        return openWithRuntime(fi.absoluteFilePath());
    }
    return QDesktopServices::openUrl(QUrl::fromLocalFile(fi.absoluteFilePath()));
}

bool FileManagerBridge::openWithRuntime(const QString &path)
{
    const QString rtBin = QStandardPaths::findExecutable(QStringLiteral("nrma-runtime"));
    if (rtBin.isEmpty()) {
        setStatus(QStringLiteral("nrma-runtime is not installed"));
        return false;
    }
    const bool ok = QProcess::startDetached(rtBin, {QStringLiteral("run"), QStringLiteral("--prefix"), QStringLiteral("default"), path});
    setStatus(ok ? (QStringLiteral("Started in nrma Runtime: ") + QFileInfo(path).fileName())
                 : QStringLiteral("Failed launching nrma Runtime"));
    return ok;
}

bool FileManagerBridge::inspectInRuntime(const QString &path)
{
    const QString settingsBin = QStandardPaths::findExecutable(QStringLiteral("nrma-settings"));
    if (settingsBin.isEmpty()) {
        return false;
    }
    return QProcess::startDetached(settingsBin, {QStringLiteral("--page"), QStringLiteral("runtime"), QStringLiteral("--inspect"), path});
}

bool FileManagerBridge::createExeShortcut(const QString &path)
{
    const QString rtBin = QStandardPaths::findExecutable(QStringLiteral("nrma-runtime"));
    if (rtBin.isEmpty()) {
        return false;
    }
    const QFileInfo fi(path);
    QProcess proc;
    proc.start(rtBin, {QStringLiteral("create-shortcut"), fi.absoluteFilePath(), QStringLiteral("--name"), fi.completeBaseName()});
    if (proc.waitForFinished(4000) && proc.exitCode() == 0) {
        setStatus(QStringLiteral("Added App Launcher shortcut for ") + fi.completeBaseName());
        return true;
    }
    setStatus(QStringLiteral("Could not create launcher shortcut"));
    return false;
}

bool FileManagerBridge::createFolder(const QString &name)
{
    const QString trimmed = name.trimmed();
    if (trimmed.isEmpty() || trimmed.contains(QLatin1Char('/')) || trimmed == QStringLiteral(".") || trimmed == QStringLiteral("..")) {
        setStatus(QStringLiteral("Invalid folder name"));
        return false;
    }
    QDir dir(m_currentPath);
    if (dir.mkdir(trimmed)) {
        setStatus(QStringLiteral("Created folder: ") + trimmed);
        refresh();
        return true;
    }
    setStatus(QStringLiteral("Failed to create folder"));
    return false;
}

bool FileManagerBridge::renameItem(const QString &path, const QString &newName)
{
    const QString trimmed = newName.trimmed();
    if (trimmed.isEmpty() || trimmed.contains(QLatin1Char('/'))) {
        return false;
    }
    QFileInfo fi(path);
    const QString dst = fi.dir().filePath(trimmed);
    if (QFile::rename(fi.absoluteFilePath(), dst)) {
        setStatus(QStringLiteral("Renamed to ") + trimmed);
        refresh();
        return true;
    }
    setStatus(QStringLiteral("Rename failed"));
    return false;
}

bool FileManagerBridge::deleteItem(const QString &path)
{
    QFileInfo fi(path);
    if (!fi.exists() || fi.canonicalFilePath() == QStringLiteral("/") || fi.canonicalFilePath() == QDir::homePath()) {
        setStatus(QStringLiteral("Refusing to delete protected directory"));
        return false;
    }
    bool ok = false;
    if (fi.isDir()) {
        ok = QDir(fi.absoluteFilePath()).removeRecursively();
    } else {
        ok = QFile::remove(fi.absoluteFilePath());
    }
    if (ok) {
        setStatus(QStringLiteral("Deleted ") + fi.fileName());
        refresh();
    } else {
        setStatus(QStringLiteral("Delete failed (permission denied)"));
    }
    return ok;
}

void FileManagerBridge::copyItem(const QString &path)
{
    m_clipboardPath = path;
    setStatus(QStringLiteral("Copied ") + QFileInfo(path).fileName());
}

bool FileManagerBridge::pasteClipboard()
{
    if (m_clipboardPath.isEmpty()) {
        return false;
    }
    QFileInfo src(m_clipboardPath);
    if (!src.exists() || src.isDir()) {
        setStatus(QStringLiteral("Clipboard file unavailable"));
        return false;
    }
    QString dst = QDir(m_currentPath).filePath(src.fileName());
    if (QFileInfo::exists(dst)) {
        dst = QDir(m_currentPath).filePath(src.completeBaseName() + QStringLiteral("-copy.") + src.suffix());
    }
    if (QFile::copy(src.absoluteFilePath(), dst)) {
        setStatus(QStringLiteral("Pasted ") + QFileInfo(dst).fileName());
        refresh();
        return true;
    }
    setStatus(QStringLiteral("Paste failed"));
    return false;
}
