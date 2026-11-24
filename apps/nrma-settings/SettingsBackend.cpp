#include "SettingsBackend.h"

#include <QClipboard>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QGuiApplication>
#include <QJsonDocument>
#include <QJsonObject>
#include <QProcess>
#include <QRegularExpression>
#include <QSaveFile>
#include <QStandardPaths>
#include <QSysInfo>

#include <unistd.h>

SettingsBackend::SettingsBackend(QObject *parent)
    : QObject(parent)
{
    loadAppearance();
    loadWallpapers();
    loadAboutInfo();
    refreshDisplayModes();
    refreshRdpStatus();
    refreshRuntimeStatus();
}

void SettingsBackend::setInitialPage(const QString &page)
{
    if (m_initialPage == page) {
        return;
    }
    m_initialPage = page;
    emit initialPageChanged();
}

void SettingsBackend::setFeedback(const QString &msg)
{
    m_feedbackMessage = msg;
    emit feedbackChanged();
}

QString SettingsBackend::configPath() const
{
    const QString base = QStandardPaths::writableLocation(QStandardPaths::ConfigLocation);
    return QDir(base.isEmpty() ? QDir::homePath() + QStringLiteral("/.config") : base)
        .filePath(QStringLiteral("nrmaos/settings.json"));
}

void SettingsBackend::loadAppearance()
{
    QFile file(configPath());
    if (!file.open(QIODevice::ReadOnly)) {
        return;
    }
    const QJsonDocument doc = QJsonDocument::fromJson(file.readAll());
    if (!doc.isObject()) {
        return;
    }
    const QJsonObject o = doc.object();
    m_darkTheme = o.value(QStringLiteral("darkTheme")).toBool(true);
    m_accentColor = o.value(QStringLiteral("accentColor")).toString(QStringLiteral("#5e8bff"));
    m_wallpaperPath = o.value(QStringLiteral("wallpaperPath")).toString(m_wallpaperPath);
    m_reducedMotion = o.value(QStringLiteral("reducedMotion")).toBool(false);
    m_dockIconSize = qBound(38, o.value(QStringLiteral("dockIconSize")).toInt(48), 68);
}

void SettingsBackend::saveAppearanceAndNotifyShell()
{
    QJsonObject existing;
    {
        QFile in(configPath());
        if (in.open(QIODevice::ReadOnly)) {
            const QJsonDocument doc = QJsonDocument::fromJson(in.readAll());
            if (doc.isObject()) {
                existing = doc.object();
            }
        }
    }
    existing.insert(QStringLiteral("darkTheme"), m_darkTheme);
    existing.insert(QStringLiteral("accentColor"), m_accentColor);
    existing.insert(QStringLiteral("wallpaperPath"), m_wallpaperPath);
    existing.insert(QStringLiteral("reducedMotion"), m_reducedMotion);
    existing.insert(QStringLiteral("dockIconSize"), m_dockIconSize);

    QDir().mkpath(QFileInfo(configPath()).absolutePath());
    QSaveFile out(configPath());
    if (out.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        out.write(QJsonDocument(existing).toJson(QJsonDocument::Indented));
        out.commit();
    }

    const QString shellctl = QStandardPaths::findExecutable(QStringLiteral("nrma-shellctl"));
    if (!shellctl.isEmpty()) {
        QProcess::startDetached(shellctl, {QStringLiteral("reload-settings")});
    }
}

void SettingsBackend::setDarkTheme(bool enabled)
{
    if (m_darkTheme == enabled) {
        return;
    }
    m_darkTheme = enabled;
    saveAppearanceAndNotifyShell();
    emit appearanceChanged();
}

void SettingsBackend::setAccentColor(const QString &color)
{
    if (color.isEmpty() || m_accentColor == color) {
        return;
    }
    m_accentColor = color;
    saveAppearanceAndNotifyShell();
    emit appearanceChanged();
}

void SettingsBackend::setWallpaperPath(const QString &path)
{
    if (path.isEmpty() || m_wallpaperPath == path) {
        return;
    }
    m_wallpaperPath = path;
    saveAppearanceAndNotifyShell();
    setFeedback(QStringLiteral("Applied wallpaper: ") + QFileInfo(path).fileName());
    emit appearanceChanged();
}

