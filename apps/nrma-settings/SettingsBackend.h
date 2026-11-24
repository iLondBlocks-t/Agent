#pragma once

#include <QObject>
#include <QString>
#include <QStringList>
#include <QVariantList>
#include <QVariantMap>

class SettingsBackend final : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString initialPage READ initialPage WRITE setInitialPage NOTIFY initialPageChanged)
    Q_PROPERTY(bool darkTheme READ darkTheme WRITE setDarkTheme NOTIFY appearanceChanged)
    Q_PROPERTY(QString accentColor READ accentColor WRITE setAccentColor NOTIFY appearanceChanged)
    Q_PROPERTY(QString wallpaperPath READ wallpaperPath WRITE setWallpaperPath NOTIFY appearanceChanged)
    Q_PROPERTY(bool reducedMotion READ reducedMotion WRITE setReducedMotion NOTIFY appearanceChanged)
    Q_PROPERTY(int dockIconSize READ dockIconSize WRITE setDockIconSize NOTIFY appearanceChanged)
    Q_PROPERTY(QVariantList wallpapers READ wallpapers NOTIFY wallpapersChanged)

    Q_PROPERTY(QString currentResolution READ currentResolution NOTIFY displayChanged)
    Q_PROPERTY(QStringList availableResolutions READ availableResolutions NOTIFY displayChanged)

    Q_PROPERTY(QVariantMap rdpStatus READ rdpStatus NOTIFY rdpChanged)
    Q_PROPERTY(QVariantMap tailscaleStatus READ tailscaleStatus NOTIFY tailscaleChanged)
    Q_PROPERTY(QVariantMap runtimeStatus READ runtimeStatus NOTIFY runtimeChanged)
    Q_PROPERTY(QVariantMap inspectedExe READ inspectedExe NOTIFY inspectedExeChanged)
    Q_PROPERTY(QVariantMap aboutInfo READ aboutInfo CONSTANT)
    Q_PROPERTY(QString feedbackMessage READ feedbackMessage NOTIFY feedbackChanged)

public:
    explicit SettingsBackend(QObject *parent = nullptr);

    QString initialPage() const { return m_initialPage; }
    void setInitialPage(const QString &page);

    bool darkTheme() const { return m_darkTheme; }
    void setDarkTheme(bool enabled);

    QString accentColor() const { return m_accentColor; }
    void setAccentColor(const QString &color);

    QString wallpaperPath() const { return m_wallpaperPath; }
    void setWallpaperPath(const QString &path);

    bool reducedMotion() const { return m_reducedMotion; }
    void setReducedMotion(bool enabled);

    int dockIconSize() const { return m_dockIconSize; }
    void setDockIconSize(int px);

    QVariantList wallpapers() const { return m_wallpapers; }
    QString currentResolution() const { return m_currentResolution; }
    QStringList availableResolutions() const { return m_availableResolutions; }
    QVariantMap rdpStatus() const { return m_rdpStatus; }
    QVariantMap tailscaleStatus() const { return m_tailscaleStatus; }
    QVariantMap runtimeStatus() const { return m_runtimeStatus; }
    QVariantMap inspectedExe() const { return m_inspectedExe; }
    QVariantMap aboutInfo() const { return m_aboutInfo; }
    QString feedbackMessage() const { return m_feedbackMessage; }

    Q_INVOKABLE void refreshAll();
    Q_INVOKABLE void refreshRdpStatus();
    Q_INVOKABLE void refreshTailscaleStatus();
    Q_INVOKABLE void refreshRuntimeStatus();
    Q_INVOKABLE void refreshDisplayModes();

    Q_INVOKABLE bool setDisplayResolution(const QString &mode);
    Q_INVOKABLE void copyToClipboard(const QString &text);
    Q_INVOKABLE void openExternalUrl(const QString &url);

    // Remote Desktop management via nrma-rdpctl
    Q_INVOKABLE bool setRdpEnabled(
        bool enable,
        int port,
        const QString &subnetsCsv,
        const QString &resolution,
        const QString &firewallMode = QStringLiteral("lan"));
    Q_INVOKABLE bool setRdpPort(int port);
    Q_INVOKABLE bool setRdpFirewallMode(const QString &mode);
    Q_INVOKABLE bool setRdpResolution(const QString &resolution);
    Q_INVOKABLE bool setRdpUserAccess(const QString &username, bool authorized);
    Q_INVOKABLE bool setRdpUserPassword(const QString &username, const QString &password);

    // Optional native Tailscale mesh VPN via nrma-tailscalectl
    Q_INVOKABLE bool connectTailscale(const QString &hostname = QString());
    Q_INVOKABLE bool disconnectTailscale(bool stopDaemon = false);

    // nrma Runtime (EXE compatibility) via nrma-runtime
    Q_INVOKABLE void inspectExecutable(const QString &filePath);
    Q_INVOKABLE bool runExecutableInPrefix(const QString &filePath, const QString &prefixName);
    Q_INVOKABLE bool createLauncherShortcut(const QString &filePath, const QString &appName, const QString &prefixName);
    Q_INVOKABLE bool createWinePrefix(const QString &name, const QString &arch);
    Q_INVOKABLE bool removeWinePrefix(const QString &name);
    Q_INVOKABLE bool installWineEngine();

signals:
    void initialPageChanged();
    void appearanceChanged();
    void wallpapersChanged();
    void displayChanged();
    void rdpChanged();
    void tailscaleChanged();
    void runtimeChanged();
    void inspectedExeChanged();
    void feedbackChanged();

private:
    QString configPath() const;
    void loadAppearance();
    void saveAppearanceAndNotifyShell();
    void loadWallpapers();
    void loadAboutInfo();
    void setFeedback(const QString &msg);
    bool runPrivilegedHelper(const QString &helperName, const QStringList &args, const QByteArray &stdinData = {}, int timeoutMs = 15000);
    bool runRdpCtlPrivileged(const QStringList &args, const QByteArray &stdinData = {});

    QString m_initialPage = QStringLiteral("appearance");
    bool m_darkTheme = true;
    QString m_accentColor = QStringLiteral("#5e8bff");
    QString m_wallpaperPath = QStringLiteral("/usr/share/nrmaos/wallpapers/aurora-dark.png");
    bool m_reducedMotion = false;
    int m_dockIconSize = 48;
    QVariantList m_wallpapers;

    QString m_primaryOutput;
    QString m_currentResolution;
    QStringList m_availableResolutions;

    QVariantMap m_rdpStatus;
    QVariantMap m_tailscaleStatus;
    QVariantMap m_runtimeStatus;
    QVariantMap m_inspectedExe;
    QVariantMap m_aboutInfo;
    QString m_feedbackMessage;
};
