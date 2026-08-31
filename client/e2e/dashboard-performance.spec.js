import { expect, test } from '@playwright/test';

const now = Date.now();
const tomorrow = new Date(now + 24 * 60 * 60 * 1000).toISOString();
const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString();

const dashboard = {
    version: 1,
    generatedAt: new Date(now).toISOString(),
    assignments: [
        { id: 11, class_id: 21, title: 'Read chapter four', status: 'Pending', due_date: tomorrow, type: 'Reading' },
        { id: 12, class_id: 22, title: 'Practice quiz', status: 'Pending', due_date: yesterday, type: 'Quiz' },
    ],
    classes: [
        { id: 21, name: 'Biology', color: '#7a9e72', created_at: yesterday },
        { id: 22, name: 'Calculus', color: '#deb96a', created_at: yesterday },
    ],
    counts: { decks: 8, notes: 5, guides: 3, exams: 2 },
    archivedClassCount: 1,
    recentDecks: [
        { id: 31, title: 'Cell Biology', class_id: 21, created_at: yesterday, cardCount: 24, tags: [{ id: 1, name: 'Exam', color: '#deb96a' }] },
    ],
    recentStudyItems: [
        { id: 31, title: 'Cell Biology', class_id: 21, type: 'flashcard', activityAt: yesterday, cardCount: 24 },
        { id: 41, title: 'Limits Review', class_id: 22, type: 'guide', activityAt: yesterday },
    ],
    weeklySummary: {
        cards_studied: 42,
        accuracy: 0.86,
        total_minutes: 55,
        daily_breakdown: Array.from({ length: 7 }, (_, index) => ({
            date: new Date(now - (6 - index) * 86400000).toISOString().slice(0, 10),
            day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index],
            cards: index > 3 ? (index - 3) * 7 : 0,
            minutes: index > 3 ? (index - 3) * 5 : 0,
            studied: index > 3,
            is_today: index === 6,
        })),
    },
    streakSummary: { currentStreak: 4, longestStreak: 9, lastStudyDate: yesterday.slice(0, 10) },
};

const fixtures = {
    user: {
        id: 7,
        username: 'atlas',
        displayName: 'Atlas',
        email: 'atlas@example.test',
        onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
        subscription_tier: 'free',
        streakData: dashboard.streakSummary,
    },
    dashboard,
    dashboardDelayMs: 120,
    studyCoach: {
        recommendation: {
            guideId: 41,
            guideTitle: 'Limits Review',
            label: 'Review Weak Concepts',
            detail: '2 concepts to review · ~8 min',
            to: '/guide/41',
        },
        weakTopics: [],
        stats: { xpTotal: 820, level: 4, sessionsCompleted: 12, topicsMastered: 7 },
        achievements: [],
    },
    hearts: { hearts: 4, max: 5, isUnlimited: false, nextRefill: null },
    aiLimits: { remaining: 7, max: 10, isPremium: false },
    themes: [{
        id: 1,
        name: 'Sage Temple',
        is_default: 1,
        is_active: 1,
        bg_color: '#162a31',
        surface_color: '#233e46',
        text_color: '#f5f1e8',
        secondary_text_color: '#b7c5c5',
        border_color: '#36525a',
        accent_color: '#deb96a',
        effect_preset: 'auto',
    }],
};

async function installFixtures(page, overrides = {}) {
    await page.addInitScript((value) => {
        window.__RIVEN_E2E_FIXTURES__ = value;
        window.__RIVEN_LONG_TASKS__ = [];
        if ('PerformanceObserver' in window) {
            try {
                new PerformanceObserver((list) => {
                    window.__RIVEN_LONG_TASKS__.push(...list.getEntries().map((entry) => entry.duration));
                }).observe({ type: 'longtask', buffered: true });
            } catch {
                // Long Task API is Chromium-only and may be unavailable in a test shell.
            }
        }
    }, { ...fixtures, ...overrides });
}

