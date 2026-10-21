import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AuthExpiredError } from '../services/google/auth';

type ToastKind = 'info' | 'error';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  notify: (message: string, kind?: ToastKind) => void;
  /** Show an error from a failed action. Expired sign-ins are shown by the banner instead. */
  fail: (e: unknown) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  const notify = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = next.current++;
      setToasts((ts) => [...ts.slice(-2), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 10000 : 4000);
    },
    [dismiss],
  );

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof AuthExpiredError) return;
      notify(e instanceof Error ? e.message : String(e), 'error');
    },
    [notify],
  );

  return (
    <ToastContext.Provider value={{ notify, fail }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span>{t.message}</span>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => dismiss(t.id)}>
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast outside ToastProvider');
  return ctx;
}
