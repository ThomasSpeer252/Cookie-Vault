import type { CookieSite } from './cookie_data';

export const COOKIE_SECURITY_SCORE_VERSION = '1.0.0';

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

const SESSION_NAME_PATTERN = /^(session(id)?|sid|jsessionid|phpsessid|asp\.net_sessionid|connect\.sid)$/i;
const TOKEN_NAME_PATTERN = /^(auth|token|access_token|refresh_token|jwt|login|csrf|xsrf)$/i;
const TOKEN_NAME_SUBSTRING = /(auth|token|session|jwt)/i;

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
    version: string;
}

type AuthConfidence = 'high' | 'medium' | 'low';

interface AuthClassification {
    inScope: boolean;
    confidence: AuthConfidence;
}

interface ScoredFindingDraft {
    id: CookieSecurityFindingId;
    track: 1 | 2 | 3;
    cookie: chrome.cookies.Cookie;
    baseDeduction: number;
    message: string;
    severity: CookieSecuritySeverity;
}

function isAuthSessionCookie(cookie: chrome.cookies.Cookie): AuthClassification {
    const name = cookie.name.toLowerCase();

    if (cookie.session) {
        return { inScope: true, confidence: 'high' };
    }

    if (SESSION_NAME_PATTERN.test(name)) {
        return { inScope: true, confidence: cookie.httpOnly || cookie.secure ? 'high' : 'medium' };
    }

    const tokenLikeName = TOKEN_NAME_PATTERN.test(name)
        || (TOKEN_NAME_SUBSTRING.test(name) && name.length <= 48);

    if (tokenLikeName && (cookie.httpOnly || cookie.secure || cookie.session)) {
        return { inScope: true, confidence: 'medium' };
    }

    if (TOKEN_NAME_PATTERN.test(name) || SESSION_NAME_PATTERN.test(name)) {
        return { inScope: false, confidence: 'low' };
    }

    return { inScope: false, confidence: 'low' };
}

function authInScope(classification: AuthClassification): boolean {
    return classification.inScope
        && (classification.confidence === 'high' || classification.confidence === 'medium');
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
    const findings: ScoredFindingDraft[] = [];
    const auth = isAuthSessionCookie(cookie);
    const authScoped = authInScope(auth);

    if (authScoped && !cookie.httpOnly) {
        findings.push({
            id: 'auth_missing_httponly',
            track: 2,
            cookie,
            baseDeduction: BASE_2A_AUTH_NO_HTTPONLY,
            message: 'Likely authentication or session cookie is accessible to JavaScript (missing HttpOnly).',
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
                message: 'HttpOnly cookie allows cross-site use without Secure (SameSite=None).',
                severity: 'critical',
            });
        } else if (!cookie.secure) {
            findings.push({
                id: 'missing_secure_httponly_cookie',
                track: 1,
                cookie,
                baseDeduction: Math.round(BASE_1A_SECURE_MISSING * multiplier),
                message: 'HttpOnly cookie can be sent over unencrypted connections (missing Secure).',
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
                message: 'Authentication or session cookie remains valid for over a year (minor).',
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
        return { score: null, findings: [], version: COOKIE_SECURITY_SCORE_VERSION };
    }

    const drafts = site.cookies.flatMap(evaluateCookie);
    const decayedFindings = applyRepeatDecay(drafts);
    const { findings, totalDeduction } = capFindings(decayedFindings);
    const score = Math.max(SCORE_MIN, 100 - totalDeduction);

    findings.sort((left, right) => right.deduction - left.deduction);

    return {
        score,
        findings,
        version: COOKIE_SECURITY_SCORE_VERSION,
    };
}

export function getCookieSecurityScoreLabel(score: number | null): string {
    if (score === null) return 'No cookies stored for this site.';
    if (score >= 90) return 'No significant cookie-security concerns identified.';
    if (score >= 75) return 'Minor concerns.';
    if (score >= 60) return 'Notable concerns.';
    if (score >= 40) return 'Serious concerns.';
    return 'Critical cookie-configuration concerns.';
}

export function getCookieSecurityScoreBadgeClass(score: number | null): string {
    if (score === null) return 'score-badge score-badge--empty';
    if (score >= 90) return 'score-badge score-badge--good';
    if (score >= 75) return 'score-badge score-badge--ok';
    if (score >= 60) return 'score-badge score-badge--warn';
    return 'score-badge score-badge--bad';
}
