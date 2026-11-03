import { describe, test, expect, vi } from 'vitest';
import { computeCookieSecurityScore } from '../src/popup/cookie_security_score';
import { CookieSite } from '../src/popup/cookie_data';

vi.mock('../src/i18n', () => ({
    t: (key: string) => key,
}));

describe('Security Score', () => {
    test('Null no cookies', () => {
        const site: CookieSite = {
            domain: 'empty-site.com',
            isPinned: false,
            isVaulted: false,
            allSecure: true,
            cookies: [],
        };

        const { score, findings } = computeCookieSecurityScore(site);
        expect(score).toBeNull();
        expect(findings).toHaveLength(0);
    });

    test('High score', () => {
        const site: CookieSite = {
            domain: 'secure-site.com',
            isPinned: false,
            isVaulted: false,
            allSecure: true,
            cookies: [
                {
                    name: 'auth_token',
                    value: 'secure_val',
                    domain: 'secure-site.com',
                    path: '/',
                    secure: true,
                    httpOnly: true,
                    sameSite: 'strict',
                    session: true,
                    isVaulted: false,
                    vaultId: '1',
                    storeId: '0',
                    hostOnly: false,
                },
            ],
        };

        const { score } = computeCookieSecurityScore(site);
        expect(score).not.toBeNull();
        if (score !== null) {
            expect(score).toBeGreaterThanOrEqual(90);
        }
    });

    test('Ignores infrastructure cookies', () => {
        const site: CookieSite = {
            domain: 'infra-site.com',
            isPinned: false,
            isVaulted: false,
            allSecure: false,
            cookies: [
                {
                    name: 'ak_bmsc', // Infrastructure cookie
                    value: '123',
                    domain: 'infra-site.com',
                    path: '/',
                    secure: false,
                    httpOnly: false,
                    sameSite: 'no_restriction',
                    session: true,
                    isVaulted: false,
                    vaultId: 'infra-1',
                    storeId: '0',
                    hostOnly: false,
                },
            ],
        };

        const { score, findings } = computeCookieSecurityScore(site);
        expect(score).toBe(100);
        expect(findings).toHaveLength(0);
    });

    test('Auth cookie missing HttpOnly flag', () => {
        const site: CookieSite = {
            domain: 'risky-auth.com',
            isPinned: false,
            isVaulted: false,
            allSecure: false,
            cookies: [
                {
                    name: 'auth',
                    value: '123',
                    domain: 'risky-auth.com',
                    path: '/',
                    secure: true,
                    httpOnly: false,
                    sameSite: 'strict',
                    session: true,
                    isVaulted: false,
                    vaultId: '2',
                    storeId: '0',
                    hostOnly: false,
                },
            ],
        };

        const { score, findings } = computeCookieSecurityScore(site);
        expect(score).not.toBeNull();
        expect(findings.some(f => f.id === 'auth_missing_httponly')).toBe(true);
        if (score !== null) {
            expect(score).toBeLessThan(80);
        }
    });

    test('HttpOnly cookie with SameSite=None and secure=false', () => {
        const site: CookieSite = {
            domain: 'insecure-samesite.com',
            isPinned: false,
            isVaulted: false,
            allSecure: false,
            cookies: [
                {
                    name: 'some_cookie',
                    value: '123',
                    domain: 'insecure-samesite.com',
                    path: '/',
                    secure: false,
                    httpOnly: true,
                    sameSite: 'no_restriction',
                    session: true,
                    isVaulted: false,
                    vaultId: '3',
                    storeId: '0',
                    hostOnly: false,
                },
            ],
        };

        const { findings } = computeCookieSecurityScore(site);
        expect(findings.some(f => f.id === 'samesite_none_insecure')).toBe(true);
    });

    test('Auth cookies with year long expiration', () => {
        const futureDateSec = Math.floor(Date.now() / 1000) + (400 * 24 * 60 * 60);
        const site: CookieSite = {
            domain: 'long-lived.com',
            isPinned: false,
            isVaulted: false,
            allSecure: true,
            cookies: [
                {
                    name: 'session',
                    value: '123',
                    domain: 'long-lived.com',
                    path: '/',
                    secure: true,
                    httpOnly: true,
                    sameSite: 'strict',
                    session: false,
                    expirationDate: futureDateSec,
                    isVaulted: false,
                    vaultId: '4',
                    storeId: '0',
                    hostOnly: false,
                },
            ],
        };

        const { findings } = computeCookieSecurityScore(site);
        expect(findings.some(f => f.id === 'auth_super_long_lived')).toBe(true);
    });

    test('1 deduction per flaw', () => {
        const site: CookieSite = {
            domain: 'multi-auth.com',
            isPinned: false,
            isVaulted: false,
            allSecure: false,
            cookies: [
                {
                    name: 'auth',
                    value: '123',
                    domain: 'multi-auth.com',
                    path: '/',
                    secure: true,
                    httpOnly: false, // auth missing httponly
                    sameSite: 'strict',
                    session: true,
                    isVaulted: false,
                    vaultId: 'm1',
                    storeId: '0',
                    hostOnly: false,
                },
                {
                    name: 'token',
                    value: '456',
                    domain: 'multi-auth.com',
                    path: '/',
                    secure: true,
                    httpOnly: false, // auth missing httponly again
                    sameSite: 'strict',
                    session: true,
                    isVaulted: false,
                    vaultId: 'm2',
                    storeId: '0',
                    hostOnly: false,
                },
            ],
        };

        const { findings } = computeCookieSecurityScore(site);
        const authFindings = findings.filter(f => f.id === 'auth_missing_httponly');
        expect(authFindings).toHaveLength(2);
        expect(authFindings[0].deduction).toBeGreaterThan(authFindings[1].deduction);
    });
});