import React from 'react';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import { captureException } from '../sentry.js';
import {
    attemptDeployUpdateRecovery,
    isDeployUpdateError,
    persistAppErrorDiagnostic,
    recoverStaleDeployAssets,
} from '../utils/deployUpdateRecovery.js';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, isRecoveringAssets: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        if (attemptDeployUpdateRecovery(error)) {
            return;
        }

        persistAppErrorDiagnostic(error);

        if (typeof window !== 'undefined') {
            window.__RIVEN_LAST_APP_ERROR = {
                message: error?.message || 'Unknown error',
                stack: error?.stack || '',
                componentStack: errorInfo?.componentStack || '',
                timestamp: new Date().toISOString(),
            };
        }
        captureException(error, { extra: { componentStack: errorInfo?.componentStack } });
        console.error('App error:', error, errorInfo);
    }

    handleReset = () => {
        try {
            sessionStorage.removeItem('riven:deploy-update-recovery-attempted');
        } catch {
            // private browsing or storage quota — safe to ignore
        }
        this.setState({ hasError: false, error: null });
        window.location.href = '/';
    };

    handleAssetRecovery = async () => {
        this.setState({ isRecoveringAssets: true });
        const recovered = await recoverStaleDeployAssets(this.state.error);
        if (!recovered) this.setState({ isRecoveringAssets: false });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 bg-claude-bg flex items-center justify-center p-6">
                    <div className="text-center max-w-sm">
                        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                        <h1 className="text-xl font-display font-bold mb-2">Something went wrong</h1>
                        <p className="text-claude-secondary mb-2">
                            Don&apos;t worry, your data is safe. Try refreshing the page.
                        </p>
                        {isDeployUpdateError(this.state.error) && (
                            <button
                                onClick={this.handleAssetRecovery}
                                disabled={this.state.isRecoveringAssets}
                                className="mb-3 text-sm text-claude-accent underline disabled:opacity-50"
                            >
                                {this.state.isRecoveringAssets ? 'Recovering app assets…' : 'Recover app assets'}
                            </button>
                        )}
                        {import.meta.env.DEV && (
                            <div className="text-left bg-black/10 p-4 rounded text-xs text-red-500 overflow-auto max-h-48 mb-6">
                                <strong>{this.state.error?.message}</strong>
                                <pre className="mt-2 text-[10px]">{this.state.error?.stack}</pre>
                            </div>
                        )}
                        <button
                            onClick={this.handleReset}
                            className="claude-button-primary px-6 py-3 flex items-center gap-2 mx-auto"
                        >
                            <RefreshCw className="w-5 h-5" />
                            Refresh App
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
