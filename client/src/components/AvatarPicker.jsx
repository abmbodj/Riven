import React, { useState, useRef, useEffect, useContext } from 'react';
import { Camera, X, Upload, Trash2 } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { UIContext } from '../context/UIContext';

export default function AvatarPicker({ currentAvatar, onSelect, onClose }) {
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);
    const { hideNav, showBottomNav } = useContext(UIContext);

    // Hide bottom nav when this component mounts
    useEffect(() => {
        hideNav();
        return () => showBottomNav();
    }, [hideNav, showBottomNav]);

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            setError('Image must be less than 2MB');
            return;
        }

        setError('');
        setLoading(true);

        // Convert to base64 data URL
        const reader = new FileReader();
        reader.onload = (event) => {
            // If the image is a GIF, skip canvas resizing so we don't lose animation
            if (file.type === 'image/gif') {
                setPreview(event.target.result);
                setLoading(false);
                return;
            }

            // Resize static images to max 512x512 for better quality while being storage efficient
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxSize = 512;
                let { width, height } = img;

                if (width > height) {
                    if (width > maxSize) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to WebP / JPEG at higher quality
                const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                setPreview(dataUrl);
                setLoading(false);
            };
            img.onerror = () => {
                setError('Failed to process image');
                setLoading(false);
            };
            img.src = event.target.result;
        };
        reader.onerror = () => {
            setError('Failed to read file');
            setLoading(false);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = () => {
        if (preview) {
            onSelect(preview);
        }
    };

    const handleRemove = () => {
        onSelect(null);
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
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
                    <h3 className="text-lg font-display font-bold">Change Avatar</h3>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 active:bg-claude-bg rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-claude-secondary" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="flex flex-col items-center gap-6">
                        {/* Preview */}
                        <div className="relative">
                            <div className="w-32 h-32 rounded-full overflow-hidden bg-claude-bg border-4 border-claude-border shadow-lg">
                                {loading ? (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <LoadingSpinner size="md" />
                                    </div>
                                ) : preview ? (
                                    <img
                                        src={preview}
                                        alt="Preview"
                                        className="w-full h-full object-cover"
                                    />
                                ) : currentAvatar && !currentAvatar.startsWith('gradient:') ? (
                                    <img
                                        src={currentAvatar}
                                        alt="Current"
                                        className="w-full h-full object-cover"
                                    />
                                ) : currentAvatar?.startsWith('gradient:') ? (
                                    <div
                                        className="w-full h-full"
                                        style={{ background: currentAvatar.replace('gradient:', '') }}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-claude-secondary">
                                        <Camera className="w-12 h-12" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        {/* Upload button */}
                        <button
                            onClick={triggerFileInput}
                            disabled={loading}
                            className="flex items-center gap-3 px-6 py-3 bg-claude-accent text-white rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50"
                        >
                            <Upload className="w-5 h-5" />
                            Choose Photo
                        </button>

                        {error && (
                            <p className="text-red-500 text-sm text-center">{error}</p>
                        )}

                        <p className="text-xs text-claude-secondary text-center max-w-xs">
                            Upload any image file (JPG, PNG, GIF). Max 2MB. Image will be resized to fit.
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div
                    className="p-4 border-t border-claude-border space-y-3 shrink-0"
                    style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 16px)' }}
                >
                    {preview && (
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="w-full py-3 bg-claude-accent text-white rounded-xl font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            Save Avatar
                        </button>
                    )}

                    {currentAvatar && (
                        <button
                            onClick={handleRemove}
                            disabled={loading}
                            className="w-full py-3 text-red-500 font-medium flex items-center justify-center gap-2 active:bg-red-500/10 rounded-xl transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Remove Avatar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
