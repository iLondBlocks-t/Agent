#include "WindowManagerBridge.h"

#include <QByteArray>
#include <QGuiApplication>
#include <QRect>
#include <QScreen>
#include <QVariantMap>
#include <QWindow>

#include <cstring>

#include <X11/Xatom.h>
#include <X11/Xlib.h>
#include <X11/Xutil.h>

#undef None
#undef Bool
#undef Status
#undef CursorShape
#undef Expose
#undef KeyPress
#undef KeyRelease
#undef FocusIn
#undef FocusOut
#undef FontChange
#undef Unsorted

namespace {
int ignoreX11Errors(Display *, XErrorEvent *)
{
    return 0;
}
} // namespace

WindowManagerBridge::WindowManagerBridge(QObject *parent)
    : QObject(parent)
{
    if (QGuiApplication::platformName() == QStringLiteral("xcb")) {
        XSetErrorHandler(ignoreX11Errors);
        m_display = XOpenDisplay(nullptr);
        if (m_display) {
            m_root = DefaultRootWindow(m_display);
        }
    }

    m_pollTimer.setInterval(450);
    connect(&m_pollTimer, &QTimer::timeout, this, &WindowManagerBridge::refresh);
    if (m_display) {
        m_pollTimer.start();
        refresh();
    }
}

WindowManagerBridge::~WindowManagerBridge()
{
    m_pollTimer.stop();
    if (m_display) {
        XCloseDisplay(m_display);
        m_display = nullptr;
    }
}

void WindowManagerBridge::registerShellWindow(QWindow *window)
{
    if (!window) {
        return;
    }
    const qulonglong xid = static_cast<qulonglong>(window->winId());
    if (xid != 0) {
        m_shellWindowIds.insert(xid);
    }
}

void WindowManagerBridge::registerDesktopWindow(QWindow *window)
{
    if (!window) {
        return;
    }
    const unsigned long win = static_cast<unsigned long>(window->winId());
    if (win == 0) {
        return;
    }
    m_shellWindowIds.insert(static_cast<qulonglong>(win));
    if (!m_display) {
        return;
    }

    const Atom wmWindowType = XInternAtom(m_display, "_NET_WM_WINDOW_TYPE", 0);
    const Atom typeDesktop = XInternAtom(m_display, "_NET_WM_WINDOW_TYPE_DESKTOP", 0);
    const Atom wmState = XInternAtom(m_display, "_NET_WM_STATE", 0);
    const Atom stateBelow = XInternAtom(m_display, "_NET_WM_STATE_BELOW", 0);
    const Atom stateSticky = XInternAtom(m_display, "_NET_WM_STATE_STICKY", 0);
    const Atom skipTaskbar = XInternAtom(m_display, "_NET_WM_STATE_SKIP_TASKBAR", 0);
    const Atom skipPager = XInternAtom(m_display, "_NET_WM_STATE_SKIP_PAGER", 0);

    XChangeProperty(m_display, win, wmWindowType, XA_ATOM, 32, PropModeReplace,
                    reinterpret_cast<const unsigned char *>(&typeDesktop), 1);

    const Atom states[4] = {stateBelow, stateSticky, skipTaskbar, skipPager};
    XChangeProperty(m_display, win, wmState, XA_ATOM, 32, PropModeReplace,
                    reinterpret_cast<const unsigned char *>(states), 4);
    XLowerWindow(m_display, win);
    XFlush(m_display);
}

