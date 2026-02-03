import { useRef, useState } from 'react';
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
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
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
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            return;
        }

        // Max 5MB
        if (file.size > 5 * 1024 * 1024) {
            return;
        }

        setLoading(true);
        try {
            const compressed = await compressImage(file);
            onChange(compressed);
        } catch (err) {
            console.error('Failed to process image:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = (e) => {
        e.stopPropagation();
        onChange(null);
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    return (
        <div className={className}>
            <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">
                {label}
            </label>
            
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
                        className="w-full h-32 object-contain bg-black/20"
                    />
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={loading}
                    className="w-full h-20 border-2 border-dashed border-claude-border rounded-xl flex items-center justify-center gap-2 text-claude-secondary hover:border-claude-accent hover:text-claude-accent transition-colors disabled:opacity-50"
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            <ImagePlus className="w-5 h-5" />
                            <span className="text-sm">Add Image</span>
                        </>
                    )}
                </button>
            )}
        </div>
    );
}
