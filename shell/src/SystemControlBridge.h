#pragma once

#include <QObject>
#include <QString>
#include <QStringList>
#include <QTimer>

class SystemControlBridge final : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString localIp READ localIp NOTIFY statusChanged)
    Q_PROPERTY(QString hostname READ hostname CONSTANT)
    Q_PROPERTY(QString kernelVersion READ kernelVersion CONSTANT)
    Q_PROPERTY(QString memorySummary READ memorySummary NOTIFY statusChanged)
    Q_PROPERTY(bool rdpActive READ rdpActive NOTIFY statusChanged)
    Q_PROPERTY(bool isRemoteSession READ isRemoteSession CONSTANT)
    Q_PROPERTY(bool audioAvailable READ audioAvailable NOTIFY audioChanged)
    Q_PROPERTY(int volumePercent READ volumePercent NOTIFY audioChanged)
    Q_PROPERTY(QString currentResolution READ currentResolution NOTIFY displayChanged)
    Q_PROPERTY(QStringList availableResolutions READ availableResolutions NOTIFY displayChanged)

public:
    explicit SystemControlBridge(QObject *parent = nullptr);

    QString localIp() const { return m_localIp; }
    QString hostname() const { return m_hostname; }
    QString kernelVersion() const { return m_kernelVersion; }
    QString memorySummary() const { return m_memorySummary; }
    bool rdpActive() const { return m_rdpActive; }
    bool isRemoteSession() const { return m_isRemoteSession; }
    bool audioAvailable() const { return m_audioAvailable; }
    int volumePercent() const { return m_volumePercent; }
    QString currentResolution() const { return m_currentResolution; }
    QStringList availableResolutions() const { return m_availableResolutions; }

    Q_INVOKABLE void refreshStatus();
    Q_INVOKABLE void refreshDisplayModes();
    Q_INVOKABLE bool setResolution(const QString &resolution);
    Q_INVOKABLE bool setVolume(int percent);
    Q_INVOKABLE void logOut();
    Q_INVOKABLE void rebootSystem();
    Q_INVOKABLE void powerOffSystem();

signals:
    void statusChanged();
    void audioChanged();
    void displayChanged();

private:
    QString m_localIp = QStringLiteral("Offline");
    QString m_hostname;
    QString m_kernelVersion;
    QString m_memorySummary;
    QString m_primaryOutput;
    QString m_currentResolution;
    QStringList m_availableResolutions;
    bool m_rdpActive = false;
    bool m_isRemoteSession = false;
    bool m_audioAvailable = false;
    int m_volumePercent = 0;
    QTimer m_timer;
};
