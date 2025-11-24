const STORAGE_TEST_KEY = '__storage_test__';

let storageAvailable: boolean | null = null;

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  if (storageAvailable === false) return null;
  try {
    if (!storageAvailable) {
      window.localStorage.setItem(STORAGE_TEST_KEY, '1');
      window.localStorage.removeItem(STORAGE_TEST_KEY);
      storageAvailable = true;
    }
    return window.localStorage;
  } catch {
    storageAvailable = false;
    return null;
  }
};

export const safeLocalStorage = {
  get(key: string): string | null {
    const storage = getStorage();
    if (!storage) return null;
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): boolean {
    const storage = getStorage();
    if (!storage) return false;
    try {
      storage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string): void {
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
  }
};
