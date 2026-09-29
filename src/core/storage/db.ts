import { Preferences } from '@capacitor/preferences';

/**
 * Lightweight persistence layer.
 * Uses Capacitor Preferences (native: SharedPreferences / web: localStorage) as a
 * document store. Large collections (runs, audit) are chunk-free JSON documents,
 * capped to keep the app fast and fully usable offline.
 */
export interface Collections {
  providers: unknown[];
  agents: unknown[];
  runs: unknown[];
  audit: unknown[];
  approvals: unknown[];
  settings: unknown;
  files: unknown[];
  memory: unknown[];
}

const NS = 'maao::';

export async function loadDoc<T>(name: keyof Collections, fallback: T): Promise<T> {
  try {
    const { value } = await Preferences.get({ key: NS + name });
    if (!value) return fallback;
    return JSON.parse(value) as T;
  } catch { return fallback; }
}

export async function saveDoc(name: keyof Collections, data: unknown): Promise<void> {
  try {
    await Preferences.set({ key: NS + name, value: JSON.stringify(data) });
  } catch (e) {
    console.warn('persist failed', name, (e as Error).message);
  }
}

export async function clearAll(): Promise<void> {
  await Preferences.clear();
}
