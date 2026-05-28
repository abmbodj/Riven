import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import OAuthButtons from '../auth/OAuthButtons';

const inputClass =
    'w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-[15px] text-botanical-parchment placeholder:text-claude-secondary/50 outline-none transition-[border-color,background-color,box-shadow] duration-200 focus:border-claude-accent/60 focus:bg-black/30 focus:ring-1 focus:ring-claude-accent/20';
const labelClass =
    'pl-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-claude-secondary';

export default function AccountStep({ value, onChange, error, onOAuthError, onBeforeOAuth }) {
    const [showPassword, setShowPassword] = useState(false);

    const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });

    return (
        <div className="flex flex-col gap-4">
            <OAuthButtons onError={onOAuthError} onBeforeRedirect={onBeforeOAuth} />

            <div className="space-y-1.5">
                <label htmlFor="onb-name" className={labelClass}>Display name</label>
                <input
                    id="onb-name"
                    type="text"
                    autoComplete="name"
                    value={value.displayName}
                    onChange={set('displayName')}
                    className={inputClass}
                    placeholder="What should we call you?"
                />
            </div>

            <div className="space-y-1.5">
                <label htmlFor="onb-email" className={labelClass}>Email</label>
                <input
                    id="onb-email"
                    type="email"
                    autoComplete="email"
                    value={value.email}
                    onChange={set('email')}
                    className={inputClass}
                    placeholder="you@example.com"
                />
            </div>

            <div className="space-y-1.5">
                <label htmlFor="onb-password" className={labelClass}>Password</label>
                <div className="relative">
                    <input
                        id="onb-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={value.password}
                        onChange={set('password')}
                        className={inputClass}
                        placeholder="At least 8 characters"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-claude-secondary/60 transition-colors hover:text-claude-accent"
                    >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            {error ? <p className="pl-1 text-[12px] text-red-400">{error}</p> : null}
        </div>
    );
}