void WindowManagerBridge::registerDockPanel(QWindow *window, int topStrut, int bottomStrut)
{
    if (!window) {
        return;
    }
    const unsigned long win = static_cast<unsigned long>(window->winId());
    if (win == 0) {
        return;
    }
    m_shellWindowIds.insert(static_cast<qulonglong>(win));
    if (!m_display) {
        return;
    }

    const Atom wmWindowType = XInternAtom(m_display, "_NET_WM_WINDOW_TYPE", 0);
    const Atom typeDock = XInternAtom(m_display, "_NET_WM_WINDOW_TYPE_DOCK", 0);
    const Atom wmState = XInternAtom(m_display, "_NET_WM_STATE", 0);
    const Atom stateAbove = XInternAtom(m_display, "_NET_WM_STATE_ABOVE", 0);
    const Atom stateSticky = XInternAtom(m_display, "_NET_WM_STATE_STICKY", 0);
    const Atom skipTaskbar = XInternAtom(m_display, "_NET_WM_STATE_SKIP_TASKBAR", 0);
    const Atom skipPager = XInternAtom(m_display, "_NET_WM_STATE_SKIP_PAGER", 0);
    const Atom wmStrut = XInternAtom(m_display, "_NET_WM_STRUT", 0);
    const Atom wmStrutPartial = XInternAtom(m_display, "_NET_WM_STRUT_PARTIAL", 0);

    XChangeProperty(m_display, win, wmWindowType, XA_ATOM, 32, PropModeReplace,
                    reinterpret_cast<const unsigned char *>(&typeDock), 1);

    const Atom states[4] = {stateAbove, stateSticky, skipTaskbar, skipPager};
    XChangeProperty(m_display, win, wmState, XA_ATOM, 32, PropModeReplace,
                    reinterpret_cast<const unsigned char *>(states), 4);

    const QScreen *scr = QGuiApplication::primaryScreen();
    const int screenW = scr ? scr->geometry().width() : 1920;

    long strut[4] = {0, 0, topStrut, bottomStrut};
    long strutPartial[12] = {
        0, 0, topStrut, bottomStrut,
        0, 0,
        0, 0,
        topStrut > 0 ? 0 : 0, topStrut > 0 ? screenW - 1 : 0,
        bottomStrut > 0 ? 0 : 0, bottomStrut > 0 ? screenW - 1 : 0
    };

    XChangeProperty(m_display, win, wmStrut, XA_CARDINAL, 32, PropModeReplace,
                    reinterpret_cast<const unsigned char *>(strut), 4);
    XChangeProperty(m_display, win, wmStrutPartial, XA_CARDINAL, 32, PropModeReplace,
                    reinterpret_cast<const unsigned char *>(strutPartial), 12);
    XFlush(m_display);
}

QString WindowManagerBridge::readUtf8Property(unsigned long win, unsigned long propAtom) const
{
    if (!m_display || win == 0) {
        return {};
    }
    const Atom utf8Atom = XInternAtom(m_display, "UTF8_STRING", 0);
    Atom actualType = 0;
    int actualFormat = 0;
    unsigned long nItems = 0;
    unsigned long bytesAfter = 0;
    unsigned char *prop = nullptr;

    if (XGetWindowProperty(m_display, win, propAtom, 0, 256, 0, AnyPropertyType,
                           &actualType, &actualFormat, &nItems, &bytesAfter, &prop) == Success
        && prop) {
        QString value;
        if ((actualType == utf8Atom || actualType == XA_STRING) && actualFormat == 8 && nItems > 0) {
            value = QString::fromUtf8(reinterpret_cast<const char *>(prop), static_cast<int>(nItems));
        }
        XFree(prop);
        const int nulIdx = value.indexOf(QChar(0));
        if (nulIdx >= 0) {
            value.truncate(nulIdx);
        }
        return value.trimmed();
    }
    return {};
}

QString WindowManagerBridge::readWindowTitle(unsigned long win) const
{
    if (!m_display || win == 0) {
        return {};
    }
    const Atom netWmName = XInternAtom(m_display, "_NET_WM_NAME", 0);
    QString title = readUtf8Property(win, netWmName);
    if (title.isEmpty()) {
        title = readUtf8Property(win, XA_WM_NAME);
    }
    return title;
}

QString WindowManagerBridge::readWindowClass(unsigned long win) const
{
    if (!m_display || win == 0) {
        return {};
    }
    XClassHint hint{};
    if (XGetClassHint(m_display, win, &hint) != 0) {
        QString cls = hint.res_class ? QString::fromUtf8(hint.res_class)
                                     : (hint.res_name ? QString::fromUtf8(hint.res_name) : QString());
        if (hint.res_name) {
            XFree(hint.res_name);
        }
        if (hint.res_class) {
            XFree(hint.res_class);
        }
        return cls.trimmed();
    }
    return {};
}

bool WindowManagerBridge::hasAtomInProperty(unsigned long win, unsigned long propAtom, unsigned long targetAtom) const
{
    if (!m_display || win == 0) {
        return false;
    }
    Atom actualType = 0;
    int actualFormat = 0;
    unsigned long nItems = 0;
    unsigned long bytesAfter = 0;
    unsigned char *prop = nullptr;
    bool found = false;
    if (XGetWindowProperty(m_display, win, propAtom, 0, 32, 0, XA_ATOM,
                           &actualType, &actualFormat, &nItems, &bytesAfter, &prop) == Success
        && prop) {
        const auto *atoms = reinterpret_cast<const unsigned long *>(prop);
        for (unsigned long i = 0; i < nItems; ++i) {
            if (atoms[i] == targetAtom) {
                found = true;
                break;
            }
        }
        XFree(prop);
    }
    return found;
}