void SettingsBackend::setReducedMotion(bool enabled)
{
    if (m_reducedMotion == enabled) {
        return;
    }
    m_reducedMotion = enabled;
    saveAppearanceAndNotifyShell();
    emit appearanceChanged();
}

void SettingsBackend::setDockIconSize(int px)
{
    const int bounded = qBound(38, px, 68);
    if (m_dockIconSize == bounded) {
        return;
    }
    m_dockIconSize = bounded;
    saveAppearanceAndNotifyShell();
    emit appearanceChanged();
}

void SettingsBackend::loadWallpapers()
{
    m_wallpapers.clear();
    const QStringList dirs = {
        QStringLiteral("/usr/share/nrmaos/wallpapers"),
        QDir::homePath() + QStringLiteral("/Pictures/Wallpapers")
    };
    for (const QString &d : dirs) {
        QDir dir(d);
        if (!dir.exists()) {
            continue;
        }
        const QFileInfoList files = dir.entryInfoList(
            {QStringLiteral("*.png"), QStringLiteral("*.jpg"), QStringLiteral("*.jpeg")},
            QDir::Files | QDir::Readable,
            QDir::Name);
        for (const QFileInfo &fi : files) {
            QVariantMap item;
            QString title = fi.completeBaseName().replace(QLatin1Char('-'), QLatin1Char(' '));
            if (!title.isEmpty()) {
                title[0] = title[0].toUpper();
            }
            item.insert(QStringLiteral("name"), title);
            item.insert(QStringLiteral("path"), fi.absoluteFilePath());
            m_wallpapers.append(item);
        }
    }
    emit wallpapersChanged();
}

void SettingsBackend::loadAboutInfo()
{
    QString cpuModel = QSysInfo::currentCpuArchitecture();
    QFile cpuFile(QStringLiteral("/proc/cpuinfo"));
    if (cpuFile.open(QIODevice::ReadOnly | QIODevice::Text)) {
        while (!cpuFile.atEnd()) {
            const QString line = QString::fromUtf8(cpuFile.readLine());
            if (line.startsWith(QStringLiteral("model name"))) {
                cpuModel = line.section(QLatin1Char(':'), 1).trimmed();
                break;
            }
        }
    }

    QString totalMem = QStringLiteral("Unknown");
    QFile memFile(QStringLiteral("/proc/meminfo"));
    if (memFile.open(QIODevice::ReadOnly | QIODevice::Text)) {
        while (!memFile.atEnd()) {
            const QString line = QString::fromUtf8(memFile.readLine());
            if (line.startsWith(QStringLiteral("MemTotal:"))) {
                const qint64 kib = line.simplified().section(QLatin1Char(' '), 1, 1).toLongLong();
                totalMem = QStringLiteral("%1 MiB").arg(kib / 1024);
                break;
            }
        }
    }

    QString debianBase = QSysInfo::prettyProductName();
    m_aboutInfo.insert(QStringLiteral("osName"), QStringLiteral("nrmaOS 0.1.0 (Atlas)"));
    m_aboutInfo.insert(QStringLiteral("hostname"), QSysInfo::machineHostName());
    m_aboutInfo.insert(QStringLiteral("kernel"), QSysInfo::kernelVersion());
    m_aboutInfo.insert(QStringLiteral("debianBase"), debianBase);
    m_aboutInfo.insert(QStringLiteral("qtVersion"), QString::fromLatin1(qVersion()));
    m_aboutInfo.insert(QStringLiteral("cpu"), cpuModel);
    m_aboutInfo.insert(QStringLiteral("memory"), totalMem);
    m_aboutInfo.insert(QStringLiteral("sessionType"),
                       qEnvironmentVariable("XRDP_SESSION") == QStringLiteral("1")
                           ? QStringLiteral("Xorg (Remote Desktop / xorgxrdp)")
                           : QStringLiteral("Xorg (Local Session + Openbox)"));
}

void SettingsBackend::refreshAll()
{
    loadAppearance();
    loadWallpapers();
    refreshDisplayModes();
    refreshRdpStatus();
    refreshRuntimeStatus();
    emit appearanceChanged();
}

