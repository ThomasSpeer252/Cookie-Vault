import './style.scss';
import { getCookieSites, type CookieSite } from './cookie_data';
import { escapeHtml } from './cookie_format';
import { getSettings, renderSettings } from './main_settings';
import { closeAllOverlays, type OverlayHandle } from './overlay';
import { renderSiteDetails } from './site_settings';
import { CookieDatabase, type SiteProfile } from '../db/CookieDatabase';
import { applyTheme } from './theme';
import { deleteSpecificCookie } from './cookie_actions';
import { recordOperation } from "./operation_log";

let sites: CookieSite[] = [];
let isLoading = true;
let loadError: string | null = null;

async function loadSites(): Promise<CookieSite[]> {
    const [cookieSites, profiles] = await Promise.all([
        getCookieSites(),
        CookieDatabase.getInstance().getAllSiteProfiles(),
    ]);
    const pinnedByDomain = new Map(profiles.map(profile => [profile.domain, profile.isPinned]));
    return cookieSites.map(site => ({
        ...site,
        isPinned: pinnedByDomain.get(site.domain) ?? false,
    }));
}

async function openSiteDetailsForDomain(domain: string, overlay?: OverlayHandle): Promise<void> {
    try {
        sites = await loadSites();
        void renderSiteList();  // re-render site list, ensures most up-to-date version of list if a user clicks 'unvault all'
    } catch (error) {
        if (overlay) throw error;
        loadError = error instanceof Error ? error.message : 'Unable to read browser cookies.';
        void renderSiteList();
        return;
    }

    const site = sites.find((candidate) => candidate.domain === domain);
    if (!site) {
        overlay?.close();
        return;
    }

    if (!overlay) closeAllOverlays();
    let detailsOverlay: OverlayHandle | null = overlay ?? null;
    detailsOverlay = renderSiteDetails(
        site,
        async () => {
            await updateSiteCard(domain);
        },
        overlay,
    );
}

