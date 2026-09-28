const DB_NAME = 'CookieVaultDB'
const DB_VERSION = 1

export interface Cookie {
  // Unique ID (Chrome uses a combo of name, domain, path, and partitionKey)
  id: string
  // Chrome-specific cookie attributes
  name: string
  value: string
  domain: string
  path: string
  partitionKey: string | null
  expirationDate: number | null // Unix timestamp
  hostOnly: boolean
  session: boolean
  storeId: string
  secure: boolean
  httpOnly: boolean
  sameSite: 'no_restriction' | 'lax' | 'strict' | 'unspecified'
}

export interface SiteProfile {
  domain: string
  durationStartAt: number | null // Unix timestamp. Used to calculate duration
  safetyScore: number | null
  securityFlags: string[]
  permissions: string[]
  isFlagged: boolean
  isPinned: boolean
}

export interface VaultState {
  isProtectionActive: boolean
  totalCookiesBlocked: number
}

export class CookieDatabase {
  /**
   * @description Data Access Object for IndexedDB operations
   * @property {IDBDatabase | null} db - IndexedDB instance
   * @property {Map<string, Cookie[]>} cookieDictionary - In-memory cache of cookies grouped by domain
   * @property {Map<string, Cookie>} cookieById - In-memory cache of cookies indexed by ID
   */
  private db: IDBDatabase | null = null;
  private cookieDictionary: Map<string, Cookie[]> = new Map();
  private cookieById: Map<string, Cookie> = new Map();

  // /**
  //  * Encrypts a cookie value.
  //  * @param {string} value - The raw string value to encrypt.
  //  * @returns {string} The encrypted string.
  //  */
  // private encryptValue(value: string): string {
  //   // TODO
  //   return value;
  // }

  // /**
  //  * Decrypts an encrypted cookie value.
  //  * @param {string} value - The encrypted string to decrypt.
  //  * @returns {string} The decrypted raw string.
  //  */
  // private decryptValue(value: string): string {
  //   // TODO
  //   return value;
  // }

  /**
   * Initializes the IndexedDB connection and loads existing cookies into the dictionary cache.
   * @param {string} [dbName] - The name of the database.
   * @param {number} [dbVersion] - The version of the database.
   * @returns {Promise<void>}
   */
  public async init(dbName?: string, dbVersion?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName || DB_NAME, dbVersion || DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        const transaction = this.db.transaction('cookies', 'readonly');
        const store = transaction.objectStore('cookies');
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          const cookiesFromDb = getAllRequest.result as Cookie[];

          // TODO: Add decryption later

          this.cookieDictionary.clear();
          this.cookieById.clear();
          for (const cookie of cookiesFromDb) {
            this.cookieById.set(cookie.id, cookie);
            if (!this.cookieDictionary.has(cookie.domain)) {
              this.cookieDictionary.set(cookie.domain, []);
            }
            this.cookieDictionary.get(cookie.domain)!.push(cookie);
          }
          resolve();
        };