void SettingsBackend::refreshDisplayModes()
{
    if (QGuiApplication::platformName() != QStringLiteral("xcb")) {
        return;
    }
    const QString xrandr = QStandardPaths::findExecutable(QStringLiteral("xrandr"));
    if (xrandr.isEmpty()) {
        return;
    }
    QProcess proc;
    proc.start(xrandr, {QStringLiteral("--query")});
    if (!proc.waitForFinished(1500) || proc.exitCode() != 0) {
        return;
    }
    const QStringList lines = QString::fromUtf8(proc.readAllStandardOutput()).split(QLatin1Char('\n'));
    QString outName;
    QString current;
    QStringList modes;
    static const QRegularExpression re(QStringLiteral("^\\s+(\\d+x\\d+)\\s+.*"));

    for (const QString &ln : lines) {
        if (ln.contains(QStringLiteral(" connected"))) {
            if (outName.isEmpty()) {
                outName = ln.section(QLatin1Char(' '), 0, 0).trimmed();
            } else {
                break;
            }
            continue;
        }
        if (!outName.isEmpty()) {
            const auto m = re.match(ln);
            if (m.hasMatch()) {
                const QString res = m.captured(1);
                if (!modes.contains(res) && modes.size() < 10) {
                    modes.append(res);
                }
                if (ln.contains(QLatin1Char('*'))) {
                    current = res;
                }
            }
        }
    }
    m_primaryOutput = outName;
    m_currentResolution = current;
    m_availableResolutions = modes;
    emit displayChanged();
}

bool SettingsBackend::setDisplayResolution(const QString &mode)
{
    if (m_primaryOutput.isEmpty()) {
        return false;
    }
    const QString xrandr = QStandardPaths::findExecutable(QStringLiteral("xrandr"));
    if (xrandr.isEmpty()) {
        return false;
    }
    QProcess proc;
    proc.start(xrandr, {QStringLiteral("--output"), m_primaryOutput, QStringLiteral("--mode"), mode});
    if (proc.waitForFinished(2500) && proc.exitCode() == 0) {
        setFeedback(QStringLiteral("Display resolution set to ") + mode);
        refreshDisplayModes();
        return true;
    }
    setFeedback(QStringLiteral("Failed changing resolution"));
    return false;
}

void SettingsBackend::copyToClipboard(const QString &text)
{
    if (QClipboard *cb = QGuiApplication::clipboard()) {
        cb->setText(text);
        setFeedback(QStringLiteral("Copied to clipboard: ") + text);
    }
}

void SettingsBackend::refreshRdpStatus()
{
    const QString rdpctl = QStandardPaths::findExecutable(QStringLiteral("nrma-rdpctl"));
    if (rdpctl.isEmpty()) {
        m_rdpStatus = QVariantMap{
            {QStringLiteral("installed"), false},
            {QStringLiteral("enabled"), false},
            {QStringLiteral("active"), false},
            {QStringLiteral("port"), 3389}
        };
        emit rdpChanged();
        return;
    }
    QProcess proc;
    proc.start(rdpctl, {QStringLiteral("status"), QStringLiteral("--json")});
    if (proc.waitForFinished(4000) && proc.exitCode() == 0) {
        const QJsonDocument doc = QJsonDocument::fromJson(proc.readAllStandardOutput());
        if (doc.isObject()) {
            m_rdpStatus = doc.object().toVariantMap();
            m_rdpStatus.insert(QStringLiteral("installed"), true);
            emit rdpChanged();
        }
    }
}

