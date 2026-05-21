/**
 * Dev-only rolling FPS overlay. Enable with `?fps=1` on the URL or
 * `localStorage.setItem('rivenDevFps','1')` then reload. Disable with `?fps=0` or remove the key.
 */
export function initDevFpsMeter() {
    if (!import.meta.env.DEV || typeof window === 'undefined') return () => {};

    const params = new URLSearchParams(window.location.search);
    if (params.get('fps') === '1') {
        try {
            localStorage.setItem('rivenDevFps', '1');
        } catch {
            /* ignore */
        }
    } else if (params.get('fps') === '0') {
        try {
            localStorage.removeItem('rivenDevFps');
        } catch {
            /* ignore */
        }
    }

    let enabled = false;
    try {
        enabled = localStorage.getItem('rivenDevFps') === '1';
    } catch {
        enabled = params.get('fps') === '1';
    }

    if (!enabled) return () => {};

    const el = document.createElement('div');
    el.setAttribute('data-riven-fps', '');
    el.style.cssText = [
        'position:fixed',
        'bottom:max(8px,env(safe-area-inset-bottom))',
        'right:8px',
        'z-index:2147483647',
        'font:11px/1.2 ui-monospace,Menlo,monospace',
        'padding:4px 8px',
        'border-radius:6px',
        'background:rgba(0,0,0,0.72)',
        'color:#4ade80',
        'pointer-events:none',
        'tab-size:4',
    ].join(';');
    document.body.appendChild(el);

    let frames = 0;
    let last = performance.now();
    let raf = 0;

    const tick = (now) => {
        frames += 1;
        const dt = now - last;
        if (dt >= 500) {
            const fps = Math.round((frames * 1000) / dt);
            el.textContent = `${fps} fps`;
            window.dispatchEvent(new CustomEvent('riven:fps-sample', {
                detail: { fps, route: window.location.pathname },
            }));
            frames = 0;
            last = now;
        }
        raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
        cancelAnimationFrame(raf);
        el.remove();
    };
}