async function emulateFast4GWithCpuThrottle(page) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        // Chrome DevTools' Fast 4G preset.
        latency: 20,
        downloadThroughput: (4 * 1024 * 1024) / 8,
        uploadThroughput: (3 * 1024 * 1024) / 8,
        connectionType: 'cellular4g',
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    return async () => {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        await cdp.send('Network.disable');
        await cdp.detach();
    };
}

test('cold authenticated dashboard becomes meaningful within the release gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop-chromium-fps', 'FPS project only measures native frame cadence.');
    await installFixtures(page);
    const restoreEmulation = await emulateFast4GWithCpuThrottle(page);
    try {
        const startedAt = Date.now();
        await page.goto('/dashboard');
        await expect(page.locator('[data-dashboard-ready="true"]')).toBeVisible();
        expect(Date.now() - startedAt).toBeLessThan(2500);
        await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
        await expect(page.getByText('Cell Biology', { exact: true }).first()).toBeVisible();
        await expect(page.getByText('86%', { exact: true })).toBeVisible();
        await expect(page.getByRole('listitem').filter({ hasText: '21 cards studied' })).toBeAttached();
    } finally {
        await restoreEmulation();
    }
});

test('cached dashboard paints within one second while revalidation continues', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop-chromium-fps', 'FPS project only measures native frame cadence.');
    await installFixtures(page, { dashboardDelayMs: 2_000 });
    await page.addInitScript(({ snapshot, timestamp }) => {
        const entry = {
            value: snapshot,
            expiresAt: timestamp + 24 * 60 * 60 * 1000,
            fetchedAt: timestamp,
        };
        sessionStorage.setItem('riven_groups_cache_v1', JSON.stringify({
            _userId: 7,
            entries: { 'dashboard:v1': entry },
        }));
    }, { snapshot: dashboard, timestamp: now });

    const startedAt = Date.now();
    await page.goto('/dashboard');
    await expect(page.locator('[data-dashboard-ready="true"]')).toBeVisible();
    expect(Date.now() - startedAt).toBeLessThan(1000);
});

test('navigation and theme effects avoid interaction tasks over 200ms', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop-chromium-fps', 'FPS project only measures native frame cadence.');
    await installFixtures(page);
    await page.goto('/dashboard');
    await expect(page.locator('[data-dashboard-ready="true"]')).toBeVisible();
    await expect(page.locator('[data-global-theme-overlay="forest"]')).toBeVisible();
    await page.mouse.wheel(0, 1_200);
    await page.mouse.wheel(0, -1_200);
    await page.getByRole('link', { name: 'Classes', exact: true }).first().click();
    await expect(page).toHaveURL(/\/classes$/);

    const interactionTasks = await page.evaluate(() => window.__RIVEN_LONG_TASKS__ || []);
    expect(interactionTasks.filter((duration) => duration > 200)).toEqual([]);
});

test('native scrolling sustains at least 55 FPS after route entrance', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium-fps', 'Measured without trace/video capture overhead.');
    await installFixtures(page);
    await page.goto('/dashboard');
    await expect(page.locator('[data-dashboard-ready="true"]')).toBeVisible();
    await expect(page.locator('[data-global-theme-overlay="forest"]')).toBeVisible();
    await page.waitForTimeout(700);

    const sampledFps = await page.evaluate(() => new Promise((resolve) => {
        let frames = 0;
        const startedAt = performance.now();
        const sample = (timestamp) => {
            frames += 1;
            window.scrollTo(0, Math.abs(Math.sin(timestamp / 240)) * 1_200);
            if (timestamp - startedAt >= 1_500) {
                resolve((frames * 1_000) / (timestamp - startedAt));
                return;
            }
            requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
    }));
    expect(sampledFps).toBeGreaterThanOrEqual(55);
});

test('reduced-motion mode renders the dashboard without entrance transforms', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop-chromium-fps', 'FPS project only measures native frame cadence.');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installFixtures(page);
    await page.goto('/dashboard');
    await expect(page.locator('[data-dashboard-ready="true"]')).toBeVisible();
    const transform = await page.locator('.gsap-hero-content').evaluate((element) => (
        getComputedStyle(element).transform
    ));
    expect(transform).toBe('none');
});
