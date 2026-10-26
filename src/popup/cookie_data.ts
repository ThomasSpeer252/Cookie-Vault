import { t } from '../i18n';
import { CookieDatabase, type Cookie } from '../db/CookieDatabase';

export type SiteCookie = chrome.cookies.Cookie & { isVaulted: boolean; vaultId: string };

export interface CookieSite {
    domain: string;
    cookies: SiteCookie[];
    allSecure: boolean;
    isVaulted: boolean;
    isPinned: boolean;
}

export function vaultCookieId(cookie: chrome.cookies.Cookie): string {
    return JSON.stringify([
        cookie.name, cookie.domain, cookie.path, cookie.storeId,
        cookie.partitionKey?.topLevelSite ?? null,
        cookie.partitionKey?.hasCrossSiteAncestor ?? null,
    ]);
}

export function toVaultCookie(cookie: chrome.cookies.Cookie): Cookie {
    return {
        ...cookie,
        id: vaultCookieId(cookie),
        partitionKey: cookie.partitionKey ?? null,
        expirationDate: cookie.expirationDate ?? null,
    };
}

export function fromVaultCookie(cookie: Cookie): SiteCookie {
    const { id, partitionKey, expirationDate, ...browserCookie } = cookie;
    return {
        ...browserCookie,
        ...(partitionKey ? { partitionKey } : {}),
        ...(expirationDate !== null ? { expirationDate } : {}),
        isVaulted: true,
        vaultId: id,
    };
}

function getDomainSortKey(domain: string): string {
    const labels = domain.toLowerCase().split('.');
    return labels.length > 2 ? labels.slice(-2).join('.') : labels.join('.');
}

function normalizeDomain(domain: string): string {
    return domain.replace(/^\.+/, '');
}

export async function getCookieSites(): Promise<CookieSite[]> {
    if (typeof chrome === 'undefined' || !chrome.cookies) {
        throw new Error(t('errors.api'));
    }

    const browserCookies = await chrome.cookies.getAll({});
    const vaultedCookies = CookieDatabase.getInstance().getAllCookies().map(fromVaultCookie);
    const cookiesByDomain = new Map<string, SiteCookie[]>();

    for (const cookie of [
        ...browserCookies.map(cookie => ({ ...cookie, isVaulted: false, vaultId: vaultCookieId(cookie) })),
        ...vaultedCookies,
    ]) {
        const domain = normalizeDomain(cookie.domain);
        const domainCookies = cookiesByDomain.get(domain) ?? [];
        domainCookies.push(cookie);
        cookiesByDomain.set(domain, domainCookies);
    }

    return [...cookiesByDomain.entries()]
        .map(([domain, domainCookies]) => ({
            domain,
            cookies: domainCookies.sort((left, right) =>
                left.name.localeCompare(right.name) || left.path.localeCompare(right.path)),
            allSecure: domainCookies.every(cookie => cookie.secure),
            isVaulted: domainCookies.some(cookie => cookie.isVaulted),
            isPinned: false,
        }))
        .sort((left, right) => {
            const baseDomainOrder = getDomainSortKey(left.domain)
                .localeCompare(getDomainSortKey(right.domain));

            return baseDomainOrder || left.domain.localeCompare(right.domain);
        });
}
