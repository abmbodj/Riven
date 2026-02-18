import React, { useState } from 'react';
import X from 'lucide-react/dist/esm/icons/x';
import Smartphone from 'lucide-react/dist/esm/icons/smartphone';
import Share from 'lucide-react/dist/esm/icons/share';
import PlusSquare from 'lucide-react/dist/esm/icons/plus-square';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';

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
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={handleDismiss}
        >
            <div 
                className="w-full max-w-sm bg-claude-surface rounded-3xl border border-claude-accent/30 p-6 animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {!showInstructions ? (
                    <>
                        {/* Icon */}
                        <div className="flex justify-center mb-4">
                            <div className="w-16 h-16 rounded-full bg-claude-accent/20 flex items-center justify-center">
                                <Smartphone className="w-8 h-8 text-claude-accent" />
                            </div>
                        </div>

                        {/* Title */}
                        <h3 className="text-xl font-display font-bold text-center mb-2">Install Riven</h3>

                        {/* Message */}
                        <p className="text-claude-secondary text-center text-sm leading-relaxed mb-6">
                            Add Riven to your home screen for the best experience — faster access, offline support, and a native app feel!
                        </p>

                        {/* Actions */}
                        <div className="space-y-3">
                            <button
                                onClick={() => setShowInstructions(true)}
                                className="w-full py-4 rounded-xl font-semibold bg-claude-accent text-white active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
                            >
                                <PlusSquare className="w-5 h-5" />
                                How to Install
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="w-full py-3 text-claude-secondary font-medium text-sm"
                            >
                                Maybe Later
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
