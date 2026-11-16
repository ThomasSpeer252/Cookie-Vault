import { describe, test, expect, vi } from 'vitest';
import { getCookieFlags, formatCookieExpiration, escapeHtml } from '../src/popup/cookie_format';

vi.mock('../src/i18n', () => ({
    t: (key: string, params?: any) => key + (params ? JSON.stringify(params) : ''),
    getLocale: () => 'en-US',
}));

describe('Cookie Format', () => {
    test('Make flag badge', () => {
        const cookie = {
            name: 'test',
            domain: 'example.com',
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: 'strict',
            storeId: '0',
            hostOnly: false,
        } as chrome.cookies.Cookie;

        const flags = getCookieFlags(cookie);
        expect(flags).toContainEqual(expect.objectContaining({ kind: 'secure', label: 'SEC' }));
        expect(flags).toContainEqual(expect.objectContaining({ kind: 'http-only', label: 'HTTP' }));
        expect(flags).toContainEqual(expect.objectContaining({ kind: 'same-site', label: 'SS:S' }));
    });

    test('Expiration date', () => {
        const cookie = {
            session: true,
            domain: 'example.com',
            name: 'test',
            path: '/',
            storeId: '0',
            hostOnly: false,
        } as chrome.cookies.Cookie;

        const expiration = formatCookieExpiration(cookie);
        expect(expiration.label).toBeTruthy();
    });

    test('Safe HTML character escape', () => {
        const raw = '<script>alert("XSS")</script>&amp;';
        const safe = escapeHtml(raw);
        expect(safe).not.toContain('<script>');
        expect(safe).toContain('&lt;script&gt;');
    });
});