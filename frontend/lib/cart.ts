import { safeLocalStorage } from './safeStorage';

export type CartDraft = Record<string, number>;

export const CART_STORAGE_KEY = 'menu.cart';

declare global {
  interface WindowEventMap {
    'menu-cart-change': CustomEvent<CartDraft>;
  }
}

const sanitizeCartDraft = (value: unknown): CartDraft => {
  if (!value || typeof value !== 'object') return {};
  const entries = Object.entries(value as Record<string, unknown>);
  const next: CartDraft = {};
  entries.forEach(([id, qty]) => {
    const numeric = typeof qty === 'number' ? qty : Number(qty);
    if (Number.isFinite(numeric) && numeric > 0) {
      next[id] = Math.floor(numeric);
    }
  });
  return next;
};

const emitChange = (payload: CartDraft) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<CartDraft>('menu-cart-change', { detail: payload }));
};

export const readCartDraft = (): CartDraft => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = safeLocalStorage.get(CART_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return sanitizeCartDraft(parsed);
  } catch {
    return {};
  }
};

export const writeCartDraft = (draft: CartDraft): void => {
  if (typeof window === 'undefined') return;
  const sanitized = sanitizeCartDraft(draft);
  const keys = Object.keys(sanitized);
  if (keys.length === 0) {
    safeLocalStorage.remove(CART_STORAGE_KEY);
    emitChange({});
    return;
  }
  safeLocalStorage.set(CART_STORAGE_KEY, JSON.stringify(sanitized));
  emitChange(sanitized);
};

export const clearCartDraft = (): void => {
  if (typeof window === 'undefined') return;
  safeLocalStorage.remove(CART_STORAGE_KEY);
  emitChange({});
};
