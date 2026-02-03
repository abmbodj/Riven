import { Link } from 'react-router-dom';
import { Home, Sprout } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="fullscreen-page items-center justify-center p-6">
            <div className="text-center max-w-sm">
                <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-claude-surface border border-claude-border flex items-center justify-center">
                    <Sprout className="w-10 h-10 text-claude-secondary" />
                </div>
                <h1 className="text-4xl font-display font-bold mb-2">404</h1>
                <p className="text-claude-secondary mb-8">
                    This path has yet to bloom... the page you're looking for doesn't exist.
                </p>
                <Link
                    to="/"
                    className="claude-button-primary px-6 py-3 inline-flex items-center gap-2 tap-action"
                >
                    <Home className="w-5 h-5" />
                    Back Home
                </Link>
            </div>
        </div>
    );
}
