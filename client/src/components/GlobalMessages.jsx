import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { X, Info, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';

export default function GlobalMessages() {
    const { isLoggedIn, getActiveMessages, dismissMessage } = useContext(AuthContext);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadMessages = useCallback(async () => {
        try {
            const data = await getActiveMessages();
            setMessages(data || []);
        } catch (err) {
            console.error('Failed to load messages:', err);
        } finally {
            setLoading(false);
        }
    }, [getActiveMessages]);

    useEffect(() => {
        if (isLoggedIn) {
            loadMessages();
        } else {
            setMessages([]);
            setLoading(false);
        }
    }, [isLoggedIn, loadMessages]);

    const handleDismiss = async (id) => {
        try {
            await dismissMessage(id);
            setMessages(messages.filter(m => m.id !== id));
        } catch (err) {
            console.error('Failed to dismiss message:', err);
        }
    };

    const getTypeStyles = (type) => {
        switch (type) {
            case 'success':
                return {
                    bg: 'bg-green-500/10 border-green-500/30',
                    icon: <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />,
                    text: 'text-green-400'
                };
            case 'warning':
                return {
                    bg: 'bg-yellow-500/10 border-yellow-500/30',
                    icon: <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />,
                    text: 'text-yellow-400'
                };
            case 'error':
                return {
                    bg: 'bg-red-500/10 border-red-500/30',
                    icon: <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />,
                    text: 'text-red-400'
                };
            default:
                return {
                    bg: 'bg-blue-500/10 border-blue-500/30',
                    icon: <Info className="w-4 h-4 text-blue-500 shrink-0" />,
                    text: 'text-blue-400'
                };
        }
    };

    if (loading || messages.length === 0) return null;

    return (
        <div className="space-y-2 mb-4">
            {messages.map(message => {
                const styles = getTypeStyles(message.type);
                return (
                    <div
                        key={message.id}
                        className={`p-3 rounded-xl border ${styles.bg} animate-in slide-in-from-top duration-300`}
                    >
                        <div className="flex items-start gap-3">
                            {styles.icon}
                            <div className="flex-1 min-w-0">
                                <h4 className={`text-sm font-semibold ${styles.text}`}>
                                    {message.title}
                                </h4>
                                <p className="text-xs text-claude-secondary mt-0.5">
                                    {message.content}
                                </p>
                            </div>
                            <button
                                onClick={() => handleDismiss(message.id)}
                                className="p-1 rounded-lg hover:bg-claude-border/30 text-claude-secondary hover:text-claude-text transition-colors shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
