import { CookieDatabase } from '../db/CookieDatabase';
import { cleanUrl } from './operation_log';
import { vaultCookieId, toVaultCookie } from './cookie_data';


export function handleCookieChanged(info: chrome.cookies.CookieChangeInfo) {
    console.log('[AV] cookie changed:', info.cookie.name, info.cookie.domain, 'removed:', info.removed, 'cause:', info.cause);
    let queue: Promise<void> = Promise.resolve();
    queue = queue.then(() => process(info)).catch(console.error);
}

async function process({ cookie, removed }: chrome.cookies.CookieChangeInfo) {
    if (removed) return;

    const db = CookieDatabase.getInstance();
    const dbReady = db.init();
    
    const { autoVault } = await chrome.storage.sync.get({ autoVault: false });
    if (!autoVault) return;

    // Check if user unvaults a cookie while AV is on (do not revault)
    const skipKey = `skip:${vaultCookieId(cookie)}`;
    const skip = await chrome.storage.session.get(skipKey);
    if (skip[skipKey]) {
        await chrome.storage.session.remove(skipKey);
        return;
    }

    await dbReady;

    // Flagged cookies should not be intercepted
    const profile = await db.getSiteProfile(cleanUrl(cookie.domain));
    if (profile?.isFlagged) return;

    await db.upsertCookies([toVaultCookie(cookie)]);
    await chrome.cookies.remove({
        url: `http${cookie.secure ? 's' : ''}://${cookie.domain.replace(/^\./, '')}${cookie.path}`,
        name: cookie.name,
        storeId: cookie.storeId,
        partitionKey: cookie.partitionKey,
    });
    
    await db.addLogEntry({
        domain: cleanUrl(cookie.domain),
        timestamp: Date.now(),
        op: 'VAULT',
        detail: `${cookie.name} vaulted`
    });
}