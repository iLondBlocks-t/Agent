#include "SystemControlBridge.h"

#include <QCoreApplication>
#include <QFile>
#include <QGuiApplication>
#include <QHostAddress>
#include <QNetworkInterface>
#include <QProcess>
#include <QRegularExpression>
#include <QStandardPaths>
#include <QSysInfo>

SystemControlBridge::SystemControlBridge(QObject *parent)
    : QObject(parent)
    , m_hostname(QSysInfo::machineHostName())
    , m_kernelVersion(QSysInfo::kernelVersion())
    , m_isRemoteSession(qEnvironmentVariable("XRDP_SESSION") == QStringLiteral("1"))
{
    refreshStatus();
    refreshDisplayModes();

    m_timer.setInterval(5000);
    connect(&m_timer, &QTimer::timeout, this, &SystemControlBridge::refreshStatus);
    m_timer.start();
}

void SystemControlBridge::refreshStatus()
{
    QString detectedIp = QStringLiteral("127.0.0.1");
    const QList<QNetworkInterface> ifaces = QNetworkInterface::allInterfaces();
    for (const QNetworkInterface &iface : ifaces) {
        const auto flags = iface.flags();
        if (!flags.testFlag(QNetworkInterface::IsUp)
            || !flags.testFlag(QNetworkInterface::IsRunning)
            || flags.testFlag(QNetworkInterface::IsLoopBack)) {
            continue;
        }
        for (const QNetworkAddressEntry &entry : iface.addressEntries()) {
            const QHostAddress addr = entry.ip();
            if (addr.protocol() == QAbstractSocket::IPv4Protocol && !addr.isLoopback()) {
                detectedIp = addr.toString();
                break;
            }
        }
        if (detectedIp != QStringLiteral("127.0.0.1")) {
            break;
        }
    }

    // Read live memory summary from /proc/meminfo
    QString memStr;
    QFile memFile(QStringLiteral("/proc/meminfo"));
    if (memFile.open(QIODevice::ReadOnly | QIODevice::Text)) {
        qint64 totalKib = 0;
        qint64 availKib = 0;
        while (!memFile.atEnd()) {
            const QString line = QString::fromUtf8(memFile.readLine());
            if (line.startsWith(QStringLiteral("MemTotal:"))) {
                totalKib = line.simplified().section(QLatin1Char(' '), 1, 1).toLongLong();
            } else if (line.startsWith(QStringLiteral("MemAvailable:"))) {
                availKib = line.simplified().section(QLatin1Char(' '), 1, 1).toLongLong();
            }
            if (totalKib > 0 && availKib > 0) {
                break;
            }
        }
        if (totalKib > 0) {
            const qint64 usedMib = qMax<qint64>(0, (totalKib - availKib) / 1024);
            const qint64 totalMib = totalKib / 1024;
            memStr = QStringLiteral("%1 / %2 MiB").arg(usedMib).arg(totalMib);
        }
    }

    // Check whether xrdp service is active without spawning a shell
    bool rdpNow = false;
    const QString systemctlBin = QStandardPaths::findExecutable(QStringLiteral("systemctl"));
    if (!systemctlBin.isEmpty()) {
        QProcess proc;
        proc.start(systemctlBin, {QStringLiteral("is-active"), QStringLiteral("--quiet"), QStringLiteral("xrdp")});
        if (proc.waitForFinished(800)) {
            rdpNow = (proc.exitStatus() == QProcess::NormalExit && proc.exitCode() == 0);
        }
    }

    // Probe audio mixer only if pactl or amixer exists
    bool audioOk = false;
    int vol = m_volumePercent;
    const QString pactlBin = QStandardPaths::findExecutable(QStringLiteral("pactl"));
    if (!pactlBin.isEmpty()) {
        QProcess proc;
        proc.start(pactlBin, {QStringLiteral("get-sink-volume"), QStringLiteral("@DEFAULT_SINK@")});
        if (proc.waitForFinished(600) && proc.exitCode() == 0) {
            const QString out = QString::fromUtf8(proc.readAllStandardOutput());
            static const QRegularExpression re(QStringLiteral("(\\d+)%"));
            const auto match = re.match(out);
            if (match.hasMatch()) {
                audioOk = true;
                vol = match.captured(1).toInt();
            }
        }
    }

    const bool changed = (detectedIp != m_localIp) || (memStr != m_memorySummary) || (rdpNow != m_rdpActive);
    m_localIp = detectedIp;
    m_memorySummary = memStr;
    m_rdpActive = rdpNow;
    if (changed) {
        emit statusChanged();
    }

    if (audioOk != m_audioAvailable || vol != m_volumePercent) {
        m_audioAvailable = audioOk;
        m_volumePercent = vol;
        emit audioChanged();
    }
}

