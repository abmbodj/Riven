/**
 * MobileChatShell — provides the push/pop slide transition between the
 * conversation list and a chat thread on mobile screens (< lg).
 *
 * Both panes stay mounted so the thread's virtualizer and data hooks
 * remain active, giving instant navigation in either direction.
 *
 * Desktop: renders nothing; the parent handles the two-column grid.
 */
export default function MobileChatShell({ hasThread, listPane, threadPane }) {
    const duration = '280ms';
    const easing = 'cubic-bezier(0.25, 0, 0.1, 1)';

    return (
        <>
            {/* Mobile — two stacked panes with transform-based slide */}
            <div
                className="lg:hidden relative overflow-hidden"
                style={{ height: 'var(--app-height, 100dvh)' }}
                aria-live="polite"
            >
                {/* List pane */}
                <div
                    className="absolute inset-0 will-change-transform overflow-y-auto pb-24 px-4 pt-4 sm:max-w-md sm:mx-auto"
                    style={{
                        transform: hasThread ? 'translateX(-30%)' : 'translateX(0)',
                        transition: `transform ${duration} ${easing}`,
                        opacity: hasThread ? 0 : 1,
                        transitionProperty: 'transform, opacity',
                        transitionDuration: duration,
                        transitionTimingFunction: easing,
                        pointerEvents: hasThread ? 'none' : 'auto',
                    }}
                    aria-hidden={hasThread}
                >
                    {listPane}
                </div>

                {/* Thread pane */}
                <div
                    className="absolute inset-0 will-change-transform flex flex-col"
                    style={{
                        transform: hasThread ? 'translateX(0)' : 'translateX(100%)',
                        transition: `transform ${duration} ${easing}`,
                        pointerEvents: hasThread ? 'auto' : 'none',
                    }}
                    aria-hidden={!hasThread}
                >
                    {threadPane}
                </div>
            </div>

            {/* Desktop — render nothing; Messages.jsx handles layout */}
        </>
    );
}
