import React, { useState } from 'react';
import X from 'lucide-react/dist/esm/icons/x';
import Smartphone from 'lucide-react/dist/esm/icons/smartphone';
import Share from 'lucide-react/dist/esm/icons/share';
import PlusSquare from 'lucide-react/dist/esm/icons/plus-square';

export default function MobileWarning() {
    const [isVisible, setIsVisible] = useState(() => {
        // Initialize state synchronously to avoid effect setState issues
        if (typeof window === 'undefined') return false;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
        const isDismissed = localStorage.getItem('riven-install-prompt-dismissed');
        // Show on mobile if not already installed as PWA and not dismissed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        return isMobile && !isDismissed && !isStandalone;
    });

    const [showInstructions, setShowInstructions] = useState(false);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem('riven-install-prompt-dismissed', 'true');
    };

    if (!isVisible) return null;

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+5rem)] sm:pb-6">
            <div className="pointer-events-auto w-full max-w-sm glass-panel rounded-3xl border border-claude-accent/30 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] animate-in slide-in-from-bottom-4 duration-200 max-h-[75vh] overflow-y-auto">
                {!showInstructions ? (
                    <>
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-claude-accent/20 flex items-center justify-center shrink-0">
                                    <Smartphone className="w-6 h-6 text-claude-accent" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-display font-bold">Install Riven</h3>
                                    <p className="text-claude-secondary text-sm leading-relaxed">
                                        Add it to your home screen for faster launch, offline support, and a more app-like study flow.
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleDismiss}
                                className="touch-target shrink-0 rounded-xl text-claude-secondary hover:text-claude-text"
                                aria-label="Dismiss install prompt"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Actions */}
                        <div className="space-y-3">
                            <button
                                onClick={() => setShowInstructions(true)}
                                className="w-full py-3.5 rounded-xl font-semibold bg-claude-accent text-white active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
                            >
                                <PlusSquare className="w-5 h-5" />
                                Show Install Steps
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="w-full py-2 text-claude-secondary font-medium text-sm"
                            >
                                Continue in Browser
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Back button */}
                        <button 
                            onClick={() => setShowInstructions(false)}
                            className="text-claude-secondary text-sm mb-4 flex items-center gap-1"
                        >
                            ← Back
                        </button>

                        {/* Title */}
                        <h3 className="text-xl font-display font-bold text-center mb-2">
                            {isIOS ? 'Install on iPhone' : 'Install on Android'}
                        </h3>

                        {isIOS ? (
                            /* iOS Instructions */
                            <div className="space-y-4 mt-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-full bg-claude-accent/20 flex items-center justify-center shrink-0">
                                        <span className="text-claude-accent font-bold">1</span>
                                    </div>
                                    <div>
                                        <p className="font-medium">Tap the Share button</p>
                                        <p className="text-claude-secondary text-sm">At the bottom of Safari (square with arrow pointing up)</p>
                                        <div className="mt-2 p-3 bg-claude-bg rounded-xl inline-flex">
                                            <Share className="w-6 h-6 text-blue-500" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-full bg-claude-accent/20 flex items-center justify-center shrink-0">
                                        <span className="text-claude-accent font-bold">2</span>
                                    </div>
                                    <div>
                                        <p className="font-medium">Scroll down and tap</p>
                                        <div className="mt-2 p-3 bg-claude-bg rounded-xl flex items-center gap-3">
                                            <PlusSquare className="w-6 h-6 text-claude-text" />
                                            <span className="font-medium">Add to Home Screen</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-full bg-claude-accent/20 flex items-center justify-center shrink-0">
                                        <span className="text-claude-accent font-bold">3</span>
                                    </div>
                                    <div>
                                        <p className="font-medium">Tap "Add" in the top right</p>
                                        <p className="text-claude-secondary text-sm">Riven will appear on your home screen like a regular app!</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Android Instructions */
                            <div className="space-y-4 mt-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-full bg-claude-accent/20 flex items-center justify-center shrink-0">
                                        <span className="text-claude-accent font-bold">1</span>
                                    </div>
                                    <div>
                                        <p className="font-medium">Tap the menu button</p>
                                        <p className="text-claude-secondary text-sm">Three dots (⋮) in the top right of Chrome</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-full bg-claude-accent/20 flex items-center justify-center shrink-0">
                                        <span className="text-claude-accent font-bold">2</span>
                                    </div>
                                    <div>
                                        <p className="font-medium">Tap "Add to Home screen"</p>
                                        <p className="text-claude-secondary text-sm">Or "Install app" if you see it</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-full bg-claude-accent/20 flex items-center justify-center shrink-0">
                                        <span className="text-claude-accent font-bold">3</span>
                                    </div>
                                    <div>
                                        <p className="font-medium">Tap "Add" to confirm</p>
                                        <p className="text-claude-secondary text-sm">Riven will appear on your home screen!</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Done button */}
                        <button
                            onClick={handleDismiss}
                            className="w-full py-4 rounded-xl font-semibold bg-claude-accent text-white active:scale-[0.97] transition-transform mt-6"
                        >
                            Got it!
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
