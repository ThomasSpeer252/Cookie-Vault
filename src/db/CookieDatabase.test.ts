import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { CookieDatabase, Cookie, SiteProfile } from './CookieDatabase';

// Mock chrome.storage.local
const mockChromeStorage = {
  get: vi.fn(),
  set: vi.fn(),
};

vi.stubGlobal('chrome', {
  storage: {
    local: mockChromeStorage,
  },
});

describe('CookieDatabase', () => {
  let db: CookieDatabase;
  let dbName: string;

  const mockCookie: Cookie = {
    id: 'test-cookie-1',
    name: 'session_id',
    value: '123456789',
    domain: 'example.com',
    path: '/',
    partitionKey: null,
    expirationDate: Date.now() + 10000,
    hostOnly: true,
    session: false,
    storeId: '0',
    secure: true,
    httpOnly: true,
    sameSite: 'lax'
  };

  const mockSiteProfile: SiteProfile = {
    domain: 'example.com',
    durationStartAt: Date.now(),
    safetyScore: 85,
    securityFlags: ['HTTPS'],
    permissions: ['notifications'],
    isFlagged: false,
    isPinned: false
  };

  beforeEach(async () => {
    db = CookieDatabase.getInstance();
    dbName = 'TestDB_' + Date.now();
    await db.init(dbName, 2);
  });

  afterEach(async () => {
    try {
      await db.clearDatabase();
    } catch (e) {
      // Ignore if db was closed by the test
    }
    await db.close();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(db).toBeDefined();
    });

    it('should return the same instance', () => {
      expect(CookieDatabase.getInstance()).toBe(db);
    });
  });

  describe('Cookie Operations', () => {
    it('should insert a cookie and retrieve it', async () => {
      await db.upsertCookie(mockCookie);

      const retrieved = db.getCookieByIdSync(mockCookie.id);
      expect(retrieved).toEqual(mockCookie);

      const domainCookies = await db.getCookiesByDomain(mockCookie.domain);
      expect(domainCookies).toHaveLength(1);
      expect(domainCookies[0]).toEqual(mockCookie);
    });

    it('should insert multiple cookies', async () => {
      const cookiesToInsert = [
        {
          ...mockCookie,
          id: 'test-cookie-1',
        },
        {
          ...mockCookie,
          id: 'test-cookie-2',
        },
        {
          ...mockCookie,
          id: 'test-cookie-3',
        }
      ];
      await db.upsertCookies(cookiesToInsert);

      const cookies = await db.getAllCookies();
      expect(cookies).toHaveLength(3);

      const domainCookies = db.getAllCookiesGroupedByDomain();
      expect(domainCookies.get(mockCookie.domain)).toHaveLength(3);
    });

    it('should update an existing cookie and retrieve it', async () => {
      await db.upsertCookie(mockCookie);

      const updatedCookie = { ...mockCookie, value: 'new-value' };
      await db.upsertCookie(updatedCookie);

      const retrieved = db.getCookieByIdSync(mockCookie.id);
      expect(retrieved?.value).toBe('new-value');
      expect(retrieved).toEqual(updatedCookie);
    });

    it('should get all cookies', async () => {
      await db.upsertCookie(mockCookie);
      await db.upsertCookie({ ...mockCookie, id: 'test-cookie-2' });
      await db.upsertCookie({ ...mockCookie, id: 'test-cookie-3', domain: 'test.com' });
      const allCookies = await db.getAllCookies();
      expect(allCookies).toHaveLength(3);
    });

    it('should get all cookies grouped by domain', async () => {
      await db.upsertCookie(mockCookie);
      await db.upsertCookie({ ...mockCookie, id: 'test-cookie-2' });
      await db.upsertCookie({ ...mockCookie, id: 'test-cookie-3', domain: 'test.com' });
      const cookiesByDomain = db.getAllCookiesGroupedByDomain();
      expect(cookiesByDomain.size).toBe(2);
      expect(cookiesByDomain.get('example.com')?.length).toBe(2);
      expect(cookiesByDomain.get('test.com')?.length).toBe(1);
    });

    it('should delete a cookie by id', async () => {
      await db.upsertCookie(mockCookie);
      let allCookies = await db.getAllCookies();
      expect(allCookies).toHaveLength(1);
      await db.deleteCookie(mockCookie.id, mockCookie.domain);
      allCookies = await db.getAllCookies();
      expect(allCookies).toHaveLength(0);

    });

    it('should delete all cookies by domain', async () => {
      await db.upsertCookie(mockCookie);
      await db.upsertCookie({ ...mockCookie, id: 'test-cookie-2' });
      await db.upsertCookie({ ...mockCookie, id: 'test-cookie-3', domain: 'test.com' });

      let allCookies = await db.getAllCookies();
      expect(allCookies).toHaveLength(3);

      await db.deleteCookiesByDomain(mockCookie.domain);

      const remainingByDomain = await db.getCookiesByDomain(mockCookie.domain);
      expect(remainingByDomain).toHaveLength(0);

      allCookies = await db.getAllCookies();
      expect(allCookies).toHaveLength(1);
      expect(allCookies[0].domain).toBe('test.com');
    });

    it('should delete all cookies', async () => {
      await db.upsertCookie(mockCookie);
      await db.upsertCookie({ ...mockCookie, id: 'test-cookie-2' });
      await db.upsertCookie({ ...mockCookie, id: 'test-cookie-3', domain: 'test.com' });
      let allCookies = await db.getAllCookies();
      expect(allCookies).toHaveLength(3);
      await db.deleteAllCookies();
      allCookies = await db.getAllCookies();
      expect(allCookies).toHaveLength(0);
    });
  });

  describe('Site Profile Operations', () => {
    it('should persist a pinned profile after reopening the database', async () => {
      const pinnedProfile = { ...mockSiteProfile, isPinned: true };
      await db.upsertSiteProfile(pinnedProfile);
      await db.close();
      await db.init(dbName, 2);

      expect(await db.getSiteProfile(pinnedProfile.domain)).toEqual(pinnedProfile);
    });

    it('should insert and retrieve it', async () => {
      await db.upsertSiteProfile(mockSiteProfile);

      const retrieved = await db.getSiteProfile(mockSiteProfile.domain);
      expect(retrieved).toEqual(mockSiteProfile);
    });

    it('should update a site profile and retrieve it', async () => {
      await db.upsertSiteProfile(mockSiteProfile);

      const updatedProfile = { ...mockSiteProfile, safetyScore: 90 };
      await db.upsertSiteProfile(updatedProfile);

      const retrieved = await db.getSiteProfile(mockSiteProfile.domain);
      expect(retrieved).toEqual(updatedProfile);
    });

    it('should get all site profiles', async () => {
      await db.upsertSiteProfile(mockSiteProfile);
      await db.upsertSiteProfile({ ...mockSiteProfile, domain: 'test.com' });
      const allProfiles = await db.getAllSiteProfiles();
      expect(allProfiles).toHaveLength(2);
    });

    it('should delete a site profile', async () => {
      await db.upsertSiteProfile(mockSiteProfile);
      await db.upsertSiteProfile({ ...mockSiteProfile, domain: 'test.com' });
      let allProfiles = await db.getAllSiteProfiles();
      expect(allProfiles).toHaveLength(2);
      await db.deleteSiteProfile(mockSiteProfile.domain);
      allProfiles = await db.getAllSiteProfiles();
      expect(allProfiles).toHaveLength(1);
    });

    it('should delete all site profiles', async () => {
      await db.upsertSiteProfile(mockSiteProfile);
      await db.upsertSiteProfile({ ...mockSiteProfile, domain: 'test.com' });
      let allProfiles = await db.getAllSiteProfiles();
      expect(allProfiles).toHaveLength(2);
      await db.deleteAllSiteProfiles();
      allProfiles = await db.getAllSiteProfiles();
      expect(allProfiles).toHaveLength(0);
    });
  });

  describe('Operation Log Operations', () => {
    it('should migrate version 3 logs while preserving their data and all-sites operations', async () => {
      await db.close();
      await db.init(dbName, 3);
      await db.upsertCookie(mockCookie);
      await db.upsertSiteProfile(mockSiteProfile);
      await db.close();

      const legacyEntries = ['vault', 'unvault', 'block', 'warn', 'delete', 'unvault'].map((op, index) => ({
        id: index + 1,
        domain: index === 5 ? 'all sites' : 'example.com',
        timestamp: 1000 + index,
        op,
        detail: `Legacy operation ${index}`,
      }));

      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName, 3);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const legacyDb = request.result;
          const transaction = legacyDb.transaction('operationLogs', 'readwrite');
          for (const entry of legacyEntries) {
            transaction.objectStore('operationLogs').add(entry);
          }
          transaction.oncomplete = () => {
            legacyDb.close();
            resolve();
          };
          transaction.onerror = () => {
            legacyDb.close();
            reject(transaction.error);
          };
        };
      });

      await db.init(dbName);

      const operations = ['VAULT', 'UNVAULT', 'BLOCK', 'WARN', 'DELETE', 'UNVAULT_ALL'];
      await expect(db.getLogEntries()).resolves.toEqual(
        legacyEntries.map((entry, index) => ({ ...entry, op: operations[index] })).reverse(),
      );
      expect(db.getCookieByIdSync(mockCookie.id)).toEqual(mockCookie);
      await expect(db.getSiteProfile(mockSiteProfile.domain)).resolves.toEqual(mockSiteProfile);

      await db.addLogEntry({ domain: 'all sites', timestamp: 2000, op: 'UNVAULT_ALL', detail: 'All cookies unvaulted' });
      await db.close();
      await db.init(dbName);
      expect((await db.getLogEntries())[0].op).toBe('UNVAULT_ALL');
    });

    it('should return an empty array when there are no log entries', async () => {
      await expect(db.getLogEntries()).resolves.toEqual([]);
    });

    it('should handle zero and oversized limits', async () => {
      await db.addLogEntry({
        domain: 'example.com',
        timestamp: 1000,
        op: 'VAULT',
        detail: 'session_id vaulted',
      });

      await expect(db.getLogEntries(0)).resolves.toEqual([]);
      await expect(db.getLogEntries(10)).resolves.toHaveLength(1);
    });

    it('should return all entries when timestamps are equal', async () => {
      await db.addLogEntry({
        domain: 'example.com',
        timestamp: 1000,
        op: 'VAULT',
        detail: 'session_id vaulted',
      });
      await db.addLogEntry({
        domain: 'example.com',
        timestamp: 1000,
        op: 'UNVAULT',
        detail: 'session_id unvaulted',
      });

      const entries = await db.getLogEntries();

      expect(entries).toHaveLength(2);
      expect(entries.map(entry => entry.timestamp)).toEqual([1000, 1000]);
      expect(entries.map(entry => entry.op)).toEqual(expect.arrayContaining(['VAULT', 'UNVAULT']));
    });

    it('should add log entries and return them newest first with the requested limit', async () => {
      await db.addLogEntry({
        domain: 'example.com',
        timestamp: 1000,
        op: 'VAULT',
        detail: 'session_id vaulted',
      });
      await db.addLogEntry({
        domain: 'test.com',
        timestamp: 3000,
        op: 'WARN',
        detail: 'Credential harvesting detected',
      });
      await db.addLogEntry({
        domain: 'example.com',
        timestamp: 2000,
        op: 'UNVAULT',
        detail: 'session_id unvaulted',
      });

      const entries = await db.getLogEntries(2);

      expect(entries).toHaveLength(2);
      expect(entries.map(entry => entry.timestamp)).toEqual([3000, 2000]);
      expect(entries.map(entry => entry.op)).toEqual(['WARN', 'UNVAULT']);
      expect(entries.every(entry => typeof entry.id === 'number')).toBe(true);
    });

    it('should persist log entries after reopening the database', async () => {
      const entry = {
        domain: 'example.com',
        timestamp: 1000,
        op: 'DELETE' as const,
        detail: 'session_id deleted',
      };

      await db.addLogEntry(entry);
      await db.close();
      await db.init(dbName, 2);

      await expect(db.getLogEntries()).resolves.toEqual([
        expect.objectContaining(entry),
      ]);
    });

    it('should clear all log entries', async () => {
      await db.addLogEntry({
        domain: 'example.com',
        timestamp: 1000,
        op: 'VAULT',
        detail: 'session_id vaulted',
      });

      await db.clearLogEntries();

      await expect(db.getLogEntries()).resolves.toEqual([]);
    });
  });

  describe('Vault State Operations', () => {
    it('should get vault state from chrome.storage', async () => {
      mockChromeStorage.get.mockResolvedValueOnce({
        isProtectionActive: true,
        totalCookiesBlocked: 42
      });

      const state = await db.getVaultState();
      expect(mockChromeStorage.get).toHaveBeenCalledWith(['isProtectionActive', 'totalCookiesBlocked']);
      expect(state).toEqual({
        isProtectionActive: true,
        totalCookiesBlocked: 42
      });
    });

    it('should return default vault state if empty', async () => {
      mockChromeStorage.get.mockResolvedValueOnce({});

      const state = await db.getVaultState();
      expect(state).toEqual({
        isProtectionActive: false,
        totalCookiesBlocked: 0
      });
    });

    it('should update vault state', async () => {
      mockChromeStorage.set.mockResolvedValueOnce(undefined);

      await db.updateVaultState({ isProtectionActive: true });
      expect(mockChromeStorage.set).toHaveBeenCalledWith({ isProtectionActive: true });
    });
  });

  describe('Uninitialized Database Errors', () => {
    it('should throw an error if database is not initialized', async () => {
      await db.close();
      await expect(db.upsertCookie(mockCookie)).rejects.toThrow('Database not initialized');
      await expect(db.deleteCookie('id', 'domain')).rejects.toThrow('Database not initialized');
      await expect(db.getCookiesByDomain('domain')).rejects.toThrow('Database not initialized');
      await expect(db.addLogEntry({
        domain: 'example.com',
        timestamp: 1000,
        op: 'VAULT',
        detail: 'session_id vaulted',
      })).rejects.toThrow('Database not initialized');
      await expect(db.getLogEntries()).rejects.toThrow('Database not initialized');
      await expect(db.clearLogEntries()).rejects.toThrow('Database not initialized');
    });
  });

  describe('Pre-existing Data Initialization', () => {
    it('should load pre-existing cookies into the dictionary upon initialization', async () => {
      await db.upsertCookie(mockCookie);
      await db.close();

      const reopenedDb = CookieDatabase.getInstance();
      expect(reopenedDb).toBe(db);
      await reopenedDb.init(dbName, 2);

      const cookiesByDomain = reopenedDb.getAllCookiesGroupedByDomain();
      expect(cookiesByDomain.size).toBe(1);
      expect(cookiesByDomain.get(mockCookie.domain)?.[0]).toEqual(mockCookie);
    });
  });

  describe('Non-Existent Records', () => {
    it('should handle deleting a non-existent cookie safely', async () => {
      await expect(db.deleteCookie('fake-id', 'fake-domain')).resolves.toBeUndefined();
    });

    it('should return undefined for non-existent site profile', async () => {
      const profile = await db.getSiteProfile('fake.com');
      expect(profile).toBeUndefined();
    });
  });

  it('should remove only the selected domain from IndexedDB', async () => {
    await db.upsertCookie(mockCookie);
    await db.upsertCookie({ ...mockCookie, id: 'x2', domain: 'other.com' });

    await db.deleteCookiesByDomain('example.com');

    const remaining = await db.getCookiesByDomain('example.com');
    expect(remaining).toHaveLength(0);

    const other = await db.getCookiesByDomain('other.com');
    expect(other).toHaveLength(1);
  });

  it('should clear persisted data after clearDatabase', async () => {
    await db.upsertCookie(mockCookie);
    await db.upsertSiteProfile(mockSiteProfile);

    await db.clearDatabase();

    await db.close();
    const nextDb = CookieDatabase.getInstance();
    expect(nextDb).toBe(db);
    await nextDb.init(dbName, 2);

    expect(nextDb.getAllCookies()).toHaveLength(0);
    expect(await nextDb.getAllSiteProfiles()).toHaveLength(0);
  });
});
