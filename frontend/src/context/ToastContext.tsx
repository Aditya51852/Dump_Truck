// src/context/ToastContext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ToastNotification } from '../types';

interface ToastContextType {
  toasts: ToastNotification[];
  addToast: (toast: Omit<ToastNotification, 'id' | 'timestamp'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = useCallback(
    (toast: Omit<ToastNotification, 'id' | 'timestamp'>) => {
      const newToast: ToastNotification = {
        ...toast,
        id: `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date(),
      };
      setToasts((prev) => [newToast, ...prev].slice(0, 10));

      // Auto-remove after 5 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 5000);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
