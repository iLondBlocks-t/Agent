import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export interface TaskServicePlugin {
  start(options: { title: string; text: string }): Promise<void>;
  update(options: { text: string; progress: number }): Promise<void>;
  stop(): Promise<void>;
}

/** Custom Android foreground-service plugin (installed by scripts/patch-android.mjs). */
const TaskService = registerPlugin<TaskServicePlugin>('TaskService', {
  web: {
    async start() { /* no-op on web */ },
    async update() { /* no-op on web */ },
    async stop() { /* no-op on web */ },
  } as any,
});

let notifId = 1;
let permissionAsked = false;

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    if (!permissionAsked) {
      permissionAsked = true;
      const status = await LocalNotifications.checkPermissions();
      if (status.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        return req.display === 'granted';
      }
    }
    return true;
  } catch { return false; }
}

export async function notify(title: string, body: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    console.info(`[notify] ${title}: ${body}`);
    return;
  }
  const ok = await ensureNotificationPermission();
  if (!ok) return;
  try {
    await LocalNotifications.schedule({
      notifications: [{ id: notifId++, title, body, smallIcon: 'ic_stat_icon', channelId: 'maao-tasks' }],
    });
  } catch { /* ignore */ }
}

export async function startForeground(text: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try { await TaskService.start({ title: 'منسّق الوكلاء يعمل', text }); } catch { /* plugin missing */ }
}

export async function updateForeground(text: string, progress: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try { await TaskService.update({ text, progress }); } catch { /* ignore */ }
}

export async function stopForeground(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try { await TaskService.stop(); } catch { /* ignore */ }
}

export async function haptic(style: 'light' | 'medium' | 'heavy' = 'light'): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
  try { await Haptics.impact({ style: map[style] }); } catch { /* ignore */ }
}

export async function initNativeChannels(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: 'maao-tasks', name: 'مهام الوكلاء', description: 'إشعارات تقدّم المهام والموافقات',
      importance: 4, visibility: 1,
    });
  } catch { /* ignore */ }
}
