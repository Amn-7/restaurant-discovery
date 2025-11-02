'use client';

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState
} from 'react';

type ToastVariant = 'default' | 'success' | 'error';

type ToastOptions = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastEntry = ToastOptions & { id: number };

type ToastContextValue = {
  push: (options: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timers = useRef<Map<number, NodeJS.Timeout>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (options: ToastOptions) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const entry: ToastEntry = {
        id,
        variant: 'default',
        duration: 4000,
        ...options
      };

      setToasts((prev) => [...prev, entry]);

      const timer = setTimeout(() => dismiss(id), entry.duration);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.variant ?? 'default'}`}>
            <div className="toast__title">{toast.title}</div>
            {toast.description ? <div className="toast__description">{toast.description}</div> : null}
            <button
              type="button"
              className="toast__close"
              aria-label="Close notification"
              onClick={() => dismiss(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
