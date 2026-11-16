const SNAPSHOT_TTL_MS = 30_000;

interface Snapshot {
    pageUrl: string;
    fetchedAt: number;
    cookies: chrome.cookies.Cookie[];
}

const snapshots = new Map<number, Snapshot>();

export function clearSiteCookieSnapshot(tabId: number): void {
    snapshots.delete(tabId);
}

export async function getSiteCookiesForPage(tabId: number, pageUrl: string): Promise<chrome.cookies.Cookie[]> {
    if (!pageUrl.startsWith('http://') && !pageUrl.startsWith('https://')) return [];
    if (typeof chrome === 'undefined' || !chrome.cookies?.getAll) return [];

    const cached = snapshots.get(tabId);
    const fresh = cached
        && cached.pageUrl === pageUrl
        && Date.now() - cached.fetchedAt < SNAPSHOT_TTL_MS;
    if (fresh && cached) return cached.cookies;

    try {
        let cookies = await chrome.cookies.getAll({ url: pageUrl });
        if (cookies.length === 0) {
            const host = new URL(pageUrl).hostname;
            const all = await chrome.cookies.getAll({});
            cookies = all.filter(cookie => {
                const domain = cookie.domain.replace(/^\./, '');
                return host === domain || host.endsWith(`.${domain}`);
            });
        }
        if (cookies.length > 0) {
            snapshots.set(tabId, { pageUrl, fetchedAt: Date.now(), cookies });
        }
        return cookies;
    } catch {
        return [];
    }
}
