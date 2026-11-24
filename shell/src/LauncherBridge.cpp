#include "LauncherBridge.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QProcess>
#include <QStandardPaths>
#include <QVariantMap>

namespace {
QStringList parseDesktopExecTokens(const QString &execLine)
{
    QStringList tokens;
    QString current;
    bool inSingle = false;
    bool inDouble = false;

    for (int i = 0; i < execLine.size(); ++i) {
        const QChar c = execLine.at(i);
        if (c == QLatin1Char('\'') && !inDouble) {
            inSingle = !inSingle;
            continue;
        }
        if (c == QLatin1Char('"') && !inSingle) {
            inDouble = !inDouble;
            continue;
        }
        if (c.isSpace() && !inSingle && !inDouble) {
            if (!current.isEmpty()) {
                if (!current.startsWith(QLatin1Char('%'))) {
                    tokens.append(current);
                }
                current.clear();
            }
            continue;
        }
        current.append(c);
    }
    if (!current.isEmpty() && !current.startsWith(QLatin1Char('%'))) {
        tokens.append(current);
    }
    return tokens;
}
} // namespace

LauncherBridge::LauncherBridge(QObject *parent)
    : QObject(parent)
{
    refreshApplications();
}

void LauncherBridge::refreshApplications()
{
    m_registry.clear();
    m_applications.clear();

    const QList<AppSpec> builtins = {
        {QStringLiteral("files"), QStringLiteral("nrma Files"),
         QStringLiteral("Browse folders, storage, and run Windows executables"),
         QStringLiteral("System"), QStringLiteral("▤"),
         QStringLiteral("nrma-files"), QStringLiteral("pcmanfm"), {}, false},
        {QStringLiteral("terminal"), QStringLiteral("Terminal"),
         QStringLiteral("Command-line shell session"),
         QStringLiteral("Utilities"), QStringLiteral(">_"),
         QStringLiteral("xterm"), QString(), {}, false},
        {QStringLiteral("settings"), QStringLiteral("nrma Settings"),
         QStringLiteral("Appearance, Wallpaper, Display, Remote Desktop, Runtime"),
         QStringLiteral("System"), QStringLiteral("⚙"),
         QStringLiteral("nrma-settings"), QString(), {}, false},
        {QStringLiteral("remote-desktop"), QStringLiteral("Remote Desktop"),
         QStringLiteral("Configure secure xrdp access, port, firewall, and sessions"),
         QStringLiteral("Network"), QStringLiteral("⇄"),
         QStringLiteral("nrma-settings"), QString(), {QStringLiteral("--page"), QStringLiteral("remote-desktop")}, false},
        {QStringLiteral("runtime"), QStringLiteral("nrma Runtime"),
         QStringLiteral("Optional Wine compatibility layer & EXE prefix manager"),
         QStringLiteral("Compatibility"), QStringLiteral("⊞"),
         QStringLiteral("nrma-settings"), QString(), {QStringLiteral("--page"), QStringLiteral("runtime")}, false},
        {QStringLiteral("wallpaper"), QStringLiteral("Wallpaper Manager"),
         QStringLiteral("Choose nrmaOS desktop backgrounds and themes"),
         QStringLiteral("Personalization"), QStringLiteral("◐"),
         QStringLiteral("nrma-settings"), QString(), {QStringLiteral("--page"), QStringLiteral("wallpaper")}, false},
        {QStringLiteral("installer"), QStringLiteral("System & Live Media"),
         QStringLiteral("Live OS evaluation guide, disk readiness, and system info"),
         QStringLiteral("System"), QStringLiteral("◎"),
         QStringLiteral("nrma-installer"), QStringLiteral("nrma-settings"), {}, false}
    };

    for (const AppSpec &spec : builtins) {
        m_registry.insert(spec.id, spec);
    }

    loadDesktopFilesFrom(QDir::homePath() + QStringLiteral("/.local/share/applications"));
    loadDesktopFilesFrom(QStringLiteral("/usr/share/applications"));

    for (auto it = m_registry.cbegin(); it != m_registry.cend(); ++it) {
        const AppSpec &spec = it.value();
        QVariantMap map;
        map.insert(QStringLiteral("id"), spec.id);
        map.insert(QStringLiteral("name"), spec.name);
        map.insert(QStringLiteral("description"), spec.description);
        map.insert(QStringLiteral("category"), spec.category);
        map.insert(QStringLiteral("glyph"), spec.glyph);
        map.insert(QStringLiteral("isWineApp"), spec.isWineApp);
        m_applications.append(map);
    }

    emit applicationsChanged();
}

