import { describe, test, expect } from 'vitest';
import { getValidationError } from '../src/popup/cookie_edit';
import { CookieEditInput } from '../src/popup/cookie_actions';
import { SiteCookie } from '../src/popup/cookie_data';

const baseCookie: SiteCookie = {
    name: 'session_id',
    value: 'abc',
    domain: 'example.com',
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    session: false,
    expirationDate: Math.floor(Date.now() / 1000) + 10000,
    isVaulted: false,
    vaultId: 'v1',
    storeId: '0',
    hostOnly: false,
};

const baseInput: CookieEditInput = {
    value: 'new_value',
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    session: false,
    expirationDate: Math.floor(Date.now() / 1000) + 10000,
};

describe('Cookie Edit', () => {
    test('Allow basic edit', () => {
        const error = getValidationError(baseCookie, baseInput);
        expect(error).toBeNull();
    });

    test('Rejects invalid characters', () => {
        const input = { ...baseInput, value: 'evil;value\n' };
        const error = getValidationError(baseCookie, input);
        expect(error).not.toBeNull();
    });

    test('Enforces Secure flag for __Host- prefix', () => {
        const hostCookie = { ...baseCookie, name: '__Host-token', path: '/' };
        const input = { ...baseInput, secure: false };
        const error = getValidationError(hostCookie, input);
        expect(error).toBeDefined();
    });

    test('Enforces path="/" for __Host- prefix', () => {
        const hostCookie = { ...baseCookie, name: '__Host-token', path: '/subpath' };
        const error = getValidationError(hostCookie, baseInput);
        expect(error).toBeDefined();
    });

    test('Enforces Secure flag for __Secure- prefix', () => {
        const secureCookie = { ...baseCookie, name: '__Secure-token' };
        const input = { ...baseInput, secure: false };
        const error = getValidationError(secureCookie, input);
        expect(error).toBeDefined();
    });

    test('Enforces Secure flag when SameSite is None', () => {
        const input: CookieEditInput = { ...baseInput, sameSite: 'no_restriction' as any, secure: false };
        const error = getValidationError(baseCookie, input);
        expect(error).toBeDefined();
    });

    test('Rejects incorrect expiration date', () => {
        const input: CookieEditInput = {
            ...baseInput,
            session: false,
            expirationDate: Math.floor(Date.now() / 1000) - 1,
        };
        const error = getValidationError(baseCookie, input);
        expect(error).toBeDefined();
    });
});