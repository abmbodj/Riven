import '@testing-library/jest-dom';
import { configure } from '@testing-library/dom';
import { vi } from 'vitest';

// Full-suite CI runs enough jsdom workers that lazy routes and exit animations
// can occasionally exceed Testing Library's 1s default without being broken.
configure({ asyncUtilTimeout: 5000 });

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Keep jsdom's default client deterministic across developer machines and CI.
// Production code deliberately treats low-core/low-memory devices as visually
// constrained, while component tests opt into those signals explicitly.
Object.defineProperty(navigator, 'hardwareConcurrency', {
  configurable: true,
  value: 8,
});

Object.defineProperty(navigator, 'deviceMemory', {
  configurable: true,
  value: 8,
});

Object.defineProperty(navigator, 'connection', {
  configurable: true,
  value: {
    saveData: false,
    effectiveType: '4g',
  },
});

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: vi.fn(),
});

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});
