import { describe, test, expect, vi, beforeEach } from 'vitest';
import { moveCookie } from '../src/popup/site_settings';
import { SiteCookie } from '../src/popup/cookie_data';

vi.stubGlobal('chrome', {
    cookies: {
        remove: vi.fn().mockResolvedValue(undefined),
        set: vi.fn().mockResolvedValue({ name: 'session_id' }),
    },
});

// mock i18n (for translation errors)
vi.mock('../src/i18n', () => ({
    t: (key: string) => key,
    getLocale: () => 'en-US',
    localizeDocument: vi.fn(),
}));

const mockUpsertCookie = vi.fn().mockResolvedValue(undefined);
const mockDeleteCookie = vi.fn().mockResolvedValue(undefined);

vi.mock('../src/db/CookieDatabase', () => ({
    CookieDatabase: {
        getInstance: () => ({
            upsertCookie: mockUpsertCookie,
            deleteCookie: mockDeleteCookie,
        }),
    },
}));

const mockRemoveBrowserCookie = vi.fn().mockResolvedValue(undefined);
const mockRestoreBrowserCookie = vi.fn().mockResolvedValue(undefined);
const mockRecordOperation = vi.fn().mockResolvedValue(undefined);

vi.mock('../src/popup/cookie_actions', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../src/popup/cookie_actions')>();
    return {
        ...actual,
        removeBrowserCookie: (...args: any[]) => mockRemoveBrowserCookie(...args),
        restoreBrowserCookie: (...args: any[]) => mockRestoreBrowserCookie(...args),
    };
});

vi.mock('../src/popup/operation_log', () => ({
    recordOperation: (...args: any[]) => mockRecordOperation(...args),
}));

describe('Vault Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('Vaulting saves to DB and removes from browser', async () => {
        const cookie: SiteCookie = {
            name: 'session_id',
            value: 'notaneviltrojan',
            domain: 'freeram.com',
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: 'lax',
            session: false,
            expirationDate: Math.floor(Date.now() / 1000) + 10000,
            isVaulted: false,
            vaultId: 'vault-1',
            storeId: '0',
            hostOnly: false,
        };

        await moveCookie(cookie);

        expect(mockUpsertCookie).toHaveBeenCalledTimes(1);
        expect(mockRemoveBrowserCookie).toHaveBeenCalledWith(cookie);
        expect(mockRecordOperation).toHaveBeenCalledWith('VAULT', expect.any(String), 'freeram.com');
    });

    test('Unvaulting restores to browser and deletes from DB', async () => {
        const cookie: SiteCookie = {
            name: 'session_id',
            value: 'notaneviltrojan',
            domain: 'freeram.com',
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: 'lax',
            session: false,
            expirationDate: Math.floor(Date.now() / 1000) + 10000,
            isVaulted: true,
            vaultId: 'vault-1',
            storeId: '0',
            hostOnly: false,
        };

        await moveCookie(cookie);

        expect(mockRestoreBrowserCookie).toHaveBeenCalledWith(cookie);
        expect(mockDeleteCookie).toHaveBeenCalledWith('vault-1', 'freeram.com');
        expect(mockRecordOperation).toHaveBeenCalledWith('UNVAULT', expect.any(String), 'freeram.com');
    });
});