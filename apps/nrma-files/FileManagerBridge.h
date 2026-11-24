#pragma once

#include <QObject>
#include <QString>
#include <QVariantList>

class FileManagerBridge final : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString currentPath READ currentPath WRITE setCurrentPath NOTIFY directoryChanged)
    Q_PROPERTY(QString filterQuery READ filterQuery WRITE setFilterQuery NOTIFY directoryChanged)
    Q_PROPERTY(QVariantList entries READ entries NOTIFY directoryChanged)
    Q_PROPERTY(QVariantList places READ places CONSTANT)
    Q_PROPERTY(QString storageSummary READ storageSummary NOTIFY directoryChanged)
    Q_PROPERTY(double storageRatio READ storageRatio NOTIFY directoryChanged)
    Q_PROPERTY(bool darkTheme READ darkTheme NOTIFY themeChanged)
    Q_PROPERTY(QString statusMessage READ statusMessage NOTIFY statusChanged)

public:
    explicit FileManagerBridge(QObject *parent = nullptr);

    QString currentPath() const { return m_currentPath; }
    void setCurrentPath(const QString &path);

    QString filterQuery() const { return m_filterQuery; }
    void setFilterQuery(const QString &query);

    QVariantList entries() const { return m_entries; }
    QVariantList places() const { return m_places; }
    QString storageSummary() const { return m_storageSummary; }
    double storageRatio() const { return m_storageRatio; }
    bool darkTheme() const { return m_darkTheme; }
    QString statusMessage() const { return m_statusMessage; }

    Q_INVOKABLE void refresh();
    Q_INVOKABLE void goUp();
    Q_INVOKABLE void goHome();
    Q_INVOKABLE bool openEntry(const QString &path);
    Q_INVOKABLE bool openWithRuntime(const QString &path);
    Q_INVOKABLE bool inspectInRuntime(const QString &path);
    Q_INVOKABLE bool createExeShortcut(const QString &path);
    Q_INVOKABLE bool createFolder(const QString &name);
    Q_INVOKABLE bool renameItem(const QString &path, const QString &newName);
    Q_INVOKABLE bool deleteItem(const QString &path);
    Q_INVOKABLE void copyItem(const QString &path);
    Q_INVOKABLE bool pasteClipboard();

signals:
    void directoryChanged();
    void themeChanged();
    void statusChanged();

private:
    void loadThemePreference();
    void setStatus(const QString &msg);

    QString m_currentPath;
    QString m_filterQuery;
    QString m_clipboardPath;
    QString m_storageSummary;
    QString m_statusMessage;
    double m_storageRatio = 0.0;
    bool m_darkTheme = true;
    QVariantList m_entries;
    QVariantList m_places;
};
