import React from 'react';
import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

export default function Layout({ children }) {
    return (
        <div className="min-h-screen bg-claude-bg text-claude-text font-sans selection:bg-claude-accent selection:text-white">
            <header className="bg-claude-bg/80 backdrop-blur-md sticky top-0 z-10 border-b border-claude-border/50">
                <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2.5 group">
                        <div className="w-8 h-8 bg-claude-text rounded-lg flex items-center justify-center group-hover:bg-claude-accent transition-colors duration-300">
                            <Zap className="w-5 h-5 text-white fill-current" />
                        </div>
                        <span className="font-display font-bold text-xl tracking-tight">FlashZap</span>
                    </Link>
                    <nav className="flex items-center gap-6">
                        <Link to="/" className="text-sm font-medium text-claude-secondary hover:text-claude-text transition-colors">Library</Link>
                        <Link to="/create" className="claude-button-primary text-sm py-1.5 px-4">New Deck</Link>
                    </nav>
                </div>
            </header>
            <main className="max-w-4xl mx-auto px-6 py-10">
                {children}
            </main>
        </div>
    );
}
