/**
 * @vitest-environment happy-dom
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import popupHtml from '../src/popup/index.html?raw';

vi.stubGlobal('indexedDB', {
    open: vi.fn().mockReturnValue({
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        result: { createObjectStore: vi.fn() },
    }),
});

vi.mock('../src/db/CookieDatabase', () => ({
    CookieDatabase: {
        getInstance: () => ({
            init: vi.fn().mockResolvedValue(undefined),
            getAllSiteProfiles: vi.fn().mockResolvedValue([
                { domain: 'site-b-safe.com', isPinned: true }
            ]),
            getSiteProfile: vi.fn().mockResolvedValue(null),
            upsertSiteProfile: vi.fn().mockResolvedValue(undefined),
        }),
    },
}));

vi.mock('../src/popup/cookie_data', () => ({
    getCookieSites: vi.fn().mockResolvedValue([
        {
            domain: 'site-a-flagged.com',
            cookies: [{ name: 'session', isVaulted: false }],
            securityScore: 50,
        },
        {
            domain: 'site-b-safe.com',
            cookies: [{ name: 'session', isVaulted: true }],
            securityScore: 95,
            isPinned: true,
        },
    ]),
}));

const mockPermissionsContains = vi.fn().mockResolvedValue(true);

vi.stubGlobal('chrome', {
    storage: {
        sync: {
            get: vi.fn().mockResolvedValue({ darkMode: false }),
            set: vi.fn().mockResolvedValue(undefined),
        },
    },
    permissions: {
        contains: mockPermissionsContains,
        request: vi.fn().mockResolvedValue(true),
    },
    cookies: {
        getAll: vi.fn().mockResolvedValue([]),
    },
});

describe('Cookie Vault Tests', () => {
    beforeEach(async () => {
        vi.resetModules();
        document.body.innerHTML = popupHtml
            .replace(/<link[^>]*>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    });

    test('1. Load Headers (Title / Version)', async () => {
        const { initPopup } = await import('../src/popup/main');
        await initPopup();

        const titleElement = document.querySelector('.vault-header .title');
        const versionElement = document.querySelector('.version-number');

        expect(titleElement?.textContent).toContain('Cookie Vault');
        expect(versionElement?.textContent?.trim()).toBe('v0.1.0');
    });

    test('2. Site List loads', async () => {
        const { initPopup } = await import('../src/popup/main');
        await initPopup();

        const siteListContainer = document.getElementById('site-list') as HTMLElement;
        expect(siteListContainer).not.toBeNull();

        await vi.waitUntil(() => siteListContainer.querySelectorAll('.site-card').length === 2, { timeout: 3000 });
        expect(siteListContainer.querySelectorAll('.site-card').length).toBe(2);
    });

    test('3. Search bar retains correct site', async () => {
        const { initPopup } = await import('../src/popup/main');
        await initPopup();

        const searchInput = document.getElementById('site-search') as HTMLInputElement;
        expect(searchInput).not.toBeNull();
        searchInput.value = 'site-a';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(searchInput.value).toBe('site-a');
    });

    test('4. Permission prompt appears when required', async () => {
        mockPermissionsContains.mockResolvedValueOnce(false);

        const { initPopup } = await import('../src/popup/main');
        await initPopup();

        const prompt = document.querySelector('.permission-prompt');
        expect(prompt).not.toBeNull();
        expect(document.getElementById('grant-cookies-btn')).not.toBeNull();
    });

    test('5. Call Settings Popup', async () => {
        const { initPopup } = await import('../src/popup/main');
        await initPopup();

        const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
        expect(settingsBtn).toBeTruthy();

        const clickSpy = vi.fn();
        settingsBtn.addEventListener('click', clickSpy);
        settingsBtn.click();

        expect(clickSpy).toHaveBeenCalled();
    });
});