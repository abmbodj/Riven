import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGSAP } from './useGSAP.js';

vi.mock('gsap', () => ({
    default: {
        utils: { selector: () => () => [] },
        context: (callback) => {
            callback();
            return { revert: vi.fn() };
        },
    },
}));

function Harness({ cleanup }) {
    const { container } = useGSAP(() => cleanup, [cleanup]);
    return <div ref={container} />;
}

describe('useGSAP cleanup', () => {
    it('runs callback cleanup when the animated subtree unmounts', () => {
        const cleanup = vi.fn();
        const view = render(<Harness cleanup={cleanup} />);
        view.unmount();
        expect(cleanup).toHaveBeenCalledTimes(1);
    });
});
