import { Component } from 'react';
import { cache } from '../../utils/cache';

export class GroupErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error) {
        console.error('[GroupErrorBoundary] Render error in group page:', error);
        // Clear potentially corrupt persisted cache that may have caused the error
        try { cache.clearPersistent(); } catch { /* ignore */ }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
                    <h2 className="text-xl font-bold text-claude-text mb-3">Something went wrong</h2>
                    <p className="text-sm text-claude-secondary mb-6">
                        Please refresh to continue.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-claude-accent text-claude-text font-bold rounded-2xl hover:opacity-90 transition-opacity"
                    >
                        Refresh
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
