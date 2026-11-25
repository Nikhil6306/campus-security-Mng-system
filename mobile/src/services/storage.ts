import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const STORAGE_KEY_PREFIX = '@csms_guard_';
const STORE_FILENAME = 'csms_guard_store.json';

/**
 * Robust universal key-value persistence for Mobile (Expo Android/iOS) and Web.
 * Uses FileSystem on native devices to guarantee durability across app restarts and reboots.
 */
class SimpleStorage {
  private memCache: Map<string, string> = new Map();
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;
  private saveTimer: any = null;

  constructor() {
    this.loadPromise = this.init();
  }

  private async getStoreFilePath(): Promise<string | null> {
    if (Platform.OS === 'web') return null;
    try {
      const docDir = FileSystem.documentDirectory;
      if (docDir) {
        return `${docDir}${STORE_FILENAME}`;
      }
    } catch {
      // Ignore
    }
    return null;
  }

  private async init(): Promise<void> {
    if (this.isLoaded) return;

    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
              const val = window.localStorage.getItem(key);
              if (val !== null) this.memCache.set(key, val);
            }
          }
        }
      } else {
        const filePath = await this.getStoreFilePath();
        if (filePath) {
          const info = await FileSystem.getInfoAsync(filePath);
          if (info.exists) {
            const content = await FileSystem.readAsStringAsync(filePath);
            const parsed = JSON.parse(content);
            if (parsed && typeof parsed === 'object') {
              for (const [k, v] of Object.entries(parsed)) {
                if (typeof v === 'string') {
                  this.memCache.set(k, v);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[storage] Storage initialization error:', err);
    } finally {
      this.isLoaded = true;
    }
  }

  private scheduleSave(): void {
    if (Platform.OS === 'web') return;
    if (this.saveTimer) clearTimeout(this.saveTimer);

    this.saveTimer = setTimeout(async () => {
      try {
        const filePath = await this.getStoreFilePath();
        if (filePath) {
          const obj: Record<string, string> = {};
          this.memCache.forEach((value, key) => {
            obj[key] = value;
          });
          await FileSystem.writeAsStringAsync(filePath, JSON.stringify(obj));
        }
      } catch (err) {
        console.warn('[storage] Failed to save storage file:', err);
      }
    }, 200);
  }

  async getItem(key: string): Promise<string | null> {
    if (!this.isLoaded && this.loadPromise) {
      await this.loadPromise;
    }
    const prefixed = `${STORAGE_KEY_PREFIX}${key}`;
    return this.memCache.get(prefixed) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!this.isLoaded && this.loadPromise) {
      await this.loadPromise;
    }
    const prefixed = `${STORAGE_KEY_PREFIX}${key}`;
    this.memCache.set(prefixed, value);

    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(prefixed, value);
        }
      } catch {}
    } else {
      this.scheduleSave();
    }
  }

  async removeItem(key: string): Promise<void> {
    if (!this.isLoaded && this.loadPromise) {
      await this.loadPromise;
    }
    const prefixed = `${STORAGE_KEY_PREFIX}${key}`;
    this.memCache.delete(prefixed);

    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(prefixed);
        }
      } catch {}
    } else {
      this.scheduleSave();
    }
  }
}

export const appStorage = new SimpleStorage();
