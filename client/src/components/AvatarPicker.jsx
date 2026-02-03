import React, { useState } from 'react';
import { Camera, X, Image, Link2, Check } from 'lucide-react';

// Default avatar options
const DEFAULT_AVATARS = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Midnight',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucky',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Bubba',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Willow',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Aneka',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Midnight',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Lucky',
];

// Gradient backgrounds
const GRADIENT_AVATARS = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
];

export default function AvatarPicker({ currentAvatar, onSelect, onClose }) {
    const [tab, setTab] = useState('avatars'); // avatars, gradients, url
    const [customUrl, setCustomUrl] = useState('');
    const [previewUrl, setPreviewUrl] = useState('');
    const [urlError, setUrlError] = useState('');

    const handleUrlSubmit = () => {
        if (!customUrl.trim()) {
            setUrlError('Please enter a URL');
            return;
        }
        
        // Basic URL validation
        try {
            new URL(customUrl);
            onSelect(customUrl);
        } catch {
            setUrlError('Please enter a valid URL');
        }
    };

    const handleUrlPreview = (url) => {
        setCustomUrl(url);
        setUrlError('');
        if (url.trim()) {
            try {
                new URL(url);
                setPreviewUrl(url);
            } catch {
                setPreviewUrl('');
            }
        } else {
            setPreviewUrl('');
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-end"
            onClick={onClose}
        >
            <div 
                className="bg-claude-surface w-full rounded-t-3xl animate-in slide-in-from-bottom duration-300 max-h-[80vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-claude-border shrink-0">
                    <h3 className="text-lg font-display font-bold">Choose Avatar</h3>
                    <button onClick={onClose} className="p-2 -mr-2 active:bg-claude-bg rounded-full">
                        <X className="w-5 h-5 text-claude-secondary" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-claude-border shrink-0">
                    <button
                        onClick={() => setTab('avatars')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${
                            tab === 'avatars' ? 'text-claude-accent border-b-2 border-claude-accent' : 'text-claude-secondary'
                        }`}
                    >
                        <Image className="w-4 h-4 inline mr-2" />
                        Avatars
                    </button>
                    <button
                        onClick={() => setTab('gradients')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${
                            tab === 'gradients' ? 'text-claude-accent border-b-2 border-claude-accent' : 'text-claude-secondary'
                        }`}
                    >
                        <Camera className="w-4 h-4 inline mr-2" />
                        Colors
                    </button>
                    <button
                        onClick={() => setTab('url')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${
                            tab === 'url' ? 'text-claude-accent border-b-2 border-claude-accent' : 'text-claude-secondary'
                        }`}
                    >
                        <Link2 className="w-4 h-4 inline mr-2" />
                        Custom URL
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {tab === 'avatars' && (
                        <div className="grid grid-cols-4 gap-3">
                            {DEFAULT_AVATARS.map((url, i) => (
                                <button
                                    key={i}
                                    onClick={() => onSelect(url)}
                                    className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all ${
                                        currentAvatar === url 
                                            ? 'border-claude-accent scale-95' 
                                            : 'border-transparent hover:border-claude-accent/50'
                                    }`}
                                >
                                    <img src={url} alt="" className="w-full h-full object-cover bg-claude-bg" />
                                    {currentAvatar === url && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                            <Check className="w-6 h-6 text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {tab === 'gradients' && (
                        <div className="grid grid-cols-3 gap-3">
                            {GRADIENT_AVATARS.map((gradient, i) => (
                                <button
                                    key={i}
                                    onClick={() => onSelect(`gradient:${gradient}`)}
                                    className={`aspect-square rounded-2xl border-2 transition-all ${
                                        currentAvatar === `gradient:${gradient}` 
                                            ? 'border-claude-accent scale-95' 
                                            : 'border-transparent hover:border-claude-accent/50'
                                    }`}
                                    style={{ background: gradient }}
                                >
                                    {currentAvatar === `gradient:${gradient}` && (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Check className="w-6 h-6 text-white drop-shadow-md" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {tab === 'url' && (
                        <div className="space-y-4">
                            <p className="text-sm text-claude-secondary">
                                Enter a URL to any image or GIF you'd like to use as your avatar.
                            </p>
                            
                            {/* Preview */}
                            <div className="flex justify-center">
                                <div className="w-24 h-24 rounded-full overflow-hidden bg-claude-bg border-2 border-claude-border">
                                    {previewUrl ? (
                                        <img 
                                            src={previewUrl} 
                                            alt="Preview" 
                                            className="w-full h-full object-cover"
                                            onError={() => {
                                                setPreviewUrl('');
                                                setUrlError('Could not load image');
                                            }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-claude-secondary">
                                            <Camera className="w-8 h-8" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div>
                                <input
                                    type="url"
                                    value={customUrl}
                                    onChange={e => handleUrlPreview(e.target.value)}
                                    placeholder="https://example.com/avatar.gif"
                                    className="w-full px-4 py-3 bg-claude-bg border border-claude-border rounded-xl focus:border-claude-accent outline-none"
                                />
                                {urlError && (
                                    <p className="text-red-500 text-sm mt-1">{urlError}</p>
                                )}
                            </div>
                            
                            <button
                                onClick={handleUrlSubmit}
                                disabled={!previewUrl}
                                className="w-full py-3 bg-claude-accent text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Use This Avatar
                            </button>
                            
                            <p className="text-xs text-claude-secondary text-center">
                                Tip: You can use GIFs from Giphy, Tenor, or any image URL!
                            </p>
                        </div>
                    )}
                </div>

                {/* Remove Avatar Option */}
                {currentAvatar && tab !== 'url' && (
                    <div className="p-4 border-t border-claude-border">
                        <button
                            onClick={() => onSelect(null)}
                            className="w-full py-3 text-red-500 font-medium"
                        >
                            Remove Avatar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