void LauncherBridge::loadDesktopFilesFrom(const QString &dirPath)
{
    QDir dir(dirPath);
    if (!dir.exists()) {
        return;
    }

    const QFileInfoList entries = dir.entryInfoList({QStringLiteral("*.desktop")}, QDir::Files | QDir::Readable, QDir::Name);
    for (const QFileInfo &fi : entries) {
        const QString baseId = QStringLiteral("desktop:") + fi.completeBaseName();
        if (m_registry.contains(baseId)) {
            continue;
        }
        // Skip duplicates of first-party nrmaOS launcher items
        if (fi.completeBaseName().startsWith(QStringLiteral("nrma-"))
            && !fi.completeBaseName().startsWith(QStringLiteral("nrma-wine-"))) {
            continue;
        }

        QFile file(fi.absoluteFilePath());
        if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
            continue;
        }

        bool inDesktopEntry = false;
        bool hidden = false;
        QString name;
        QString comment;
        QString execLine;
        QString categories;

        while (!file.atEnd()) {
            const QString line = QString::fromUtf8(file.readLine()).trimmed();
            if (line.isEmpty() || line.startsWith(QLatin1Char('#'))) {
                continue;
            }
            if (line.startsWith(QLatin1Char('['))) {
                inDesktopEntry = (line == QStringLiteral("[Desktop Entry]"));
                continue;
            }
            if (!inDesktopEntry) {
                continue;
            }
            const int eq = line.indexOf(QLatin1Char('='));
            if (eq <= 0) {
                continue;
            }
            const QString key = line.left(eq).trimmed();
            const QString val = line.mid(eq + 1).trimmed();
            if (key == QStringLiteral("NoDisplay") || key == QStringLiteral("Hidden")) {
                if (val.compare(QStringLiteral("true"), Qt::CaseInsensitive) == 0) {
                    hidden = true;
                }
            } else if (key == QStringLiteral("Name") && name.isEmpty()) {
                name = val;
            } else if (key == QStringLiteral("Comment") && comment.isEmpty()) {
                comment = val;
            } else if (key == QStringLiteral("Exec") && execLine.isEmpty()) {
                execLine = val;
            } else if (key == QStringLiteral("Categories")) {
                categories = val;
            }
        }

        if (hidden || name.isEmpty() || execLine.isEmpty()) {
            continue;
        }
        const QStringList tokens = parseDesktopExecTokens(execLine);
        if (tokens.isEmpty()) {
            continue;
        }
        // Ignore shell invocations in desktop entries for safety
        const QString progBase = QFileInfo(tokens.first()).fileName();
        if (progBase == QStringLiteral("sh") || progBase == QStringLiteral("bash")) {
            continue;
        }

        AppSpec spec;
        spec.id = baseId;
        spec.name = name;
        spec.isWineApp = fi.completeBaseName().startsWith(QStringLiteral("nrma-wine-"))
            || categories.contains(QStringLiteral("Wine"), Qt::CaseInsensitive);
        spec.description = comment.isEmpty()
            ? (spec.isWineApp ? QStringLiteral("Windows application via nrma Runtime") : QStringLiteral("Installed application"))
            : comment;
        spec.category = spec.isWineApp ? QStringLiteral("Windows (nrma Runtime)") : QStringLiteral("Applications");
        spec.glyph = spec.isWineApp ? QStringLiteral("⊞") : name.left(1).toUpper();
        spec.program = tokens.first();
        spec.args = tokens.mid(1);
        m_registry.insert(spec.id, spec);
    }
}

QVariantList LauncherBridge::searchApps(const QString &query) const
{
    const QString q = query.trimmed();
    if (q.isEmpty()) {
        return m_applications;
    }
    QVariantList filtered;
    for (const QVariant &v : m_applications) {
        const QVariantMap map = v.toMap();
        if (map.value(QStringLiteral("name")).toString().contains(q, Qt::CaseInsensitive)
            || map.value(QStringLiteral("description")).toString().contains(q, Qt::CaseInsensitive)
            || map.value(QStringLiteral("category")).toString().contains(q, Qt::CaseInsensitive)) {
            filtered.append(map);
        }
    }
    return filtered;
}

bool LauncherBridge::openSettingsPage(const QString &pageName)
{
    const QString resolved = QStandardPaths::findExecutable(QStringLiteral("nrma-settings"));
    if (resolved.isEmpty()) {
        emit appLaunchResult(QStringLiteral("settings:") + pageName, false);
        return false;
    }
    const bool started = QProcess::startDetached(resolved, {QStringLiteral("--page"), pageName});
    emit appLaunchResult(QStringLiteral("settings:") + pageName, started);
    return started;
}

bool LauncherBridge::openApp(const QString &appId)
{
    if (!m_registry.contains(appId)) {
        // Re-scan once in case a new shortcut was just added
        refreshApplications();
    }
    if (!m_registry.contains(appId)) {
        emit appLaunchResult(appId, false);
        return false;
    }

    const AppSpec spec = m_registry.value(appId);
    QString program = spec.program;
    QString resolved = QFileInfo(program).isAbsolute() ? program : QStandardPaths::findExecutable(program);
    QStringList args = spec.args;

    if ((resolved.isEmpty() || !QFileInfo::isExecutable(resolved)) && !spec.fallbackProgram.isEmpty()) {
        program = spec.fallbackProgram;
        resolved = QStandardPaths::findExecutable(program);
        args.clear();
    }

    if (resolved.isEmpty()) {
        emit appLaunchResult(appId, false);
        return false;
    }

    // Use a fixed executable and direct argument vector; never invoke a command interpreter.
    const bool started = QProcess::startDetached(resolved, args);
    emit appLaunchResult(appId, started);
    return started;
}
