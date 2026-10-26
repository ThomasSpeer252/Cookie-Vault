import { t } from '../i18n';
import { CookieDatabase } from "../db/CookieDatabase.ts";
import {SiteCookie, toVaultCookie} from "./cookie_data.ts";

export function cookieUrl(cookie: chrome.cookies.Cookie): string {
    const host = cookie.domain.replace(/^\./, '');
    const scheme = cookie.secure ? 'https' : 'http';
    return `${scheme}://${host}${cookie.path || '/'}`;
}

export async function removeBrowserCookie(cookie: chrome.cookies.Cookie): Promise<void> {
    await chrome.cookies.remove({
        url: cookieUrl(cookie),
        name: cookie.name,
        storeId: cookie.storeId,
        ...(cookie.partitionKey ? { partitionKey: cookie.partitionKey } : {}),
    });
}

export async function restoreBrowserCookie(cookie: chrome.cookies.Cookie): Promise<void> {
    const restored = await chrome.cookies.set({
        url: cookieUrl(cookie),
        name: cookie.name,
        value: cookie.value,
        ...(cookie.hostOnly ? {} : { domain: cookie.domain }),
        path: cookie.path,
        storeId: cookie.storeId,
        ...(cookie.partitionKey ? { partitionKey: cookie.partitionKey } : {}),
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        ...(!cookie.session && cookie.expirationDate !== undefined
            ? { expirationDate: cookie.expirationDate } : {}),
    });
    if (!restored) throw new Error(t('errors.restore'));
}

function promisify<T>(fn: (cb: (result: T) => void) => void): Promise<T> {
    return new Promise((resolve, reject) => {
        fn((result) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve(result);
        });
    });
}

export interface CookieEditInput {
    value: string;
    secure: boolean;
    httpOnly: boolean;
    sameSite: `${chrome.cookies.SameSiteStatus}`;
    session: boolean;
    expirationDate?: number;
}

export async function updateCookie(
    cookie: chrome.cookies.Cookie,
    input: CookieEditInput,
): Promise<chrome.cookies.Cookie | null> {
    const details: chrome.cookies.SetDetails = {
        url: cookieUrl(cookie),
        name: cookie.name,
        value: input.value,
        ...(cookie.hostOnly ? {} : { domain: cookie.domain }),
        path: cookie.path,
        secure: input.secure,
        httpOnly: input.httpOnly,
        sameSite: input.sameSite,
        storeId: cookie.storeId,
        ...(cookie.partitionKey ? { partitionKey: cookie.partitionKey } : {}),
    };

    if (!input.session && input.expirationDate !== undefined) {
        details.expirationDate = input.expirationDate;
    }

    return promisify((cb) => chrome.cookies.set(details, cb));
}

export async function updateVaultedCookie(
    cookie: SiteCookie,
    input: CookieEditInput,
): Promise<void> {
    const db = CookieDatabase.getInstance();

    const updated = {
        ...cookie,
        value: input.value,
        secure: input.secure,
        httpOnly: input.httpOnly,
        sameSite: input.sameSite,
        session: input.session,
        expirationDate: input.session ? null : (input.expirationDate ?? null),
    };

    await db.upsertCookie(toVaultCookie(updated))
}

export async function deleteSpecificCookie(cookie: SiteCookie): Promise<void> {
    const db = CookieDatabase.getInstance();

    if (cookie.isVaulted) {
        await db.deleteCookie(cookie.vaultId, cookie.domain);
        return;
    }

    await removeBrowserCookie(cookie);

    try {
        const domainCookies = await db.getCookiesByDomain(cookie.domain);
        const dbRecord = domainCookies.find(
            (item) => item.name === cookie.name && item.path === cookie.path
        )
        if (dbRecord) {
            await db.deleteCookie(dbRecord.id, cookie.domain);
        }
    } catch {}
}

export function findCookieInSite(
    site: { cookies: chrome.cookies.Cookie[] },
    name: string,
    path: string,
    storeId?: string,
): chrome.cookies.Cookie | undefined {
    return site.cookies.find((cookie) => {
        if (cookie.name !== name || cookie.path !== path) return false;
        if (storeId === undefined) return true;
        return cookie.storeId === storeId;
    });
}