        getAllRequest.onerror = () => {
          reject(new Error(`Failed to get all cookies: ${getAllRequest.error?.message}`));
        };
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('cookies')) {
          const cookieStore = db.createObjectStore('cookies', { keyPath: 'id' });
          cookieStore.createIndex('domain', 'domain', { unique: false });
        }
        if (!db.objectStoreNames.contains('siteProfiles')) {
          db.createObjectStore('siteProfiles', { keyPath: 'domain' });
        }
      };
    });
  }

  /**
   * Inserts or updates a cookie in the database.
   * @param {Cookie} cookie - The cookie to insert or update.
   * @returns {Promise<void>}
   */
  public async upsertCookie(cookie: Cookie): Promise<void> {
    return this.upsertCookies([cookie]);
  }

  /**
   * Inserts or updates multiple cookies. 
   * @param {Cookie[]} cookies - The cookies to insert or update.
   * @returns {Promise<void>}
   */
  public async upsertCookies(cookies: Cookie[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      // TODO: Add encryption later

      const transaction = this.db!.transaction('cookies', 'readwrite');
      const store = transaction.objectStore('cookies');

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = () => {
        reject(new Error(`Failed to insert cookies: ${transaction.error?.message}`));
      };

      for (const cookie of cookies) {
        const request = store.put(cookie);
        request.onsuccess = () => {
          // Update dictionary and ID map
          this.cookieById.set(cookie.id, cookie);

          if (!this.cookieDictionary.has(cookie.domain)) {
            this.cookieDictionary.set(cookie.domain, []);
          }
          const domainCookies = this.cookieDictionary.get(cookie.domain)!;
          const existingIndex = domainCookies.findIndex(c => c.id === cookie.id);

          if (existingIndex !== -1) {
            domainCookies[existingIndex] = cookie;
          } else {
            domainCookies.push(cookie);
          }
        };
      }
    });
  }

  /**
   * Deletes a cookie from the database.
   * @param {string} id - The ID of the cookie to delete.
   * @param {string} domain - The domain of the cookie to delete.
   * @returns {Promise<void>}
   */
  public async deleteCookie(id: string, domain: string): Promise<void> {
    // TODO: Consider a deletion method that only requires ID. 
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('cookies', 'readwrite');
      const store = transaction.objectStore('cookies');
      const request = store.delete(id);

      request.onsuccess = () => {
        this.cookieById.delete(id);

        if (this.cookieDictionary.has(domain)) {
          const domainCookies = this.cookieDictionary.get(domain)!;
          const filteredCookies = domainCookies.filter(c => c.id !== id);

          if (filteredCookies.length === 0) {
            this.cookieDictionary.delete(domain);
          } else {
            this.cookieDictionary.set(domain, filteredCookies);
          }
        }
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete cookie: ${request.error?.message}`));
      };
    });
  }

  /**
   * Deletes all cookies associated with a specific domain.
   * @param {string} domain - The domain of the cookies to delete.
   * @returns {Promise<void>}
   */
  public async deleteCookiesByDomain(domain: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('cookies', 'readwrite');
      const store = transaction.objectStore('cookies');
      const index = store.index('domain');
      const request = index.openCursor(IDBKeyRange.only(domain));
      const deletedIds = new Set<string>();

      request.onsuccess = () => {
        const cursor = request.result;

        if (cursor) {
          const cookie = cursor.value as Cookie;
          deletedIds.add(cookie.id);
          cursor.delete();
          cursor.continue();
          return;
        }

        const domainCookies = this.cookieDictionary.get(domain) ?? [];
        for (const cookie of domainCookies) {
          if (deletedIds.has(cookie.id)) {
            this.cookieById.delete(cookie.id);
          }
        }
        this.cookieDictionary.delete(domain);
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete cookies: ${request.error?.message}`));
      };
    });
  }

  /**
   * Deletes all cookies from the database.
   * @returns {Promise<void>}
   */
  public async deleteAllCookies(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('cookies', 'readwrite');
      const store = transaction.objectStore('cookies');
      const request = store.clear();

      request.onsuccess = () => {
        this.cookieDictionary.clear();
        this.cookieById.clear();
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete all cookies: ${request.error?.message}`));
      };
    });
  }

  /**
   * Retrieves all cookies associated with a specific domain.
   * @param {string} domain - The domain of the cookies to retrieve.
   * @returns {Promise<Cookie[]>}
   */
  public async getCookiesByDomain(domain: string): Promise<Cookie[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('cookies', 'readonly');
      const store = transaction.objectStore('cookies');
      const index = store.index('domain');
      const request = index.getAll(domain);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get cookies: ${request.error?.message}`));
      };
    });
  }

  /**
   * Retrieves a specific cookie by its ID from the database.
   * @param {string} id - The ID of the cookie to retrieve.
   * @returns {Promise<Cookie | undefined>}
   */
  public getCookieByIdSync(id: string): Cookie | undefined {
    return this.cookieById.get(id);
  }

  /**
   * Retrieves all cookies stored in the database.
   * @returns {Map<string, Cookie[]>}
   */
  public getAllCookiesGroupedByDomain(): Map<string, Cookie[]> {
    return this.cookieDictionary;
  }

  /**
   * Retrieves all cookies stored in the database.
   * @returns {Cookie[]}
   */
  public getAllCookies(): Cookie[] {
    return Array.from(this.cookieById.values());
  }

  /**
   * Inserts or updates a site profile in the database.
   * @param {SiteProfile} profile - The site profile to insert or update.
   * @returns {Promise<void>}
   */
  public async upsertSiteProfile(profile: SiteProfile): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('siteProfiles', 'readwrite');
      const store = transaction.objectStore('siteProfiles');
      const request = store.put(profile);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to upsert site profile: ${request.error?.message}`));
      };
    });
  }

  /**
   * Retrieves a site profile from the database.
   * @param {string} domain - The domain of the site profile to retrieve.
   * @returns {Promise<SiteProfile | undefined>}
   */
  public async getSiteProfile(domain: string): Promise<SiteProfile | undefined> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('siteProfiles', 'readonly');
      const store = transaction.objectStore('siteProfiles');
      const request = store.get(domain);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get site profile: ${request.error?.message}`));
      };
    });
  }

  /**
   * Retrieves all site profiles from the database.
   * @returns {Promise<SiteProfile[]>}
   */
  public async getAllSiteProfiles(): Promise<SiteProfile[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('siteProfiles', 'readonly');
      const store = transaction.objectStore('siteProfiles');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get all site profiles: ${request.error?.message}`));
      };
    });
  }

  /**
   * Deletes a site profile from the database.
   * @param {string} domain - The domain of the site profile to delete.
   * @returns {Promise<void>}
   */
  public async deleteSiteProfile(domain: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('siteProfiles', 'readwrite');
      const store = transaction.objectStore('siteProfiles');
      const request = store.delete(domain);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete site profile: ${request.error?.message}`));
      };
    });
  }

  /**
   * Delete all site profiles
   * @returns {Promise<void>}
   */
  public async deleteAllSiteProfiles(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('siteProfiles', 'readwrite');
      const store = transaction.objectStore('siteProfiles');
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete all site profiles: ${request.error?.message}`));
      };
    });
  }

  /**
   * Retrieves the current state of the vault from Chrome's local storage.
   * @returns {Promise<VaultState>} The current state of the vault, including protection status and blocked cookie count.
   */
  public async getVaultState(): Promise<VaultState> {
    const result = await chrome.storage.local.get(['isProtectionActive', 'totalCookiesBlocked']);

    return {
      isProtectionActive: (result.isProtectionActive as boolean) ?? false,
      totalCookiesBlocked: (result.totalCookiesBlocked as number) ?? 0
    };
  }

  /**
   * Updates the current state of the vault in Chrome's local storage.
   * @param {Partial<VaultState>} stateUpdate - The state updates to apply.
   * @returns {Promise<void>}
   */
  public async updateVaultState(stateUpdate: Partial<VaultState>): Promise<void> {
    await chrome.storage.local.set(stateUpdate);
  }

  /**
   * Clears all data from the database, including cookies and site profiles, and resets the in-memory caches.
   * @returns {Promise<void>}
   */
  public async clearDatabase(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cookies', 'siteProfiles'], 'readwrite');
      const cookieStore = transaction.objectStore('cookies');
      const siteProfileStore = transaction.objectStore('siteProfiles');

      cookieStore.clear();
      siteProfileStore.clear();

      transaction.oncomplete = () => {
        this.cookieDictionary.clear();
        this.cookieById.clear();
        resolve();
      };

      transaction.onerror = () => {
        reject(new Error(`Failed to clear database: ${transaction.error?.message}`));
      };

      transaction.onabort = () => {
        reject(new Error(`Database clear aborted: ${transaction.error?.message}`));
      };
    });
  }

  /**
   * Closes the IndexedDB connection and clears the in-memory cookie dictionary.
   * @returns {Promise<void>}
   */
  public async close(): Promise<void> {
    this.db?.close();
    this.db = null;
    this.cookieDictionary.clear();
    this.cookieById.clear();
  }
}