bool SettingsBackend::runRdpCtlPrivileged(const QStringList &args, const QByteArray &stdinData)
{
    const QString rdpctl = QStandardPaths::findExecutable(QStringLiteral("nrma-rdpctl"));
    if (rdpctl.isEmpty()) {
        setFeedback(QStringLiteral("nrma-rdpctl is not installed"));
        return false;
    }

    QString prog = rdpctl;
    QStringList fullArgs = args;
    if (::geteuid() != 0) {
        const QString pkexec = QStandardPaths::findExecutable(QStringLiteral("pkexec"));
        const QString sudoBin = QStandardPaths::findExecutable(QStringLiteral("sudo"));
        if (!pkexec.isEmpty()) {
            prog = pkexec;
            fullArgs.prepend(rdpctl);
        } else if (!sudoBin.isEmpty()) {
            prog = sudoBin;
            fullArgs.prepend(rdpctl);
            fullArgs.prepend(QStringLiteral("-n"));
        }
    }

    QProcess proc;
    proc.start(prog, fullArgs);
    if (!proc.waitForStarted(3000)) {
        setFeedback(QStringLiteral("Failed starting privileged helper"));
        return false;
    }
    if (!stdinData.isEmpty()) {
        proc.write(stdinData);
    }
    proc.closeWriteChannel();

    if (!proc.waitForFinished(15000)) {
        setFeedback(QStringLiteral("Remote Desktop operation timed out"));
        return false;
    }
    if (proc.exitCode() != 0) {
        const QString err = QString::fromUtf8(proc.readAllStandardError()).trimmed();
        setFeedback(err.isEmpty() ? QStringLiteral("Operation declined or failed") : err);
        return false;
    }

    refreshRdpStatus();
    return true;
}

bool SettingsBackend::setRdpEnabled(bool enable, int port, const QString &subnetsCsv, const QString &resolution)
{
    if (enable) {
        QStringList args{QStringLiteral("enable"), QStringLiteral("--port"), QString::number(port)};
        const QStringList parts = subnetsCsv.split(QLatin1Char(','), Qt::SkipEmptyParts);
        for (const QString &cidr : parts) {
            args << QStringLiteral("--subnet") << cidr.trimmed();
        }
        if (!resolution.isEmpty()) {
            args << QStringLiteral("--resolution") << resolution;
        }
        const bool ok = runRdpCtlPrivileged(args);
        if (ok) {
            setFeedback(QStringLiteral("Remote Desktop enabled on port ") + QString::number(port));
        }
        return ok;
    }
    const bool ok = runRdpCtlPrivileged({QStringLiteral("disable")});
    if (ok) {
        setFeedback(QStringLiteral("Remote Desktop disabled and firewall rules removed"));
    }
    return ok;
}

bool SettingsBackend::setRdpPort(int port)
{
    const bool ok = runRdpCtlPrivileged({QStringLiteral("set-port"), QString::number(port)});
    if (ok) {
        setFeedback(QStringLiteral("Updated RDP port to ") + QString::number(port));
    }
    return ok;
}

bool SettingsBackend::setRdpResolution(const QString &resolution)
{
    const bool ok = runRdpCtlPrivileged({QStringLiteral("set-resolution"), resolution});
    if (ok) {
        setFeedback(QStringLiteral("Updated preferred RDP resolution to ") + resolution);
    }
    return ok;
}

bool SettingsBackend::setRdpUserAccess(const QString &username, bool authorized)
{
    const QString cmd = authorized ? QStringLiteral("grant-user") : QStringLiteral("revoke-user");
    const bool ok = runRdpCtlPrivileged({cmd, username});
    if (ok) {
        setFeedback((authorized ? QStringLiteral("Authorized RDP access for ")
                                : QStringLiteral("Revoked RDP access for ")) + username);
    }
    return ok;
}

bool SettingsBackend::setRdpUserPassword(const QString &username, const QString &password)
{
    if (password.size() < 8) {
        setFeedback(QStringLiteral("Password must be at least 8 characters"));
        return false;
    }
    QByteArray secretBytes = (password + QLatin1Char('\n')).toUtf8();
    const bool ok = runRdpCtlPrivileged({QStringLiteral("set-user-password"), username}, secretBytes);
    secretBytes.fill('\0');
    if (ok) {
        setFeedback(QStringLiteral("Updated local account password for ") + username);
    }
    return ok;
}

void SettingsBackend::refreshRuntimeStatus()
{
    const QString rt = QStandardPaths::findExecutable(QStringLiteral("nrma-runtime"));
    if (rt.isEmpty()) {
        m_runtimeStatus = QVariantMap{{QStringLiteral("wine_installed"), false}};
        emit runtimeChanged();
        return;
    }
    QProcess proc;
    proc.start(rt, {QStringLiteral("status"), QStringLiteral("--json")});
    if (proc.waitForFinished(4000) && proc.exitCode() == 0) {
        const QJsonDocument doc = QJsonDocument::fromJson(proc.readAllStandardOutput());
        if (doc.isObject()) {
            m_runtimeStatus = doc.object().toVariantMap();
            emit runtimeChanged();
        }
    }
}

