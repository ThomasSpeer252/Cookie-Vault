import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
    updateVaultedCookie,
    updateCookie,
    deleteSpecificCookie,
    cookieUrl,
    findCookieInSite,
    CookieEditInput
} from '../src/popup/cookie_actions';
import { SiteCookie } from '../src/popup/cookie_data';

const mockUpsertCookie = vi.fn().mockResolvedValue(undefined);
const mockDeleteCookie = vi.fn().mockResolvedValue(undefined);
const mockGetCookiesByDomain = vi.fn().mockResolvedValue([]);
const mockCookiesRemove = vi.fn().mockImplementation((_details, cb) => cb({}));
const mockCookiesSet = vi.fn().mockImplementation((_details, cb) => cb({ name: 'test' }));

vi.stubGlobal('chrome', {
    cookies: {
        remove: mockCookiesRemove,
        set: mockCookiesSet,
    },
    runtime: {
        lastError: undefined,
    },
});

vi.mock('../src/db/CookieDatabase', () => ({
    CookieDatabase: {
        getInstance: () => ({
            upsertCookie: mockUpsertCookie,
            deleteCookie: mockDeleteCookie,
            getCookiesByDomain: mockGetCookiesByDomain,
        }),
    },
}));

describe('Cookie Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('Update vaulted cookie', async () => {
        const vaultedCookie: SiteCookie = {
            name: 'vaulted_sess',
            value: 'old_value',
            domain: 'example.com',
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: 'lax',
            session: false,
            expirationDate: 1700000000,
            isVaulted: true,
            vaultId: 'json-id-key',
            storeId: '0',
            hostOnly: false,
        };

        const input: CookieEditInput = {
            value: 'new_vault_value',
            secure: true,
            httpOnly: true,
            sameSite: 'strict',
            session: true,
        };

        await updateVaultedCookie(vaultedCookie, input);

        expect(mockUpsertCookie).toHaveBeenCalledTimes(1);
        const savedArg = mockUpsertCookie.mock.calls[0][0];
        expect(savedArg.value).toBe('new_vault_value');
        expect(savedArg.sameSite).toBe('strict');
        expect(savedArg.session).toBe(true);
        expect(savedArg.expirationDate).toBeNull();
    });

    test('Cookie URL based on secure flag and domain', () => {
        const secureCookie = { domain: '.example.com', secure: true, path: '/app' } as chrome.cookies.Cookie;
        expect(cookieUrl(secureCookie)).toBe('https://example.com/app');

        const insecureCookie = { domain: 'example.com', secure: false, path: '/' } as chrome.cookies.Cookie;
        expect(cookieUrl(insecureCookie)).toBe('http://example.com/');
    });

    test('Updates Browser Cookie', async () => {
        const cookie = {
            name: 'session',
            domain: 'example.com',
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: 'lax',
            storeId: '0',
            hostOnly: false,
        } as chrome.cookies.Cookie;

        const input: CookieEditInput = {
            value: 'updated_value',
            secure: true,
            httpOnly: true,
            sameSite: 'lax',
            session: true,
        };

        const result = await updateCookie(cookie, input);
        expect(mockCookiesSet).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ name: 'test' });
    });

    test('Deletes a vaulted cookie directly from database', async () => {
        const vaultedCookie: SiteCookie = {
            name: 'vaulted_cookie',
            value: 'val',
            domain: 'example.com',
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: 'lax',
            session: true,
            isVaulted: true,
            vaultId: 'v-id-123',
            storeId: '0',
            hostOnly: false,
        };

        await deleteSpecificCookie(vaultedCookie);

        expect(mockCookiesRemove).not.toHaveBeenCalled();
        expect(mockDeleteCookie).toHaveBeenCalledWith('v-id-123', 'example.com');
    });

    test('Finds specific cookie in site object', () => {
        const site = {
            cookies: [
                { name: 'cookieA', path: '/', storeId: '0' },
                { name: 'cookieB', path: '/sub', storeId: '0' },
            ] as chrome.cookies.Cookie[],
        };

        const found = findCookieInSite(site, 'cookieB', '/sub');
        expect(found).toBeDefined();
        expect(found?.name).toBe('cookieB');

        const notFound = findCookieInSite(site, 'cookieA', '/sub');
        expect(notFound).toBeUndefined();
    });
});