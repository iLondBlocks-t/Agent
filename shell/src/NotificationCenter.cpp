#include "NotificationCenter.h"
#include "SystemSettings.h"

#include <QDateTime>
#include <QVariantMap>

NotificationCenter::NotificationCenter(SystemSettings *settings, QObject *parent)
    : QObject(parent)
    , m_settings(settings)
{
}

int NotificationCenter::postNotification(const QString &title, const QString &body, const QString &urgency)
{
    const int id = m_nextId++;
    QVariantMap item;
    item.insert(QStringLiteral("id"), id);
    item.insert(QStringLiteral("title"), title.trimmed().isEmpty() ? QStringLiteral("nrmaOS") : title.trimmed());
    item.insert(QStringLiteral("body"), body.trimmed());
    item.insert(QStringLiteral("urgency"), urgency.isEmpty() ? QStringLiteral("normal") : urgency);
    item.insert(QStringLiteral("timestamp"), QDateTime::currentDateTime().toString(QStringLiteral("HH:mm")));
    m_notifications.prepend(item);
    while (m_notifications.size() > 50) {
        m_notifications.removeLast();
    }
    ++m_unreadCount;
    emit notificationsChanged();

    if (!m_settings || !m_settings->doNotDisturb()) {
        emit toastRequested(item.value(QStringLiteral("title")).toString(),
                            item.value(QStringLiteral("body")).toString(),
                            item.value(QStringLiteral("urgency")).toString());
    }
    return id;
}

void NotificationCenter::markAllRead()
{
    if (m_unreadCount == 0) {
        return;
    }
    m_unreadCount = 0;
    emit notificationsChanged();
}

void NotificationCenter::dismissNotification(int id)
{
    for (int i = 0; i < m_notifications.size(); ++i) {
        if (m_notifications.at(i).toMap().value(QStringLiteral("id")).toInt() == id) {
            m_notifications.removeAt(i);
            if (m_unreadCount > m_notifications.size()) {
                m_unreadCount = m_notifications.size();
            }
            emit notificationsChanged();
            return;
        }
    }
}

void NotificationCenter::clearAll()
{
    if (m_notifications.isEmpty() && m_unreadCount == 0) {
        return;
    }
    m_notifications.clear();
    m_unreadCount = 0;
    emit notificationsChanged();
}
