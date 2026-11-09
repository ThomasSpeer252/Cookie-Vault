import { isAuthSessionCookie } from '../cookies/auth_session_cookie';

export type XssAlertKind = 'xss';

export interface SiteCookieRef {
    name: string;
    value?: string;
}

export interface CookieExfilHit {
    kind: XssAlertKind;
    cookieNames: string[];
    destHost: string;
}

export function decodeUrlEncoded(value: string): string {
    let current = value.replace(/\+/g, ' ');
    for (let pass = 0; pass < 2; pass += 1) {
        const next = current.replace(/%([0-9A-Fa-f]{2})/g, (_, hex: string) => {
            return String.fromCharCode(Number.parseInt(hex, 16));
        });
        if (next === current) break;
        current = next;
    }
    return current;
}

function textCarriesCookie(text: string | undefined, cookie: SiteCookieRef): boolean {
    if (!text || !cookie.value) return false;
    const pair = `${cookie.name}=${cookie.value}`;
    return decodeUrlEncoded(text).includes(pair) || text.includes(encodeURIComponent(pair));
}

export function detectCookieExfil(input: {
    isThirdParty: boolean;
    destHost: string;
    sentCookieNames: string[];
    siteCookies: SiteCookieRef[];
    requestUrl?: string;
    requestBody?: string;
}): CookieExfilHit | null {
    if (!input.isThirdParty || !input.destHost || input.siteCookies.length === 0) return null;

    const headerNames = new Set(input.sentCookieNames.map(name => name.toLowerCase()));
    const matched: SiteCookieRef[] = [];
    const seen = new Set<string>();

    for (const cookie of input.siteCookies) {
        const key = cookie.name.toLowerCase();
        if (seen.has(key)) continue;
        const carried = textCarriesCookie(input.requestUrl, cookie) || textCarriesCookie(input.requestBody, cookie);
        if (!headerNames.has(key) && !carried) continue;
        seen.add(key);
        matched.push(cookie);
    }

    const cookieNames = matched
        .filter(cookie => isAuthSessionCookie(cookie))
        .map(cookie => cookie.name);
    if (cookieNames.length === 0) return null;

    return {
        kind: 'xss',
        cookieNames,
        destHost: input.destHost,
    };
}
