const COMPOUND_SESSION_ID_PATTERN = /^session[-_.]/i;
const ANALYTICS_PREFIX_PATTERN = /^(_ga|_gid|_gat|_fbp|_gcl_|_uet|_hj)/i;
const MARKETING_ID_PREFIX_PATTERN = /^(visitor|visid|tracking|track|anon|anonymous)[-_]/i;

const CSRF_EXACT_NAMES = new Set([
    'csrf',
    'xsrf',
    'csrftoken',
    'xsrf-token',
    'csrf_token',
    'x-csrftoken',
]);

const INFRASTRUCTURE_COOKIE_NAMES = new Set([
    'ipv6',
    '_ss',
    'ak_bmsc',
    'bm_sz',
]);

const INFRASTRUCTURE_COOKIE_PATTERN = /^_edge/i;

const SESSION_NAME_PATTERN = /^(session(id)?|jsessionid|phpsessid|asp\.net_sessionid|connect\.sid)$/i;
const TOKEN_NAME_PATTERN = /^(auth|token|access_token|refresh_token|jwt|login|id_token|bearer)$/i;

export function isInfrastructureCookie(nameLower: string): boolean {
    if (INFRASTRUCTURE_COOKIE_NAMES.has(nameLower)) return true;
    if (INFRASTRUCTURE_COOKIE_PATTERN.test(nameLower)) return true;
    return false;
}

export function isExcludedNonAuthCookie(nameLower: string): boolean {
    if (isInfrastructureCookie(nameLower)) return true;
    if (COMPOUND_SESSION_ID_PATTERN.test(nameLower)) return true;
    if (ANALYTICS_PREFIX_PATTERN.test(nameLower)) return true;
    if (MARKETING_ID_PREFIX_PATTERN.test(nameLower)) return true;
    if (CSRF_EXACT_NAMES.has(nameLower)) return true;
    return false;
}

export function isAuthSessionCookie(cookie: { name: string }): boolean {
    const nameLower = cookie.name.toLowerCase();

    if (isExcludedNonAuthCookie(nameLower)) {
        return false;
    }

    if (SESSION_NAME_PATTERN.test(nameLower)) {
        return true;
    }

    if (TOKEN_NAME_PATTERN.test(nameLower)) {
        return true;
    }

    return false;
}
