import React, { createContext, useContext, useCallback, useState } from 'react';
import * as Toast from '@radix-ui/react-toast';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextType {
  showToast: (type: ToastType, title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

const iconMap = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-400" />, 
  error: <XCircle className="w-5 h-5 text-rose-400" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
  info: <Info className="w-5 h-5 text-sky-400" />,
};

const bgMap = {
  success: 'border-emerald-500/30 bg-emerald-500/10',
  error: 'border-rose-500/30 bg-rose-500/10',
  warning: 'border-amber-500/30 bg-amber-500/10',
  info: 'border-sky-500/30 bg-sky-500/10',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((type: ToastType, title: string, description?: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      <Toast.Provider swipeDirection="right" duration={5000}>
        {children}
        {toasts.map((t) => (
          <Toast.Root
            key={t.id}
            className={`${bgMap[t.type]} border backdrop-blur-xl rounded-xl p-4 shadow-2xl animate-slide-right flex items-start gap-3 min-w-[320px]`}
            onOpenChange={(open) => {
              if (!open) setToasts((prev) => prev.filter((x) => x.id !== t.id));
            }}
          >
            <div className="mt-0.5">{iconMap[t.type]}</div>
            <div className="flex-1">
              <Toast.Title className="font-semibold text-sm text-slate-100">
                {t.title}
              </Toast.Title>
              {t.description && (
                <Toast.Description className="text-xs text-slate-400 mt-1">
                  {t.description}
                </Toast.Description>
              )}
            </div>
            <Toast.Close className="text-slate-500 hover:text-slate-300 transition-colors">
              <X className="w-4 h-4" />
            </Toast.Close>
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed bottom-6 right-6 flex flex-col gap-3 z-[100] max-w-[400px]" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
};
