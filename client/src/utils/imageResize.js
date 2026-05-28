const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 512;
const JPEG_QUALITY = 0.95;

/**
 * Reads an image file and returns a resized base64 data URL. GIFs are passed
 * through untouched so animation is preserved; everything else is drawn to a
 * canvas capped at 512px on its longest side and re-encoded as JPEG.
 *
 * Resolves with the data URL. Rejects with an Error whose message is safe to
 * surface to the user (invalid type, too large, decode failure).
 */
export function fileToResizedDataUrl(file, { maxBytes = MAX_FILE_BYTES, maxSize = MAX_DIMENSION } = {}) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('No file selected'));
            return;
        }
        if (!file.type.startsWith('image/')) {
            reject(new Error('Please select an image file'));
            return;
        }
        if (file.size > maxBytes) {
            reject(new Error(`Image must be less than ${Math.round(maxBytes / (1024 * 1024))}MB`));
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result;

            if (file.type === 'image/gif') {
                resolve(result);
                return;
            }

            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > height) {
                    if (width > maxSize) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    }
                } else if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
            };
            img.onerror = () => reject(new Error('Failed to process image'));
            img.src = result;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}
