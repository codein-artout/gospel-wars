'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type ToastItem = { id: number; text: string; tone: 'info' | 'error' };
type Ctx = { show: (text: string, tone?: ToastItem['tone']) => void };

const ToastContext = createContext<Ctx>({ show: () => undefined });

export function useToast(): Ctx {
  return useContext(ToastContext);
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((text: string, tone: ToastItem['tone'] = 'info') => {
    const id = nextId++;
    setItems((xs) => [...xs, { id, text, tone }]);
  }, []);
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed bottom-[88px] right-4 z-50 flex flex-col gap-2 md:bottom-6 md:right-6">
        {items.map((t) => (
          <ToastView key={t.id} item={t} onDone={() => setItems((xs) => xs.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4500);
    return () => clearTimeout(t);
  }, [onDone]);
  return <Toast text={item.text} tone={item.tone} />;
}

export function Toast({ text, tone = 'info' }: { text: string; tone?: 'info' | 'error' }) {
  return (
    <div
      className="toast-in pointer-events-auto max-w-sm rounded-panel border px-4 py-3 text-[15px]"
      style={{
        background: tone === 'error' ? 'var(--heresy-bg)' : 'var(--panel)',
        borderColor: tone === 'error' ? 'var(--heresy-edge)' : 'var(--gold)',
        color: tone === 'error' ? 'var(--heresy-text)' : 'var(--text)',
      }}
    >
      {text}
    </div>
  );
}
