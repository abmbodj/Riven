import React, { useRef, useState } from 'react';
import { Upload, Check, Loader2 } from 'lucide-react';
import { fileToResizedDataUrl } from '../../utils/imageResize';

export const AVATAR_PRESETS = [
    'gradient:linear-gradient(135deg, #2f5d50 0%, #8fc4c7 100%)',
    'gradient:linear-gradient(135deg, #deb96a 0%, #b07b3e 100%)',
    'gradient:linear-gradient(135deg, #3a4a63 0%, #8fa6a8 100%)',
    'gradient:linear-gradient(135deg, #6b8f5e 0%, #d7e4a8 100%)',
    'gradient:linear-gradient(135deg, #7a4f7d 0%, #d2a0c6 100%)',
    'gradient:linear-gradient(135deg, #b85c5c 0%, #e8b88f 100%)',
];

export default function ProfilePictureStep({ value, onChange, compactHeight = false }) {
    const fileInputRef = useRef(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const isUpload = value && !value.startsWith('gradient:');

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError('');
        setLoading(true);
        try {
            const dataUrl = await fileToResizedDataUrl(file);
            onChange(dataUrl);
        } catch (err) {
            setError(err.message || 'Failed to process image');
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    const previewStyle = isUpload
        ? { backgroundImage: `url(${value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : value
            ? { background: value.replace('gradient:', '') }
            : undefined;

    return (
        <div className={`flex flex-col items-center ${compactHeight ? 'gap-4' : 'gap-5'}`}>
            <div
                className={`rounded-full border-2 border-white/15 shadow-[0_18px_40px_-22px_rgba(0,0,0,0.7)] ${compactHeight ? 'h-24 w-24' : 'h-28 w-28'}`}
                style={previewStyle}
            >
                {loading ? (
                    <div className="flex h-full w-full items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-botanical-parchment" />
                    </div>
                ) : null}
            </div>

            <div className="grid grid-cols-6 gap-2.5">
                {AVATAR_PRESETS.map((preset) => {
                    const isSelected = value === preset;
                    return (
                        <button
                            key={preset}
                            type="button"
                            onClick={() => { setError(''); onChange(preset); }}
                            aria-pressed={isSelected}
                            aria-label="Choose preset avatar"
                            className="relative h-11 w-11 rounded-full border transition-transform duration-200 active:scale-95"
                            style={{
                                background: preset.replace('gradient:', ''),
                                borderColor: isSelected
                                    ? 'color-mix(in srgb, var(--accent-color) 80%, white)'
                                    : 'rgba(255,255,255,0.12)',
                                boxShadow: isSelected
                                    ? '0 0 0 2px color-mix(in srgb, var(--accent-color) 60%, transparent)'
                                    : 'none',
                            }}
                        >
                            {isSelected ? (
                                <span className="absolute inset-0 flex items-center justify-center">
                                    <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3} />
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFile}
                className="hidden"
            />
            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors disabled:opacity-50 ${
                    isUpload
                        ? 'border-claude-accent/60 bg-claude-accent/10 text-botanical-parchment'
                        : 'border-white/12 bg-white/[0.05] text-claude-secondary hover:text-botanical-parchment'
                }`}
            >
                <Upload className="h-4 w-4" />
                {isUpload ? 'Change photo' : 'Upload a photo'}
            </button>

            {error ? <p className="text-center text-[12px] text-red-400">{error}</p> : null}
        </div>
    );
}
