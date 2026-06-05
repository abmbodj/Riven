/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from './ThemeContext.jsx';
import { useTheme } from './hooks/useTheme.js';
import { getDefaultThemes } from './themeCatalog.js';

const mocks = vi.hoisted(() => ({
    getThemes: vi.fn(),
    activateTheme: vi.fn(),
    isLoggedIn: false,
}));

vi.mock('./api', () => ({
    api: {
        getThemes: mocks.getThemes,
        activateTheme: mocks.activateTheme,
        createTheme: vi.fn(),
        updateTheme: vi.fn(),
        deleteTheme: vi.fn(),
    },
}));

vi.mock('./hooks/useAuth', () => ({
    default: () => ({
        isLoggedIn: mocks.isLoggedIn,
    }),
}));

function ThemeProbe() {
    const { activeTheme, appliedTheme } = useTheme();

    return (
        <div>
            <span data-testid="active-theme">{activeTheme?.name || 'none'}</span>
            <span data-testid="applied-theme">{appliedTheme?.name || 'none'}</span>
        </div>
    );
}

const rivenTheme = () => ({
    id: 1,
    ...getDefaultThemes().find((theme) => theme.name === 'Riven'),
    is_active: 0,
});

describe('ThemeProvider fallback behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isLoggedIn = false;
        document.documentElement.removeAttribute('style');
    });

    afterEach(() => {
        document.documentElement.removeAttribute('style');
    });

    it('applies the local Riven fallback when theme loading fails', async () => {
        mocks.getThemes.mockRejectedValue(new Error('Cannot load themes'));

        render(
            <ThemeProvider>
                <ThemeProbe />
            </ThemeProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('active-theme')).toHaveTextContent('Riven');
        });
        expect(screen.getByTestId('applied-theme')).toHaveTextContent('Riven');
        expect(document.documentElement.style.getPropertyValue('--bg-color')).toBe('#162a31');
        expect(document.documentElement.style.getPropertyValue('--theme-background-style')).toBe('solid');
    });

    it('repairs a loaded no-active theme list to Riven for logged-in users', async () => {
        mocks.isLoggedIn = true;
        const riven = rivenTheme();
        mocks.getThemes.mockResolvedValue([
            {
                id: 9,
                name: 'Custom Drift',
                bg_color: '#252136',
                surface_color: '#302a44',
                text_color: '#f6f1ff',
                secondary_text_color: '#b7accd',
                border_color: '#4c4466',
                accent_color: '#6195ff',
                is_default: 0,
                is_active: 0,
            },
            riven,
        ]);
        mocks.activateTheme.mockResolvedValue({ ...riven, is_active: 1 });

        render(
            <ThemeProvider>
                <ThemeProbe />
            </ThemeProvider>
        );

        await waitFor(() => {
            expect(mocks.activateTheme).toHaveBeenCalledWith(1);
        });
        expect(screen.getByTestId('active-theme')).toHaveTextContent('Riven');
        expect(screen.getByTestId('applied-theme')).toHaveTextContent('Riven');
    });
});
