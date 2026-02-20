import { useState, useRef } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';

/**
 * Card image upload component with preview and compression
 * @param {Object} props
 * @param {string} props.label - Label text
 * @param {string|null} props.value - Current image data URL
 * @param {function} props.onChange - Callback when image changes
 * @param {string} [props.className] - Additional CSS classes
 */
export default function CardImageUpload({ label, value, onChange, className = '' }) {
    const inputRef = useRef(null);
    const [loading, setLoading] = useState(false);

    const compressImage = (file, maxWidth = 800, quality = 0.7) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        let { width, height } = img;

                        // Scale down if needed
                        if (width > maxWidth) {
                            height = (height * maxWidth) / width;
                            width = maxWidth;
                        }

                        canvas.width = width;
                        canvas.height = height;

                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        // Convert to JPEG for better compression
                        resolve(canvas.toDataURL('image/jpeg', quality));
                    } catch (err) {
                        reject(err);
                    }
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            // Invalid file type
            return;
        }

        // Max 5MB
        if (file.size > 5 * 1024 * 1024) {
            // File too large (max 5MB)
            return;
        }

        setLoading(true);
        try {
            const compressed = await compressImage(file);
            onChange(compressed);
        } catch {
            alert('Images failed to scan');
        } finally {
            setLoading(false);
            // Reset input so same file can be selected again
            if (inputRef.current) {
                inputRef.current.value = '';
            }
        }
    };

    const handleRemove = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange(null);
    };

    return (
        <div className={className}>
            {label && (
                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">
                    {label}
                </label>
            )}

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
            />

            {value ? (
                <div className="relative rounded-xl overflow-hidden bg-claude-bg border border-claude-border">
                    <img
                        src={value}
                        alt="Card preview"
                        loading="lazy"
                        decoding="async"
                        className="w-full h-32 object-contain bg-black/20"
                    />
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full text-white active:bg-red-600 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <label className="w-full h-20 border-2 border-dashed border-claude-border rounded-xl flex items-center justify-center gap-2 text-claude-secondary active:border-claude-accent active:text-claude-accent transition-colors cursor-pointer">
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            <ImagePlus className="w-5 h-5" />
                            <span className="text-sm">Add Image</span>
                        </>
                    )}
                </label>
            )}
        </div>
    );
}
