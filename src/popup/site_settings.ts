import { removeBrowserCookie, restoreBrowserCookie, deleteSpecificCookie} from './cookie_actions';
import {toVaultCookie, type CookieSite, type SiteCookie, getCookieSites} from './cookie_data';
import { CookieDatabase } from '../db/CookieDatabase';
import { openCookieEdit } from './cookie_edit';
import { escapeHtml, formatCookieExpiration, getCookieFlags } from './cookie_format';
import { openOverlay, type OverlayHandle } from './overlay';

const PLACEHOLDER_SECURITY = 'No Concerns Found';
const PLACEHOLDER_SAFETY_SCORE = 94;

export async function moveCookie(cookie: SiteCookie): Promise<void> {
    const db = CookieDatabase.getInstance();
    if (cookie.isVaulted) {
        await restoreBrowserCookie(cookie);
        try {
            await db.deleteCookie(cookie.vaultId, cookie.domain);
        } catch (error) {
            await removeBrowserCookie(cookie);
            throw error;
        }
    } else {
        try {
            await db.deleteCookie(cookie.vaultId, cookie.domain);
        } catch {}

        await db.upsertCookie(toVaultCookie(cookie));
        try {
            await removeBrowserCookie(cookie);
        } catch (error) {
            await db.deleteCookie(cookie.vaultId, cookie.domain);
            throw error;
        }
    }
}

function renderCookie(cookie: SiteCookie, index: number): string {
    const flags = getCookieFlags(cookie)
        .map(flag => `<span class="flag-badge flag-badge--${flag.kind}"${flag.title
            ? ` title="${escapeHtml(flag.title)}"`
            : ''}>${flag.label}</span>`)
        .join('');
    const expiration = formatCookieExpiration(cookie);
    const name = cookie.name || '(unnamed)';

    return `
      <div class="cookie-row"
        data-cookie-index="${index}">
        <div class="cookie-meta">
          <span class="cookie-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
          <div class="flag-badges">${flags}</div>
        </div>
        <span class="cookie-expires" title="${escapeHtml(expiration.title)}">${escapeHtml(expiration.label)}</span>
        <div class="button-group" data-density="compact">
          <button type="button" class="icon-btn${cookie.isVaulted ? ' icon-btn--amber' : ''}" data-action="lock-cookie" title="${cookie.isVaulted ? 'Unvault Cookie' : 'Vault Cookie'}">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="7" width="10" height="7" rx="1.5"/>
              <path d="${cookie.isVaulted ? 'M5 7V4.5a3 3 0 0 1 6 0' : 'M5 7V4.5a3 3 0 0 1 6 0V7'}"/>
            </svg>
          </button>
          <button type="button" class="icon-btn" data-action="edit-cookie" title="Edit Cookie">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M11 2l3 3-9 9H2v-3l9-9z"/>
            </svg>
          </button>
          <button type="button" class="icon-btn" data-action="delete-cookie" title="Delete Cookie">
            <svg width="11" height="11" viewBox="0 0 13 13" fill="none">
              <path d="M2 3.5h9M5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M10 3.5l-.6 7a.5.5 0 0 1-.5.5H4.1a.5.5 0 0 1-.5-.5l-.6-7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
}

export function renderSiteDetails(
    site: CookieSite,
    refreshSite: () => void | Promise<void>,
    existingOverlay?: OverlayHandle,
): OverlayHandle | null {
    async function renderSelf() {
        const scrollContainer = overlay?.element.querySelector<HTMLElement>('.cookie-list-container');
        const savedScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

        const freshSites = await getCookieSites();
        const freshSite = freshSites.find(s => s.domain === site.domain);

        if (!freshSite || freshSite.cookies.length === 0) {
            overlay?.close();
            await refreshSite();
            return;
        }

        renderSiteDetails(freshSite, refreshSite, overlay);

        const newScrollContainer = overlay?.element.querySelector<HTMLElement>('.cookie-list-container');
        if (newScrollContainer) {
            newScrollContainer.scrollTop = savedScrollTop;
        }
    }

    const secureCount = site.cookies.filter(cookie => cookie.secure).length;
    const httpOnlyCount = site.cookies.filter(cookie => cookie.httpOnly).length;

    const content = `
      <div class="site-details-view">
        <section class="detail-card cookies-card">
          <header class="card-header">
            <div class="header-title">
              <span class="mono-label">COOKIES —</span>
              <span class="domain-badge" title="${escapeHtml(site.domain)}">${escapeHtml(site.domain)}</span>
            </div>
            <button type="button" class="icon-btn" data-action="close-details" title="Close">✕</button>
          </header>

          <div class="cookies-table">
            <div class="table-header">
              <span>NAME / FLAGS</span>
              <span class="header-expires">EXPIRES</span>
            </div>
            <div class="cookie-list-container">
              <div class="table-body">${site.cookies.map(renderCookie).join('')}</div>
            </div>
            <p class="list-state list-state--error" data-vault-error hidden></p>
          </div>
        </section>

        <section class="detail-card profile-card">
          <header class="card-header">
            <span class="mono-label">SITE PROFILE</span>
          </header>

          <div class="profile-grid">
            <div class="profile-row">
              <span class="profile-label">Cookies</span>
              <span class="profile-value">${site.cookies.length}</span>
            </div>
            <div class="profile-row">
              <span class="profile-label">Secure</span>
              <span class="profile-value">${secureCount} / ${site.cookies.length}</span>
            </div>
            <div class="profile-row">
              <span class="profile-label">HttpOnly</span>
              <span class="profile-value">${httpOnlyCount} / ${site.cookies.length}</span>
            </div>
            <div class="profile-row">
              <span class="profile-label">Security</span>
              <span class="profile-value status-green">${PLACEHOLDER_SECURITY}</span>
            </div>
            <div class="profile-row">
              <span class="profile-label">Safety Score</span>
              <span class="profile-value score-badge">${PLACEHOLDER_SAFETY_SCORE} / 100</span>
            </div>
          </div>
        </section>
      </div>
    `;

    const overlay = existingOverlay ?? openOverlay(content);
    if (existingOverlay) existingOverlay.element.innerHTML = content;

    if (!overlay) return null;
    const closeButton = overlay.element.querySelector<HTMLButtonElement>('[data-action="close-details"]');
    closeButton?.addEventListener('click', () => {
        overlay.close();
        void refreshSite();
    });

    // Attach to the replaced content so refreshes do not accumulate click handlers.
    overlay.element.querySelector('.site-details-view')?.addEventListener('click', async (event) => {
        const button = (event.target as Element).closest<HTMLButtonElement>('[data-action="edit-cookie"], [data-action="lock-cookie"], [data-action="delete-cookie"]');
        if (!button) return;

        const row = button.closest<HTMLElement>('.cookie-row');
        if (!row) return;

        const cookie = site.cookies[Number(row.dataset.cookieIndex)];
        if (!cookie) return;

        if (button.dataset.action === 'edit-cookie') {
            openCookieEdit(cookie, async () => {await renderSelf();});
            return;
        }

        button.disabled = true;
        const errorEl = overlay.element.querySelector<HTMLElement>('[data-vault-error]');
        if (errorEl) errorEl.hidden = true;

        try {
            if (button.dataset.action === 'delete-cookie') {
                await deleteSpecificCookie(cookie);
                //await renderSelf();
            } else {
                await moveCookie(cookie);
            }
            await renderSelf();
        } catch (error) {
            button.disabled = false;
            if (errorEl) {
                errorEl.textContent = error instanceof Error ? error.message : 'Unable to move the cookie.';
                errorEl.hidden = false;
            }
        }
    });

    return overlay;
}
