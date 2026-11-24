#pragma once

#include <QObject>
#include <QSet>
#include <QString>
#include <QTimer>
#include <QVariantList>

class QWindow;
struct _XDisplay;

class WindowManagerBridge final : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QVariantList windows READ windows NOTIFY windowsChanged)
    Q_PROPERTY(QString activeWindowTitle READ activeWindowTitle NOTIFY activeWindowChanged)
    Q_PROPERTY(qulonglong activeWindowId READ activeWindowId NOTIFY activeWindowChanged)
    Q_PROPERTY(int windowCount READ windowCount NOTIFY windowsChanged)

public:
    explicit WindowManagerBridge(QObject *parent = nullptr);
    ~WindowManagerBridge() override;

    QVariantList windows() const { return m_windows; }
    QString activeWindowTitle() const { return m_activeWindowTitle; }
    qulonglong activeWindowId() const { return m_activeWindowId; }
    int windowCount() const { return m_windows.size(); }

    Q_INVOKABLE void registerDesktopWindow(QWindow *window);
    Q_INVOKABLE void registerDockPanel(QWindow *window, int topStrut, int bottomStrut);
    Q_INVOKABLE void registerShellWindow(QWindow *window);

    Q_INVOKABLE bool focusWindow(qulonglong xid);
    Q_INVOKABLE bool toggleMinimize(qulonglong xid);
    Q_INVOKABLE bool toggleMaximize(qulonglong xid);
    Q_INVOKABLE bool closeWindow(qulonglong xid);
    Q_INVOKABLE bool tileWindow(qulonglong xid, const QString &position);
    Q_INVOKABLE void refresh();

signals:
    void windowsChanged();
    void activeWindowChanged();

private:
    QString readUtf8Property(unsigned long win, unsigned long propAtom) const;
    QString readWindowTitle(unsigned long win) const;
    QString readWindowClass(unsigned long win) const;
    bool hasAtomInProperty(unsigned long win, unsigned long propAtom, unsigned long targetAtom) const;
    bool sendClientMessage(unsigned long win, unsigned long msgAtom,
                           long d0, long d1 = 0, long d2 = 0, long d3 = 0, long d4 = 0) const;

    struct _XDisplay *m_display = nullptr;
    unsigned long m_root = 0;
    QSet<qulonglong> m_shellWindowIds;
    QVariantList m_windows;
    QString m_lastSignature;
    QString m_activeWindowTitle = QStringLiteral("nrma Desktop");
    qulonglong m_activeWindowId = 0;
    QTimer m_pollTimer;
};
