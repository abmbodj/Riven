export function Spinner({ className = 'w-8 h-8', label = 'Loading' }) {
  return (
    <div role="status" aria-label={label} className="inline-flex items-center justify-center">
      <div className={`${className} border-2 border-claude-accent border-t-transparent rounded-full animate-spin`} />
    </div>
  );
}

