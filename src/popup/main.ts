import './style.scss';
import { getCookieSites, type CookieSite } from './cookie_data';
import { escapeHtml } from './cookie_format';
import { renderSettings } from './main_settings';
import { renderSiteDetails } from './site_settings';

let sites: CookieSite[] = [];
let isLoading = true;
let loadError: string | null = null;

async function renderSiteList() {
    const container = document.getElementById('site-list');
    if (!container) return;

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

    if (isLoading) {
        container.innerHTML = '<p class="list-state">Reading browser cookies…</p>';
        return;
    }

    if (loadError) {
        container.innerHTML = `<p class="list-state list-state--error">${escapeHtml(loadError)}</p>`;
        return;
    }

    const filterText = searchInput?.value.toLowerCase() || '';
    const showVaulted = vaultCheck?.checked ?? true;
    const showUnvaulted = unvaultCheck?.checked ?? true;
    const filteredSites = sites.filter(site => {
        const matchesText = site.domain.toLowerCase().includes(filterText);
        const matchesCategory = (site.isVaulted && showVaulted) || (!site.isVaulted && showUnvaulted);
        return matchesText && matchesCategory;
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

        card.innerHTML = `
          <div class="site-info">
            <span class="status-dot status-dot--${site.allSecure ? 'safe' : 'unsafe'}"
              title="${secureStatus}"></span>
            <span class="site-name" title="${domain}">${domain}</span>
            <span class="site-cookie-count">${site.cookies.length}</span>
          </div>

          <div class="button-group">
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

    container.querySelectorAll('[data-action="settings-site"]').forEach(button => {
        button.addEventListener('click', event => {
            const domain = (event.currentTarget as HTMLButtonElement).dataset.site;
            const site = sites.find(candidate => candidate.domain === domain);
            if (site) renderSiteDetails(site);
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
        sites = await getCookieSites();
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
    document.getElementById('settings-btn')?.addEventListener('click', renderSettings);
}

document.addEventListener('DOMContentLoaded', () => {
    bindHomeEventListeners();
    void loadCookies();
});
