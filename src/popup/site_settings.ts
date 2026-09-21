import type { CookieSite } from './cookie_data';
import { escapeHtml, formatCookieExpiration, getCookieFlags } from './cookie_format';

const PLACEHOLDER_SECURITY = 'No Concerns Found';
const PLACEHOLDER_SAFETY_SCORE = 94;

function renderCookie(cookie: chrome.cookies.Cookie): string {
    const flags = getCookieFlags(cookie)
        .map(flag => `<span class="flag-badge flag-badge--${flag.kind}">${flag.label}</span>`)
        .join('');
    const expiration = formatCookieExpiration(cookie);
    const name = cookie.name || '(unnamed)';

    return `
      <div class="cookie-row">
        <div class="cookie-meta">
          <span class="cookie-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
          <div class="flag-badges">${flags}</div>
        </div>
        <span class="cookie-expires" title="${escapeHtml(expiration.title)}">${escapeHtml(expiration.label)}</span>
        <div class="button-group" data-density="compact">
          <button type="button" class="icon-btn" data-action="lock-cookie" title="Vault Cookie">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="7" width="10" height="7" rx="1.5"/>
              <path d="M5 7V4.5a3 3 0 0 1 6 0V7"/>
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

export function renderSiteDetails(site: CookieSite, onBack: () => void) {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    const secureCount = site.cookies.filter(cookie => cookie.secure).length;
    const httpOnlyCount = site.cookies.filter(cookie => cookie.httpOnly).length;

    /*
    const sessionCount = site.cookies.filter(cookie => cookie.session).length;
    const partitionedCount = site.cookies.filter(cookie => cookie.partitionKey).length;

    const extendedSiteData = `
      <div class="profile-row">
        <span class="profile-label">Session</span>
        <span class="profile-value">${sessionCount} / ${site.cookies.length}</span>
      </div>
      <div class="profile-row">
        <span class="profile-label">Partitioned</span>
        <span class="profile-value">${partitionedCount} / ${site.cookies.length}</span>
      </div>
    `;
    */

    appContainer.innerHTML = `
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

    appContainer.querySelector('[data-action="close-details"]')?.addEventListener('click', onBack);
}
