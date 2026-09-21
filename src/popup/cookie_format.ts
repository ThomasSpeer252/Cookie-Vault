export interface CookieFlag {
    label: string;
    kind: 'secure' | 'http-only' | 'same-site' | 'partitioned';
}

export function getCookieFlags(cookie: chrome.cookies.Cookie): CookieFlag[] {
    const flags: CookieFlag[] = [];

    if (cookie.secure) flags.push({ label: 'Secure', kind: 'secure' });
    if (cookie.httpOnly) flags.push({ label: 'HttpOnly', kind: 'http-only' });
    if (cookie.partitionKey) flags.push({ label: 'Partitioned', kind: 'partitioned' });

    if (cookie.sameSite === 'strict') {
        flags.push({ label: 'SS:S', kind: 'same-site' });
    } else if (cookie.sameSite === 'lax') {
        flags.push({ label: 'SS:L', kind: 'same-site' });
    } else if (cookie.sameSite === 'no_restriction') {
        flags.push({ label: 'SS: N', kind: 'same-site' });
    }

    return flags;
}

export interface CookieExpiration {
    label: string;
    title: string;
}

export function formatCookieExpiration(cookie: chrome.cookies.Cookie): CookieExpiration {
    if (cookie.session || cookie.expirationDate === undefined) {
        return {
            label: 'Session',
            title: 'Expires when the browser session ends',
        };
    }

    const expiration = new Date(cookie.expirationDate * 1000);

    return {
        label: expiration.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }),
        title: expiration.toLocaleString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short',
        }),
    };
}

export function escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
    })[character] as string);
}
