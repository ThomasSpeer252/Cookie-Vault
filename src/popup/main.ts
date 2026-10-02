import './style.scss';
import { getCookieSites, type CookieSite } from './cookie_data';
import { escapeHtml } from './cookie_format';
import { getSettings, renderSettings } from './main_settings';
import { closeAllOverlays, type OverlayHandle } from './overlay';
import { renderSiteDetails } from './site_settings';
import { CookieDatabase, type SiteProfile } from '../db/CookieDatabase';
import { applyTheme } from './theme';
import { deleteSpecificCookie } from './cookie_actions';


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
            await loadCookies(),
            await openSiteDetailsForDomain(domain, detailsOverlay ?? undefined);
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
    const vaultCheck = document.getElementById('filter-vaulted') as HTMLInputElement;
    const unvaultCheck = document.getElementById('filter-unvaulted') as HTMLInputElement;
    const statusSafe = document.getElementById('filter-safe') as HTMLInputElement;
    const statusFlagged = document.getElementById('filter-flagged') as HTMLInputElement;


    if (isLoading) {
        container.innerHTML = '<p class="list-state">Reading browser cookies…</p>';
        return;
    }

    const filterText = searchInput?.value.toLowerCase() || '';
    const showVaulted = vaultCheck?.checked ?? true;
    const showUnvaulted = unvaultCheck?.checked ?? true;
    const showSafe = statusSafe?.checked ?? true;
    const showFlagged = statusFlagged.checked ?? true;

    const filteredSites = sites.filter(site => {
        const matchesText = site.domain.toLowerCase().includes(filterText);
        const matchesCategory = (showVaulted && site.cookies.some(cookie => cookie.isVaulted))
            || (showUnvaulted && site.cookies.some(cookie => !cookie.isVaulted));
        const matchesStatus = (site.allSecure && showSafe) || (!site.allSecure && showFlagged);
        return matchesText && matchesCategory && matchesStatus;
    }).sort((a, b) => Number(b.isPinned) - Number(a.isPinned));

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
                await Promise.all(site.cookies.map(cookie => deleteSpecificCookie(cookie)));
                await loadCookies();
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
                Click Here to Grant Cookie Access
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

function bindHomeEventListeners() {
    document.getElementById('site-search')?.addEventListener('input', renderSiteList);
    document.getElementById('filter-vaulted')?.addEventListener('change', renderSiteList);
    document.getElementById('filter-unvaulted')?.addEventListener('change', renderSiteList);
    document.getElementById('filter-safe')?.addEventListener('change', renderSiteList);
    document.getElementById('filter-flagged')?.addEventListener('change', renderSiteList);
    document.getElementById('settings-btn')?.addEventListener('click', renderSettings);
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
