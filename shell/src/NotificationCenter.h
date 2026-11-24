#pragma once

#include <QObject>
#include <QString>
#include <QVariantList>

class SystemSettings;

class NotificationCenter final : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QVariantList notifications READ notifications NOTIFY notificationsChanged)
    Q_PROPERTY(int unreadCount READ unreadCount NOTIFY notificationsChanged)

public:
    explicit NotificationCenter(SystemSettings *settings, QObject *parent = nullptr);

    QVariantList notifications() const { return m_notifications; }
    int unreadCount() const { return m_unreadCount; }

    Q_INVOKABLE int postNotification(const QString &title,
                                     const QString &body,
                                     const QString &urgency = QStringLiteral("normal"));
    Q_INVOKABLE void markAllRead();
    Q_INVOKABLE void dismissNotification(int id);
    Q_INVOKABLE void clearAll();

signals:
    void notificationsChanged();
    void toastRequested(const QString &title, const QString &body, const QString &urgency);

private:
    SystemSettings *m_settings = nullptr;
    QVariantList m_notifications;
    int m_unreadCount = 0;
    int m_nextId = 1;
};
