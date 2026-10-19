import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { CookieDatabase } from '../db/CookieDatabase';
import { getCookieSites, vaultCookieId } from './cookie_data';
import { updateCookie } from './cookie_actions';
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
        vi.stubGlobal('chrome', { cookies: { getAll, remove, set }, runtime: {} });
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

    it('groups dotted and dotless cookies together without changing their domains or vault identities', async () => {
        const domainCookie = { ...browserCookie, domain: '.example.com', hostOnly: false };
        getAll.mockResolvedValue([browserCookie, domainCookie]);

        const sites = await getCookieSites();
        expect(sites).toHaveLength(1);
        expect(sites[0].domain).toBe('example.com');
        expect(sites[0].cookies.map(cookie => cookie.domain)).toEqual(['example.com', '.example.com']);
        expect(new Set(sites[0].cookies.map(cookie => cookie.vaultId)).size).toBe(2);
        expect(domainCookie.domain).toBe('.example.com');

        await moveCookie(sites[0].cookies[1]);
        expect(await db.getCookiesByDomain('.example.com')).toEqual([
            expect.objectContaining({ domain: '.example.com', hostOnly: false, id: vaultCookieId(domainCookie) }),
        ]);
        expect(await db.getCookiesByDomain('example.com')).toEqual([]);

        getAll.mockResolvedValue([browserCookie]);
        const [mixedSite] = await getCookieSites();
        expect(mixedSite.domain).toBe('example.com');
        expect(mixedSite.cookies).toHaveLength(2);
        const vaulted = mixedSite.cookies.find(cookie => cookie.isVaulted)!;
        expect(vaulted.domain).toBe('.example.com');

        await moveCookie(vaulted);
        expect(set).toHaveBeenCalledWith(expect.objectContaining({
            url: 'https://example.com/',
            domain: '.example.com',
            partitionKey: domainCookie.partitionKey,
        }));
        expect(db.getAllCookies()).toHaveLength(0);
    });

    it.each([
        { domain: 'example.com', hostOnly: true },
        { domain: '.example.com', hostOnly: false },
    ])('preserves cookie scope when editing $domain', async ({ domain, hostOnly }) => {
        const original = { ...browserCookie, domain, hostOnly };
        getAll.mockResolvedValue([original]);
        const cookie = (await getCookieSites())[0].cookies[0];
        const edited = { ...original, value: 'updated' };
        set.mockImplementationOnce((_details, callback) => callback(edited));

        await expect(updateCookie(cookie, {
            value: 'updated', secure: true, httpOnly: true, sameSite: 'lax', session: true,
        })).resolves.toEqual(edited);

        const details = set.mock.calls[0][0];
        expect(details).toMatchObject({
            url: 'https://example.com/', name: original.name, value: 'updated',
            path: original.path, storeId: original.storeId, partitionKey: original.partitionKey,
        });
        if (hostOnly) {
            expect(details).not.toHaveProperty('domain');
        } else {
            expect(details.domain).toBe('.example.com');
        }
        expect(cookie.domain).toBe(domain);
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
