import React, { useState, useCallback, useRef } from 'react';
import Check from 'lucide-react/dist/esm/icons/check';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import X from 'lucide-react/dist/esm/icons/x';
import { ToastContext } from '../contexts/ToastContext';
export { ToastContext };



export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const idCounter = useRef(0);

    const dismiss = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const show = useCallback((message, type = 'success') => {
        const id = ++idCounter.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3500);
    }, []);

    const success = useCallback((message) => show(message, 'success'), [show]);
    const error = useCallback((message) => show(message, 'error'), [show]);

    return (
        <ToastContext.Provider value={{ show, success, error }}>
            {children}
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="fixed top-16 left-4 right-4 z-50 flex flex-col gap-2"
            >
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-top duration-300 ${toast.type === 'success'
                                ? 'bg-green-500 text-white'
                                : 'bg-red-500 text-white'
                            }`}
                    >
                        {toast.type === 'success' ? (
                            <Check className="w-5 h-5 shrink-0" />
                        ) : (
                            <AlertCircle className="w-5 h-5 shrink-0" />
                        )}
                        <span className="font-medium text-sm flex-1">{toast.message}</span>
                        <button
                            onClick={() => dismiss(toast.id)}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 -mr-2 rounded-lg active:opacity-70 transition-opacity"
                            aria-label="Dismiss notification"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