void SystemControlBridge::refreshDisplayModes()
{
    if (QGuiApplication::platformName() != QStringLiteral("xcb")) {
        return;
    }
    const QString xrandrBin = QStandardPaths::findExecutable(QStringLiteral("xrandr"));
    if (xrandrBin.isEmpty()) {
        return;
    }

    QProcess proc;
    proc.start(xrandrBin, {QStringLiteral("--query")});
    if (!proc.waitForFinished(1500) || proc.exitCode() != 0) {
        return;
    }

    const QStringList lines = QString::fromUtf8(proc.readAllStandardOutput()).split(QLatin1Char('\n'));
    QString outName;
    QString currentMode;
    QStringList modes;
    static const QRegularExpression modeRe(QStringLiteral("^\\s+(\\d+x\\d+)\\s+.*"));

    for (const QString &line : lines) {
        if (line.contains(QStringLiteral(" connected"))) {
            if (outName.isEmpty()) {
                outName = line.section(QLatin1Char(' '), 0, 0).trimmed();
            } else {
                break;
            }
            continue;
        }
        if (!outName.isEmpty()) {
            const auto m = modeRe.match(line);
            if (m.hasMatch()) {
                const QString res = m.captured(1);
                if (!modes.contains(res) && modes.size() < 8) {
                    modes.append(res);
                }
                if (line.contains(QLatin1Char('*'))) {
                    currentMode = res;
                }
            }
        }
    }

    m_primaryOutput = outName;
    m_currentResolution = currentMode;
    m_availableResolutions = modes;
    emit displayChanged();
}

bool SystemControlBridge::setResolution(const QString &resolution)
{
    static const QRegularExpression validRes(QStringLiteral("^\\d{3,5}x\\d{3,5}$"));
    if (!validRes.match(resolution).hasMatch() || m_primaryOutput.isEmpty()) {
        return false;
    }
    const QString xrandrBin = QStandardPaths::findExecutable(QStringLiteral("xrandr"));
    if (xrandrBin.isEmpty()) {
        return false;
    }
    QProcess proc;
    proc.start(xrandrBin, {QStringLiteral("--output"), m_primaryOutput, QStringLiteral("--mode"), resolution});
    if (!proc.waitForFinished(2500) || proc.exitCode() != 0) {
        return false;
    }
    refreshDisplayModes();
    return true;
}

bool SystemControlBridge::setVolume(int percent)
{
    if (!m_audioAvailable) {
        return false;
    }
    const int bounded = qBound(0, percent, 100);
    const QString pactlBin = QStandardPaths::findExecutable(QStringLiteral("pactl"));
    if (pactlBin.isEmpty()) {
        return false;
    }
    QProcess proc;
    proc.start(pactlBin, {QStringLiteral("set-sink-volume"), QStringLiteral("@DEFAULT_SINK@"), QStringLiteral("%1%").arg(bounded)});
    if (proc.waitForFinished(800) && proc.exitCode() == 0) {
        m_volumePercent = bounded;
        emit audioChanged();
        return true;
    }
    return false;
}

void SystemControlBridge::logOut()
{
    QCoreApplication::quit();
}

void SystemControlBridge::rebootSystem()
{
    const QString systemctlBin = QStandardPaths::findExecutable(QStringLiteral("systemctl"));
    if (!systemctlBin.isEmpty()) {
        QProcess::startDetached(systemctlBin, {QStringLiteral("reboot")});
    }
}

void SystemControlBridge::powerOffSystem()
{
    const QString systemctlBin = QStandardPaths::findExecutable(QStringLiteral("systemctl"));
    if (!systemctlBin.isEmpty()) {
        QProcess::startDetached(systemctlBin, {QStringLiteral("poweroff")});
    }
}
