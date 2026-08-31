import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createPerformanceEvent,
    getRouteTemplate,
    shouldSamplePerformance,
} from './performanceReporter.js';

describe('performanceReporter', () => {
    beforeEach(() => {
        document.documentElement.dataset.visualBudget = 'constrained';
    });

    it('maps identifiable routes to anonymous templates', () => {
        expect(getRouteTemplate('/deck/842/study?from=/class/99')).toBe('/deck/:id/study');
        expect(getRouteTemplate('/messages/4d2bd744-6f81-47c0-a461-b2219b962721')).toBe('/messages/:id');
        expect(getRouteTemplate('/dashboard')).toBe('/dashboard');
        expect(getRouteTemplate('/unknown/private-title')).toBe('/other');
    });

    it('emits only the approved PerformanceEvent fields', () => {
        const event = createPerformanceEvent({
            name: 'dashboard-data',
            value: 321.449,
            unit: 'ms',
            rating: 'good',
            pathname: '/class/42?title=Biology',
            navigationType: 'reload',
            cacheState: 'stale',
            browserClass: 'chromium-desktop',
            release: 'abc123',
            title: 'Biology notes',
            url: 'https://www.riven.rocks/class/42',
            studyContent: 'private',
        });

        expect(event).toEqual({
            name: 'dashboard-data',
            value: 321.45,
            unit: 'ms',
            rating: 'good',
            routeTemplate: '/class/:id',
            navigationType: 'reload',
            cacheState: 'stale',
            visualBudget: 'constrained',
            browserClass: 'chromium-desktop',
            release: 'abc123',
        });
        expect(JSON.stringify(event)).not.toContain('Biology');
        expect(JSON.stringify(event)).not.toContain('/class/42');
    });

    it('uses deterministic sampling boundaries', () => {
        vi.spyOn(Math, 'random').mockReturnValueOnce(0.049).mockReturnValueOnce(0.05);
        expect(shouldSamplePerformance(0.05)).toBe(true);
        expect(shouldSamplePerformance(0.05)).toBe(false);
    });
});
