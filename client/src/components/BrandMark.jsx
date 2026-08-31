export default function BrandMark({ className = 'h-7 w-7' }) {
    return (
        <svg aria-hidden="true" className={className} viewBox="0 0 64 64" fill="none">
            <path d="M32 53V25" stroke="var(--botanical-forest)" strokeWidth="3" strokeLinecap="round" />
            <path
                d="M31 35C17 34 11 25 13 14c10-1 18 6 18 21Z"
                fill="color-mix(in srgb, var(--botanical-forest) 42%, transparent)"
                stroke="var(--botanical-forest)"
                strokeWidth="2"
            />
            <path
                d="M33 34c14-1 20-10 18-21-10 0-18 7-18 21Z"
                fill="color-mix(in srgb, var(--botanical-forest) 55%, transparent)"
                stroke="var(--botanical-forest)"
                strokeWidth="2"
            />
            <circle
                cx="32"
                cy="25"
                r="4"
                fill="var(--accent-color)"
                className="riven-brand-mark-core"
            />
        </svg>
    );
}