async function renderSiteList() {
    const container = document.getElementById('site-list');
    if (!container) return;

    if (loadError) {
        container.innerHTML = `<p class="list-state list-state--error">${escapeHtml(loadError)}</p>`;
        return;
    }

    // Check for permissions to view sites/cookies. Prompt if needed
    const hasPermission = await chrome.permissions.contains({permissions: ['cookies'], origins: ['<all_urls>']});

    if (!hasPermission) {
        isLoading = false;
        renderPermissionPrompt();
        return;
    }

    const searchInput = document.getElementById('site-search') as HTMLInputElement;
    const filterUnflagged = document.getElementById('filter-unflagged') as HTMLInputElement;
    const filterFlagged = document.getElementById('filter-flagged') as HTMLInputElement;


    if (isLoading) {
        container.innerHTML = '<p class="list-state">Reading browser cookies…</p>';
        return;
    }

    const filterText = searchInput?.value.toLowerCase() || '';
    const isUnflagged = filterUnflagged?.checked ?? true;
    const isFlagged = filterFlagged.checked ?? true;

    const filteredSites = sites.filter(site => {
        const matchesText = site.domain.toLowerCase().includes(filterText);
        let matchesFilter = true;
        if (isUnflagged) {
            matchesFilter = site.allSecure;
        } else if (isFlagged) {
            matchesFilter = !site.allSecure;
        }
        return matchesText && matchesFilter
    }).sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
            return Number(b.isPinned) - Number(a.isPinned);
        }
        const aVaulted = a.cookies.some(cookie => cookie.isVaulted);
        const bVaulted = b.cookies.some(cookie => cookie.isVaulted);
        if (aVaulted !== bVaulted) {
            return Number(bVaulted) - Number(aVaulted);
        }
        return 0;
    });

    if (filteredSites.length === 0) {
        container.innerHTML = `<p class="list-state">${sites.length === 0
            ? 'No browser cookies found.'
            : 'No domains match the current filters.'}</p>`;
        return;
    }

    container.innerHTML = '';

    for (const [index, site] of filteredSites.entries()) {
        const card = document.createElement('div');
        card.className = 'site-card';
        const secureStatus = site.allSecure
            ? 'All cookies have the Secure flag'
            : 'Contains cookies without the Secure flag';
        const domain = escapeHtml(site.domain);
        const pinned = site.isPinned;
        const vaultedCount = site.cookies.filter(cookie => cookie.isVaulted).length;

        card.innerHTML = `
          <div class="site-info">
            <span class="status-dot status-dot--${site.allSecure ? 'safe' : 'unsafe'}"
              title="${secureStatus}"></span>
            <span class="site-name" title="${domain}">${domain}</span>
            <span class="site-cookie-count">${site.cookies.length}</span>
            ${vaultedCount > 0 ? `<span class="site-cookie-count site-cookie-count--vaulted" title="Vaulted cookies for this site" aria-label="${vaultedCount} vaulted cookies">${vaultedCount}</span>` : ''}
          </div>

          <div class="button-group">
            <button type="button" class="icon-btn${pinned ? ' icon-btn--amber' : ''}" data-action="pin-site"
              title="${pinned ? 'Unpin Site' : 'Pin Site'}" data-site="${domain}">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 2.5a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5H10.5v3.636l1.205 1.808A.75.75 0 0 1 11.08 10H8.75v3.75a.75.75 0 0 1-1.5 0V10H4.92a.75.75 0 0 1-.624-1.166L5.5 7.026V3.25H4.75A.75.75 0 0 1 4 2.5Z"/>
  </svg>
            </button>
            
            <button type="button" class="icon-btn" data-action="settings-site"
              title="Site Cookies" data-site="${domain}">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <mask id="gear-bore-${index}">
                  <rect width="16" height="16" fill="white" />
                  <circle cx="8" cy="8" r="2.25" fill="black" />
                </mask>
                <g mask="url(#gear-bore-${index})">
                  <circle cx="8" cy="8" r="5.25" />
                  <rect x="6.6" y="1" width="2.8" height="14" rx="0.9" />
                  <rect x="1" y="6.6" width="14" height="2.8" rx="0.9" />
                  <rect x="6.6" y="1" width="2.8" height="14" rx="0.9" transform="rotate(45 8 8)" />
                  <rect x="6.6" y="1" width="2.8" height="14" rx="0.9" transform="rotate(-45 8 8)" />
                </g>
              </svg>
            </button>

            <button type="button" class="icon-btn" data-action="delete-site"
              title="Delete Site Cookies" data-site="${domain}">
              <svg width="14" height="14" viewBox="0 0 13 13" fill="none">
                <path d="M2 3.5h9M5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M10 3.5l-.6 7a.5.5 0 0 1-.5.5H4.1a.5.5 0 0 1-.5-.5l-.6-7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </button>
          </div>
        `;

        container.appendChild(card);
    }

    container.querySelectorAll<HTMLButtonElement>('[data-action="pin-site"]').forEach(button => {
        button.addEventListener('click', async event => {
            const pinButton = event.currentTarget as HTMLButtonElement;
            const domain = pinButton.dataset.site;
            const site = sites.find(candidate => candidate.domain === domain);
            if (!site) return;

            pinButton.disabled = true;
            try {
                const db = CookieDatabase.getInstance();
                const existingProfile = await db.getSiteProfile(site.domain);
                const profile: SiteProfile = existingProfile ?? {
                    domain: site.domain,
                    durationStartAt: null,
                    safetyScore: null,
                    securityFlags: [],
                    permissions: [],
                    isFlagged: false,
                    isPinned: false,
                };
                await db.upsertSiteProfile({ ...profile, isPinned: !site.isPinned });
                site.isPinned = !site.isPinned;
                await renderSiteList();
            } catch (error) {
                pinButton.disabled = false;
                pinButton.title = error instanceof Error ? error.message : 'Unable to save pin state.';
            }
        });
    });

    container.querySelectorAll('[data-action="settings-site"]').forEach(button => {
        button.addEventListener('click', event => {
            const domainAttr = (event.currentTarget as HTMLButtonElement).dataset.site;
            const site = sites.find((candidate) =>
                candidate.domain === domainAttr
                || escapeHtml(candidate.domain) === domainAttr);
            if (site) void openSiteDetailsForDomain(site.domain);
        });
    });

    container.querySelectorAll('[data-action="delete-site"]').forEach(button => {
        button.addEventListener('click', async event => {
            const deleteButton = event.currentTarget as HTMLButtonElement;
            const domain = deleteButton.dataset.site;
            const site = sites.find(candidate => candidate.domain === domain);
            if (!site) return;

            deleteButton.disabled = true;

            try {
                await Promise.all(site.cookies.map(cookie => recordOperation("DELETE", `${cookie.name} deleted`, cookie.domain)));
                await Promise.all(site.cookies.map(cookie => deleteSpecificCookie(cookie)));
                await updateSiteCard(domain);
            } catch (error) {
                deleteButton.disabled = false;
                loadError = error instanceof Error ? error.message : 'Unable to delete site cookies.';
            }
        });

    });
}

