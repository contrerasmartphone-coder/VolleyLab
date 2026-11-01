import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle, Info, CheckCircle2, XCircle, X, HelpCircle } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export interface PromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  required?: boolean;
}

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface DialogContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
  showToast: (messageOrOptions: string | { message: string; title?: string; type?: 'success' | 'error' | 'info' | 'warning'; duration?: number }) => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Confirm state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  // Prompt state
  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    options: PromptOptions;
    value: string;
    resolve: (value: string | null) => void;
  } | null>(null);

  // Toasts state
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Show in-app confirm dialog
  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        options: {
          confirmText: 'Conferma',
          cancelText: 'Annulla',
          type: 'danger',
          ...options,
        },
        resolve,
      });
    });
  }, []);

  const handleConfirmClose = (result: boolean) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  // Show in-app prompt dialog
  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptState({
        isOpen: true,
        options: {
          confirmText: 'Invia',
          cancelText: 'Annulla',
          defaultValue: '',
          required: false,
          ...options,
        },
        value: options.defaultValue || '',
        resolve,
      });
    });
  }, []);

  const handlePromptClose = (submit: boolean) => {
    if (promptState) {
      if (submit) {
        promptState.resolve(promptState.value);
      } else {
        promptState.resolve(null);
      }
      setPromptState(null);
    }
  };

  // Show in-app Toast notification
  const showToast = useCallback((messageOrOptions: string | { message: string; title?: string; type?: 'success' | 'error' | 'info' | 'warning'; duration?: number }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newItem: ToastItem = typeof messageOrOptions === 'string'
      ? { id, message: messageOrOptions, type: 'success', duration: 3500 }
      : {
          id,
          message: messageOrOptions.message,
          title: messageOrOptions.title,
          type: messageOrOptions.type || 'success',
          duration: messageOrOptions.duration || 3500,
        };

    setToasts((prev) => [...prev, newItem]);

    if (newItem.duration && newItem.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, newItem.duration);
    }
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <DialogContext.Provider value={{ confirm, prompt, showToast }}>
      {children}

      {/* IN-APP CONFIRMATION MODAL */}
      {confirmState && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-[#11141d] border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top decorative glow */}
            <div
              className={`absolute top-0 left-0 right-0 h-1.5 ${
                confirmState.options.type === 'danger'
                  ? 'bg-rose-500'
                  : confirmState.options.type === 'warning'
                  ? 'bg-amber-500'
                  : 'bg-cyan-500'
              }`}
            />

            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-2xl shrink-0 ${
                  confirmState.options.type === 'danger'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : confirmState.options.type === 'warning'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                }`}
              >
                {confirmState.options.type === 'danger' && <AlertTriangle className="w-6 h-6" />}
                {confirmState.options.type === 'warning' && <AlertTriangle className="w-6 h-6" />}
                {confirmState.options.type === 'info' && <HelpCircle className="w-6 h-6" />}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white font-display">
                  {confirmState.options.title}
                </h3>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                  {confirmState.options.message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => handleConfirmClose(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
              >
                {confirmState.options.cancelText || 'Annulla'}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmClose(true)}
                autoFocus
                className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all cursor-pointer ${
                  confirmState.options.type === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/40 hover:scale-[1.02]'
                    : confirmState.options.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/40 hover:scale-[1.02]'
                    : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/40 hover:scale-[1.02]'
                }`}
              >
                {confirmState.options.confirmText || 'Conferma'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP PROMPT MODAL */}
      {promptState && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-[#11141d] border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500" />

            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl shrink-0 bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white font-display">
                  {promptState.options.title}
                </h3>
                {promptState.options.message && (
                  <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                    {promptState.options.message}
                  </p>
                )}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handlePromptClose(true);
              }}
              className="mt-4"
            >
              <div className="mb-5">
                <input
                  type="text"
                  autoFocus
                  required={promptState.options.required}
                  value={promptState.value}
                  onChange={(e) =>
                    setPromptState((prev) => (prev ? { ...prev, value: e.target.value } : null))
                  }
                  placeholder={promptState.options.placeholder || 'Inserisci testo...'}
                  className="w-full px-4 py-3 bg-[#0b0e14] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-sm transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => handlePromptClose(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  {promptState.options.cancelText || 'Annulla'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 shadow-lg shadow-amber-950/40 hover:scale-[1.02] transition-all cursor-pointer"
                >
                  {promptState.options.confirmText || 'Invia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IN-APP TOAST NOTIFICATIONS */}
      <div className="fixed bottom-5 right-5 z-[110] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all animate-in slide-in-from-bottom-3 duration-200 ${
              t.type === 'success'
                ? 'bg-[#11141d]/95 border-emerald-500/30 text-emerald-300'
                : t.type === 'error'
                ? 'bg-[#11141d]/95 border-rose-500/30 text-rose-300'
                : t.type === 'warning'
                ? 'bg-[#11141d]/95 border-amber-500/30 text-amber-300'
                : 'bg-[#11141d]/95 border-cyan-500/30 text-cyan-300'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {t.type === 'error' && <XCircle className="w-5 h-5 text-rose-400" />}
              {t.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
              {t.type === 'info' && <Info className="w-5 h-5 text-cyan-400" />}
            </div>
            <div className="flex-1 min-w-0">
              {t.title && <div className="text-xs font-bold uppercase tracking-wider text-white mb-0.5">{t.title}</div>}
              <div className="text-sm font-medium text-slate-200 leading-snug">{t.message}</div>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </DialogContext.Provider>
  );
};

export const useDialog = (): DialogContextType => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
