import React from 'react';
import { User } from 'lucide-react';

export default function Avatar({ src, size = 'md', className = '' }) {
    const sizeClasses = {
        xs: 'w-8 h-8',
        sm: 'w-10 h-10',
        md: 'w-12 h-12',
        lg: 'w-16 h-16',
        xl: 'w-20 h-20',
        '2xl': 'w-24 h-24',
        '3xl': 'w-32 h-32'
    };

    const iconSizes = {
        xs: 'w-4 h-4',
        sm: 'w-5 h-5',
        md: 'w-6 h-6',
        lg: 'w-8 h-8',
        xl: 'w-10 h-10',
        '2xl': 'w-12 h-12',
        '3xl': 'w-16 h-16'
    };

    // Check if it's a gradient
    const isGradient = src?.startsWith('gradient:');
    const gradient = isGradient ? src.replace('gradient:', '') : null;

    if (!src) {
        return (
            <div className={`${sizeClasses[size]} rounded-full bg-claude-accent/20 flex items-center justify-center shrink-0 ${className}`}>
                <User className={`${iconSizes[size]} text-claude-accent`} />
            </div>
        );
    }

    if (isGradient) {
        return (
            <div 
                className={`${sizeClasses[size]} rounded-full shrink-0 ${className}`}
                style={{ background: gradient }}
            />
        );
    }

    return (
        <img 
            src={src} 
            alt="" 
            className={`${sizeClasses[size]} rounded-full object-cover bg-claude-bg shrink-0 ${className}`}
            onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = `<div class="${sizeClasses[size]} rounded-full bg-claude-accent/20 flex items-center justify-center"><svg class="${iconSizes[size]} text-claude-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`;
            }}
        />
    );
}