bool WindowManagerBridge::sendClientMessage(unsigned long win, unsigned long msgAtom,
                                            long d0, long d1, long d2, long d3, long d4) const
{
    if (!m_display || win == 0) {
        return false;
    }
    XEvent ev;
    std::memset(&ev, 0, sizeof(ev));
    ev.xclient.type = ClientMessage;
    ev.xclient.serial = 0;
    ev.xclient.send_event = 1;
    ev.xclient.message_type = msgAtom;
    ev.xclient.window = win;
    ev.xclient.format = 32;
    ev.xclient.data.l[0] = d0;
    ev.xclient.data.l[1] = d1;
    ev.xclient.data.l[2] = d2;
    ev.xclient.data.l[3] = d3;
    ev.xclient.data.l[4] = d4;

    const long mask = SubstructureRedirectMask | SubstructureNotifyMask;
    const int status = XSendEvent(m_display, m_root, 0, mask, &ev);
    XFlush(m_display);
    return status != 0;
}

void WindowManagerBridge::refresh()
{
    if (!m_display) {
        return;
    }

    const Atom clientListAtom = XInternAtom(m_display, "_NET_CLIENT_LIST", 0);
    const Atom activeWinAtom = XInternAtom(m_display, "_NET_ACTIVE_WINDOW", 0);
    const Atom wmTypeAtom = XInternAtom(m_display, "_NET_WM_WINDOW_TYPE", 0);
    const Atom typeDesktop = XInternAtom(m_display, "_NET_WM_WINDOW_TYPE_DESKTOP", 0);
    const Atom typeDock = XInternAtom(m_display, "_NET_WM_WINDOW_TYPE_DOCK", 0);
    const Atom wmStateAtom = XInternAtom(m_display, "_NET_WM_STATE", 0);
    const Atom stateHidden = XInternAtom(m_display, "_NET_WM_STATE_HIDDEN", 0);
    const Atom stateMaxV = XInternAtom(m_display, "_NET_WM_STATE_MAXIMIZED_VERT", 0);
    const Atom stateMaxH = XInternAtom(m_display, "_NET_WM_STATE_MAXIMIZED_HORZ", 0);

    unsigned long activeWin = 0;
    {
        Atom actualType = 0;
        int actualFormat = 0;
        unsigned long nItems = 0;
        unsigned long bytesAfter = 0;
        unsigned char *prop = nullptr;
        if (XGetWindowProperty(m_display, m_root, activeWinAtom, 0, 1, 0, XA_WINDOW,
                               &actualType, &actualFormat, &nItems, &bytesAfter, &prop) == Success
            && prop) {
            if (nItems >= 1) {
                activeWin = *reinterpret_cast<unsigned long *>(prop);
            }
            XFree(prop);
        }
    }

    QVariantList updated;
    QString sig;
    QString activeTitle = QStringLiteral("nrma Desktop");
    qulonglong effectiveActiveId = 0;

    Atom actualType = 0;
    int actualFormat = 0;
    unsigned long nItems = 0;
    unsigned long bytesAfter = 0;
    unsigned char *prop = nullptr;

    if (XGetWindowProperty(m_display, m_root, clientListAtom, 0, 256, 0, XA_WINDOW,
                           &actualType, &actualFormat, &nItems, &bytesAfter, &prop) == Success
        && prop) {
        const auto *wins = reinterpret_cast<const unsigned long *>(prop);
        for (unsigned long i = 0; i < nItems; ++i) {
            const unsigned long w = wins[i];
            if (w == 0 || m_shellWindowIds.contains(static_cast<qulonglong>(w))) {
                continue;
            }
            if (hasAtomInProperty(w, wmTypeAtom, typeDesktop) || hasAtomInProperty(w, wmTypeAtom, typeDock)) {
                continue;
            }
            QString title = readWindowTitle(w);
            const QString cls = readWindowClass(w);
            if (cls == QStringLiteral("nrmaos-shell")) {
                continue;
            }
            if (title.isEmpty()) {
                title = cls.isEmpty() ? QStringLiteral("Window") : cls;
            }
            const bool minimized = hasAtomInProperty(w, wmStateAtom, stateHidden);
            const bool maximized = hasAtomInProperty(w, wmStateAtom, stateMaxV)
                && hasAtomInProperty(w, wmStateAtom, stateMaxH);
            const bool isActive = (w == activeWin) && !minimized;
            if (isActive) {
                activeTitle = title;
                effectiveActiveId = static_cast<qulonglong>(w);
            }

            QVariantMap item;
            item.insert(QStringLiteral("xid"), static_cast<qulonglong>(w));
            item.insert(QStringLiteral("title"), title);
            item.insert(QStringLiteral("appClass"), cls);
            item.insert(QStringLiteral("minimized"), minimized);
            item.insert(QStringLiteral("maximized"), maximized);
            item.insert(QStringLiteral("active"), isActive);
            updated.append(item);

            sig += QStringLiteral("%1:%2:%3:%4:%5|")
                       .arg(w)
                       .arg(title, cls)
                       .arg(minimized ? 1 : 0)
                       .arg(isActive ? 1 : 0);
        }
        XFree(prop);
    }

    if (sig != m_lastSignature) {
        m_lastSignature = sig;
        m_windows = updated;
        emit windowsChanged();
    }

    if (activeTitle != m_activeWindowTitle || effectiveActiveId != m_activeWindowId) {
        m_activeWindowTitle = activeTitle;
        m_activeWindowId = effectiveActiveId;
        emit activeWindowChanged();
    }
}

