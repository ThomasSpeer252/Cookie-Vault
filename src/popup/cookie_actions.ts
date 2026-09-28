function cookieUrl(cookie: chrome.cookies.Cookie): string {
    const host = cookie.domain.replace(/^\./, '');
    const scheme = cookie.secure ? 'https' : 'http';
    return `${scheme}://${host}${cookie.path || '/'}`;
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
        domain: cookie.domain,
        path: cookie.path,
        secure: input.secure,
        httpOnly: input.httpOnly,
        sameSite: input.sameSite,
        storeId: cookie.storeId,
    };

    if (!input.session && input.expirationDate !== undefined) {
        details.expirationDate = input.expirationDate;
    }

    return promisify((cb) => chrome.cookies.set(details, cb));
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
