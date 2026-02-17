import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('Client Smoke Test', () => {
    it('should pass a basic truthy check', () => {
        expect(true).toBe(true);
    });

    it('should render a component', () => {
        const TestComponent = () => <div>Hello World</div>;
        render(<TestComponent />);
        expect(screen.getByText('Hello World')).toBeInTheDocument();
    });
});