function renderPermissionPrompt() {
    const container = document.getElementById('site-list');
    if (!container) return;

    container.innerHTML = `
        <div class="permission-prompt">
            <p class="list-state">Cookie access permissions are required for the extension.</p>
            <button type="button" id="grant-cookies-btn" class="grant-cookie-btn">
                Click to Grant<br>
                Site-List & Cookie Access
            </button>
        </div>
    `;

    document.getElementById('grant-cookies-btn')?.addEventListener('click', async () => {
        const granted = await chrome.permissions.request({
            permissions: ['cookies'],
            origins: ['<all_urls>']
        });

        if (granted) {void loadCookies();}
    });
}

async function loadCookies() {
    isLoading = true;
    loadError = null;

    // Check for permissions to view sites/cookies. Prompt if needed
    const hasPermission = await chrome.permissions.contains({permissions: ['cookies'], origins: ['<all_urls>']});

    if (!hasPermission) {
        isLoading = false;
        renderPermissionPrompt();
        return;
    }

    // Continue to render sites if permissions apply
    renderSiteList();

    try {
        sites = await loadSites();
    } catch (error) {
        loadError = error instanceof Error ? error.message : 'Unable to read browser cookies.';
    } finally {
        isLoading = false;
        renderSiteList();
    }
}

export async function updateSiteCard(domain: string): Promise<void> {
    const freshSites = await loadSites();
    const freshSite = freshSites.find(s => s.domain === domain);

    if (freshSite && freshSite.cookies.length > 0) {
        const index = sites.findIndex(s => s.domain === domain);
        if (index !== -1) {
            sites[index] = freshSite;
        }
    } else {
        sites = sites.filter(s => s.domain !== domain);
    }

    const deleteBtn = document.querySelector<HTMLButtonElement>(`[data-action="delete-site"][data-site="${CSS.escape(domain)}"]`);
    const card = deleteBtn?.closest<HTMLElement>('.site-card');

    // Delete card if site has no cookies
    if (!freshSite || freshSite.cookies.length === 0) {
        card?.remove();

        // If every single cookie is deleted, we need the 'no results' message
        const container = document.getElementById('site-list');
        if (container && container.children.length === 0) {
            await renderSiteList();
        }
        return;
    }

    // Otherwise, update site card

    if (card) {
        const statusDot = card.querySelector<HTMLElement>('.status-dot');
        const cookieCount = card.querySelector<HTMLElement>('.site-cookie-count');
        const vaultedBadge = card.querySelector<HTMLElement>('.site-cookie-count--vaulted');

        // We plan on changing how status dot works later. Make sure to update
        if (statusDot) {
            statusDot.className = `status-dot status-dot--${freshSite.allSecure ? 'safe' : 'unsafe'}`;
            statusDot.title = freshSite.allSecure
                ? 'All cookies have the Secure flag'
                : 'Contains cookies without the Secure flag';
        }

        if (cookieCount) {
            cookieCount.textContent = String(freshSite.cookies.length);
        }

        const vaultedCount = freshSite.cookies.filter(c => c.isVaulted).length;
        if (vaultedCount > 0) {
            if (vaultedBadge) {
                vaultedBadge.textContent = String(vaultedCount);
            } else {
                const infoContainer = card.querySelector('.site-info');
                if (infoContainer) {
                    const badge = document.createElement('span');
                    badge.className = 'site-cookie-count site-cookie-count--vaulted';
                    badge.title = 'Vaulted cookies for this site';
                    badge.setAttribute('aria-label', `${vaultedCount} vaulted cookies`);
                    badge.textContent = String(vaultedCount);
                    infoContainer.appendChild(badge);
                }
            }
        } else {
            vaultedBadge?.remove();
        }
    }
}

function bindHomeEventListeners() {
    document.getElementById('site-search')?.addEventListener('input', renderSiteList);
    document.getElementById('filter-unflagged')?.addEventListener('change', renderSiteList);
    document.getElementById('filter-flagged')?.addEventListener('change', renderSiteList);
    document.getElementById('filter-both')?.addEventListener('change', renderSiteList);
    document.getElementById('settings-btn')?.addEventListener('click', () => void renderSettings(loadCookies));
}

document.addEventListener('DOMContentLoaded', async () => {
    const settings = await getSettings();
    applyTheme(settings.darkMode);
    bindHomeEventListeners();
    try {
        await CookieDatabase.getInstance().init();
    } catch (error) {
        isLoading = false;
        loadError = error instanceof Error ? error.message : 'Unable to open the cookie vault.';
        await renderSiteList();
        return;
    }
    void loadCookies();
});
