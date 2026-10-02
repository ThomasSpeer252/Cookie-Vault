import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { CookieDatabase } from '../db/CookieDatabase';
import { getCookieSites } from './cookie_data';
import { moveCookie } from './site_settings';

const browserCookie: chrome.cookies.Cookie = {
    name: 'session',
    value: 'secret',
    domain: 'example.com',
    path: '/',
    storeId: '0',
    hostOnly: true,
    session: true,
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    partitionKey: { topLevelSite: 'https://example.com', hasCrossSiteAncestor: false },
};

const getAll = vi.fn();
const remove = vi.fn();
const set = vi.fn();
const db = CookieDatabase.getInstance();

describe('popup cookie vault flow', () => {
    beforeEach(async () => {
        vi.stubGlobal('chrome', { cookies: { getAll, remove, set } });
        getAll.mockResolvedValue([browserCookie]);
        remove.mockResolvedValue({});
        set.mockResolvedValue(browserCookie);
        await db.init(`VaultFlow_${crypto.randomUUID()}`, 1);
    });

    afterEach(async () => {
        await db.close();
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it('moves a cookie to the vault, lists it, then restores it to Chrome', async () => {
        const original = (await getCookieSites())[0].cookies[0];
        expect(original.isVaulted).toBe(false);

        await moveCookie(original);
        expect(db.getAllCookies()).toHaveLength(1);
        expect(remove).toHaveBeenCalledWith({
            url: 'https://example.com/',
            name: 'session',
            storeId: '0',
            partitionKey: browserCookie.partitionKey,
        });

        getAll.mockResolvedValue([]);
        const vaultedSite = (await getCookieSites())[0];
        expect(vaultedSite.isVaulted).toBe(true);
        expect(vaultedSite.cookies[0]).toMatchObject({ value: 'secret', isVaulted: true });

        await moveCookie(vaultedSite.cookies[0]);
        expect(db.getAllCookies()).toHaveLength(0);
        expect(set).toHaveBeenCalledWith(expect.objectContaining({
            url: 'https://example.com/',
            value: 'secret',
            storeId: '0',
            partitionKey: browserCookie.partitionKey,
        }));
        expect(set.mock.calls[0][0]).not.toHaveProperty('domain');
        expect(set.mock.calls[0][0]).not.toHaveProperty('expirationDate');
    });

    it('keeps the cookie out of the vault if browser removal fails', async () => {
        remove.mockRejectedValueOnce(new Error('Removal failed'));
        const cookie = (await getCookieSites())[0].cookies[0];

        await expect(moveCookie(cookie)).rejects.toThrow('Removal failed');
        expect(db.getAllCookies()).toHaveLength(0);
    });

    it('keeps a vaulted cookie if Chrome cannot restore it', async () => {
        await moveCookie((await getCookieSites())[0].cookies[0]);
        getAll.mockResolvedValue([]);
        set.mockResolvedValueOnce(null);

        await expect(moveCookie((await getCookieSites())[0].cookies[0]))
            .rejects.toThrow('The browser did not restore the cookie.');
        expect(db.getAllCookies()).toHaveLength(1);
    });
});
