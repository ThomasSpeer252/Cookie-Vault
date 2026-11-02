import { t } from '../i18n';
import type { CookieSite } from './cookie_data';

const BASE_1A_SECURE_MISSING = 25;
const BASE_1B_SAMESITE_NONE_INSECURE = 32;
const BASE_2A_AUTH_NO_HTTPONLY = 30;
const BASE_3A_SUPER_LONG_LIVED = 6;

const NON_AUTH_HTTPONLY_MULTIPLIER = 0.7;

const LONG_LIVED_DAYS = 365;

const REPEAT_MULTIPLIERS = [1, 0.5, 0] as const;

const CAP_TRACK_1 = 38;
const CAP_TRACK_2 = 38;
const CAP_TRACK_3 = 10;
const CAP_GLOBAL_DEDUCTION = 68;

const SCORE_MIN = 32;

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

export type CookieSecurityFindingId =
    | 'missing_secure_httponly_cookie'
    | 'samesite_none_insecure'
    | 'auth_missing_httponly'
    | 'auth_super_long_lived';

export type CookieSecuritySeverity = 'critical' | 'major' | 'minor';

export interface CookieSecurityFinding {
    id: CookieSecurityFindingId;
    track: 1 | 2 | 3;
    cookieName: string;
    cookieDomain: string;
    cookiePath: string;
    deduction: number;
    message: string;
    severity: CookieSecuritySeverity;
}

export interface CookieSecurityScoreResult {
    score: number | null;
    findings: CookieSecurityFinding[];
}

interface ScoredFindingDraft {
    id: CookieSecurityFindingId;
    track: 1 | 2 | 3;
    cookie: chrome.cookies.Cookie;
    baseDeduction: number;
    message: string;
    severity: CookieSecuritySeverity;
}

function isInfrastructureCookie(nameLower: string): boolean {
    if (INFRASTRUCTURE_COOKIE_NAMES.has(nameLower)) return true;
    if (INFRASTRUCTURE_COOKIE_PATTERN.test(nameLower)) return true;
    return false;
}

function isExcludedNonAuthCookie(nameLower: string): boolean {
    if (isInfrastructureCookie(nameLower)) return true;
    if (COMPOUND_SESSION_ID_PATTERN.test(nameLower)) return true;
    if (ANALYTICS_PREFIX_PATTERN.test(nameLower)) return true;
    if (MARKETING_ID_PREFIX_PATTERN.test(nameLower)) return true;
    if (CSRF_EXACT_NAMES.has(nameLower)) return true;
    return false;
}