void SettingsBackend::inspectExecutable(const QString &filePath)
{
    const QString rt = QStandardPaths::findExecutable(QStringLiteral("nrma-runtime"));
    if (rt.isEmpty() || filePath.trimmed().isEmpty()) {
        return;
    }
    QProcess proc;
    proc.start(rt, {QStringLiteral("inspect"), filePath.trimmed(), QStringLiteral("--json")});
    if (proc.waitForFinished(4000)) {
        const QJsonDocument doc = QJsonDocument::fromJson(proc.readAllStandardOutput());
        if (doc.isObject()) {
            m_inspectedExe = doc.object().toVariantMap();
            emit inspectedExeChanged();
        }
    }
}

bool SettingsBackend::runExecutableInPrefix(const QString &filePath, const QString &prefixName)
{
    const QString rt = QStandardPaths::findExecutable(QStringLiteral("nrma-runtime"));
    if (rt.isEmpty()) {
        return false;
    }
    const QString pfx = prefixName.trimmed().isEmpty() ? QStringLiteral("default") : prefixName.trimmed();
    const bool ok = QProcess::startDetached(rt, {QStringLiteral("run"), QStringLiteral("--prefix"), pfx, filePath.trimmed()});
    setFeedback(ok ? QStringLiteral("Started Windows executable via nrma Runtime")
                   : QStringLiteral("Failed launching nrma Runtime"));
    return ok;
}

bool SettingsBackend::createLauncherShortcut(const QString &filePath, const QString &appName, const QString &prefixName)
{
    const QString rt = QStandardPaths::findExecutable(QStringLiteral("nrma-runtime"));
    if (rt.isEmpty()) {
        return false;
    }
    const QString title = appName.trimmed().isEmpty() ? QFileInfo(filePath).completeBaseName() : appName.trimmed();
    const QString pfx = prefixName.trimmed().isEmpty() ? QStringLiteral("default") : prefixName.trimmed();
    QProcess proc;
    proc.start(rt, {QStringLiteral("create-shortcut"), filePath.trimmed(),
                    QStringLiteral("--name"), title,
                    QStringLiteral("--prefix"), pfx});
    if (proc.waitForFinished(4000) && proc.exitCode() == 0) {
        setFeedback(QStringLiteral("Created App Launcher shortcut: ") + title);
        return true;
    }
    setFeedback(QStringLiteral("Failed creating shortcut (check file path)"));
    return false;
}

bool SettingsBackend::createWinePrefix(const QString &name, const QString &arch)
{
    const QString rt = QStandardPaths::findExecutable(QStringLiteral("nrma-runtime"));
    if (rt.isEmpty() || name.trimmed().isEmpty()) {
        return false;
    }
    QProcess proc;
    proc.start(rt, {QStringLiteral("create-prefix"), name.trimmed(),
                    QStringLiteral("--arch"), arch.isEmpty() ? QStringLiteral("win64") : arch});
    if (proc.waitForFinished(4000) && proc.exitCode() == 0) {
        refreshRuntimeStatus();
        setFeedback(QStringLiteral("Created isolated prefix: ") + name.trimmed());
        return true;
    }
    return false;
}

bool SettingsBackend::removeWinePrefix(const QString &name)
{
    const QString rt = QStandardPaths::findExecutable(QStringLiteral("nrma-runtime"));
    if (rt.isEmpty() || name.trimmed().isEmpty()) {
        return false;
    }
    QProcess proc;
    proc.start(rt, {QStringLiteral("remove-prefix"), name.trimmed()});
    if (proc.waitForFinished(4000) && proc.exitCode() == 0) {
        refreshRuntimeStatus();
        setFeedback(QStringLiteral("Removed prefix: ") + name.trimmed());
        return true;
    }
    return false;
}

bool SettingsBackend::installWineEngine()
{
    const QString rt = QStandardPaths::findExecutable(QStringLiteral("nrma-runtime"));
    if (rt.isEmpty()) {
        return false;
    }
    setFeedback(QStringLiteral("Starting optional Wine installation (check authentication prompt)..."));
    return QProcess::startDetached(rt, {QStringLiteral("install-engine")});
}
