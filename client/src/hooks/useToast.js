import { useContext } from 'react';
import { ToastContext } from '../components/Toast';

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        return { show: () => {}, success: () => {}, error: () => {} };
    }
    return context;
}