function isAuthSessionCookie(cookie: chrome.cookies.Cookie): boolean {
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

function cookieLifetimeDays(cookie: chrome.cookies.Cookie): number | null {
    if (cookie.session || cookie.expirationDate === undefined) {
        return null;
    }

    const remainingMs = cookie.expirationDate * 1000 - Date.now();
    return remainingMs / (1000 * 60 * 60 * 24);
}

function repeatMultiplier(instanceIndex: number): number {
    return REPEAT_MULTIPLIERS[Math.min(instanceIndex, REPEAT_MULTIPLIERS.length - 1)];
}

function evaluateCookie(cookie: chrome.cookies.Cookie): ScoredFindingDraft[] {
    const nameLower = cookie.name.toLowerCase();
    if (isInfrastructureCookie(nameLower)) {
        return [];
    }

    const findings: ScoredFindingDraft[] = [];
    const authScoped = isAuthSessionCookie(cookie);

    if (authScoped && !cookie.httpOnly) {
        findings.push({
            id: 'auth_missing_httponly',
            track: 2,
            cookie,
            baseDeduction: BASE_2A_AUTH_NO_HTTPONLY,
            message: t('security.authHttpOnly'),
            severity: 'critical',
        });
    } else if (cookie.httpOnly) {
        const authHttpOnly = authScoped;
        const multiplier = authHttpOnly ? 1 : NON_AUTH_HTTPONLY_MULTIPLIER;

        if (cookie.sameSite === 'no_restriction' && !cookie.secure) {
            findings.push({
                id: 'samesite_none_insecure',
                track: 1,
                cookie,
                baseDeduction: Math.round(BASE_1B_SAMESITE_NONE_INSECURE * multiplier),
                message: t('security.sameSite'),
                severity: 'critical',
            });
        } else if (!cookie.secure) {
            findings.push({
                id: 'missing_secure_httponly_cookie',
                track: 1,
                cookie,
                baseDeduction: Math.round(BASE_1A_SECURE_MISSING * multiplier),
                message: t('security.secure'),
                severity: 'major',
            });
        }
    }

    if (authScoped) {
        const lifetimeDays = cookieLifetimeDays(cookie);
        if (lifetimeDays !== null && lifetimeDays > LONG_LIVED_DAYS) {
            findings.push({
                id: 'auth_super_long_lived',
                track: 3,
                cookie,
                baseDeduction: BASE_3A_SUPER_LONG_LIVED,
                message: t('security.lifetime'),
                severity: 'minor',
            });
        }
    }

    return findings;
}

function applyRepeatDecay(drafts: ScoredFindingDraft[]): CookieSecurityFinding[] {
    const byId = new Map<CookieSecurityFindingId, ScoredFindingDraft[]>();

    for (const draft of drafts) {
        const group = byId.get(draft.id) ?? [];
        group.push(draft);
        byId.set(draft.id, group);
    }

    const scored: CookieSecurityFinding[] = [];

    for (const [, group] of byId) {
        group.sort((left, right) => right.baseDeduction - left.baseDeduction);
        group.forEach((draft, index) => {
            const multiplier = repeatMultiplier(index);
            scored.push({
                id: draft.id,
                track: draft.track,
                cookieName: draft.cookie.name,
                cookieDomain: draft.cookie.domain,
                cookiePath: draft.cookie.path,
                deduction: Math.round(draft.baseDeduction * multiplier),
                message: draft.message,
                severity: draft.severity,
            });
        });
    }

    return scored.filter(finding => finding.deduction > 0);
}

function capFindings(findings: CookieSecurityFinding[]): {
    findings: CookieSecurityFinding[];
    totalDeduction: number;
} {
    let scaled = [...findings];
    const trackCaps: Record<1 | 2 | 3, number> = { 1: CAP_TRACK_1, 2: CAP_TRACK_2, 3: CAP_TRACK_3 };

    for (const track of [1, 2, 3] as const) {
        const cap = trackCaps[track];
        const trackFindings = scaled.filter(finding => finding.track === track);
        const trackTotal = trackFindings.reduce((sum, finding) => sum + finding.deduction, 0);
        if (trackTotal <= cap) continue;

        const factor = cap / trackTotal;
        scaled = scaled.map(finding => finding.track === track
            ? { ...finding, deduction: Math.max(0, Math.round(finding.deduction * factor)) }
            : finding);
    }

    let totalDeduction = scaled.reduce((sum, finding) => sum + finding.deduction, 0);
    if (totalDeduction > CAP_GLOBAL_DEDUCTION) {
        const factor = CAP_GLOBAL_DEDUCTION / totalDeduction;
        scaled = scaled.map(finding => ({
            ...finding,
            deduction: Math.max(0, Math.round(finding.deduction * factor)),
        }));
        totalDeduction = scaled.reduce((sum, finding) => sum + finding.deduction, 0);
    }

    scaled = scaled.filter(finding => finding.deduction > 0);
    return { findings: scaled, totalDeduction };
}

export function computeCookieSecurityScore(site: CookieSite): CookieSecurityScoreResult {
    if (site.cookies.length === 0) {
        return { score: null, findings: [] };
    }

    const drafts = site.cookies.flatMap(evaluateCookie);
    const decayedFindings = applyRepeatDecay(drafts);
    const { findings, totalDeduction } = capFindings(decayedFindings);
    const score = Math.max(SCORE_MIN, 100 - totalDeduction);

    findings.sort((left, right) => right.deduction - left.deduction);

    return {
        score,
        findings,
    };
}

export function getCookieSecurityScoreLabel(score: number | null): string {
    if (score === null) return t('security.empty');
    if (score >= 90) return t('security.safe');
    if (score >= 75) return t('security.minor');
    if (score >= 60) return t('security.notable');
    if (score >= 40) return t('security.serious');
    return t('security.critical');
}

export function getCookieSecurityScoreBadgeClass(score: number | null): string {
    if (score === null) return 'score-badge score-badge--empty';
    if (score >= 90) return 'score-badge score-badge--good';
    if (score >= 75) return 'score-badge score-badge--ok';
    if (score >= 60) return 'score-badge score-badge--warn';
    return 'score-badge score-badge--bad';
}
