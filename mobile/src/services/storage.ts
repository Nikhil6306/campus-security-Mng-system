import { Platform } from 'react-native';

const STORAGE_KEY_PREFIX = '@csms_guard_';

/**
 * Universal key-value persistence for Mobile (Expo/React Native) and Web.
 */
class SimpleStorage {
  private memCache: Map<string, string> = new Map();

  async getItem(key: string): Promise<string | null> {
    const prefixed = `${STORAGE_KEY_PREFIX}${key}`;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(prefixed);
      }
    } catch {
      // Fallback to in-memory
    }
    return this.memCache.get(prefixed) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    const prefixed = `${STORAGE_KEY_PREFIX}${key}`;
    this.memCache.set(prefixed, value);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(prefixed, value);
      }
    } catch {
      // Fallback
    }
  }

  async removeItem(key: string): Promise<void> {
    const prefixed = `${STORAGE_KEY_PREFIX}${key}`;
    this.memCache.delete(prefixed);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(prefixed);
      }
    } catch {
      // Fallback
    }
  }
}

export const appStorage = new SimpleStorage();