bool WindowManagerBridge::focusWindow(qulonglong xid)
{
    if (!m_display || xid == 0) {
        return false;
    }
    const auto win = static_cast<unsigned long>(xid);
    XMapRaised(m_display, win);
    const Atom activeAtom = XInternAtom(m_display, "_NET_ACTIVE_WINDOW", 0);
    const bool ok = sendClientMessage(win, activeAtom, 2, CurrentTime, 0);
    refresh();
    return ok;
}

bool WindowManagerBridge::toggleMinimize(qulonglong xid)
{
    if (!m_display || xid == 0) {
        return false;
    }
    const auto win = static_cast<unsigned long>(xid);
    const Atom wmStateAtom = XInternAtom(m_display, "_NET_WM_STATE", 0);
    const Atom stateHidden = XInternAtom(m_display, "_NET_WM_STATE_HIDDEN", 0);
    const bool isMinimized = hasAtomInProperty(win, wmStateAtom, stateHidden);
    if (!isMinimized && xid == m_activeWindowId) {
        XIconifyWindow(m_display, win, DefaultScreen(m_display));
        XFlush(m_display);
        refresh();
        return true;
    }
    return focusWindow(xid);
}

bool WindowManagerBridge::toggleMaximize(qulonglong xid)
{
    if (!m_display || xid == 0) {
        return false;
    }
    const auto win = static_cast<unsigned long>(xid);
    const Atom wmState = XInternAtom(m_display, "_NET_WM_STATE", 0);
    const Atom maxV = XInternAtom(m_display, "_NET_WM_STATE_MAXIMIZED_VERT", 0);
    const Atom maxH = XInternAtom(m_display, "_NET_WM_STATE_MAXIMIZED_HORZ", 0);
    focusWindow(xid);
    return sendClientMessage(win, wmState, 2 /* _NET_WM_STATE_TOGGLE */,
                             static_cast<long>(maxV), static_cast<long>(maxH), 1);
}

bool WindowManagerBridge::closeWindow(qulonglong xid)
{
    if (!m_display || xid == 0) {
        return false;
    }
    const Atom closeAtom = XInternAtom(m_display, "_NET_CLOSE_WINDOW", 0);
    return sendClientMessage(static_cast<unsigned long>(xid), closeAtom, CurrentTime, 2);
}

bool WindowManagerBridge::tileWindow(qulonglong xid, const QString &position)
{
    if (!m_display || xid == 0) {
        return false;
    }
    if (position == QStringLiteral("maximize")) {
        return toggleMaximize(xid);
    }

    const auto win = static_cast<unsigned long>(xid);
    const Atom wmState = XInternAtom(m_display, "_NET_WM_STATE", 0);
    const Atom maxV = XInternAtom(m_display, "_NET_WM_STATE_MAXIMIZED_VERT", 0);
    const Atom maxH = XInternAtom(m_display, "_NET_WM_STATE_MAXIMIZED_HORZ", 0);
    // Clear maximized state before positioning
    sendClientMessage(win, wmState, 0 /* _NET_WM_STATE_REMOVE */,
                      static_cast<long>(maxV), static_cast<long>(maxH), 1);

    const QScreen *scr = QGuiApplication::primaryScreen();
    const QRect geom = scr ? scr->geometry() : QRect(0, 0, 1280, 800);
    const int topBarH = 38;
    const int dockH = 80;
    const int workW = geom.width();
    const int workH = qMax(240, geom.height() - topBarH - dockH);

    int targetX = 8;
    int targetY = topBarH + 6;
    int targetW = workW - 16;
    int targetH = workH - 12;

    if (position == QStringLiteral("left")) {
        targetX = 8;
        targetW = (workW / 2) - 12;
    } else if (position == QStringLiteral("right")) {
        targetX = (workW / 2) + 4;
        targetW = (workW / 2) - 12;
    } else if (position == QStringLiteral("center")) {
        targetW = qMin(workW - 64, 980);
        targetH = qMin(workH - 40, 680);
        targetX = (workW - targetW) / 2;
        targetY = topBarH + (workH - targetH) / 2;
    }

    focusWindow(xid);
    XMoveResizeWindow(m_display, win, targetX, targetY,
                      static_cast<unsigned int>(qMax(200, targetW)),
                      static_cast<unsigned int>(qMax(150, targetH)));
    XFlush(m_display);
    refresh();
    return true;
}
