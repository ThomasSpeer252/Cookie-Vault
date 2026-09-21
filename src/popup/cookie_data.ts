export interface CookieSite {
    domain: string;
    cookies: chrome.cookies.Cookie[];
    allSecure: boolean;
    isVaulted: boolean;
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
        throw new Error('The Chrome cookies API is unavailable.');
    }

    const cookies = await chrome.cookies.getAll({});
    const cookiesByDomain = new Map<string, chrome.cookies.Cookie[]>();

    for (const cookie of cookies) {
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
            // Vault persistence is not implemented, so real cookies start unvaulted.
            isVaulted: false,
        }))
        .sort((left, right) => {
            const baseDomainOrder = getDomainSortKey(left.domain)
                .localeCompare(getDomainSortKey(right.domain));

            return baseDomainOrder || left.domain.localeCompare(right.domain);
        });
}
