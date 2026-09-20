import { getSiteProfile, hasSiteProfileData } from './site_settings';

export interface SiteListContext {
    safe: boolean;
    isVaulted: boolean;
}

export function renderSiteInfo(
    domain: string,
    onBack: () => void,
    context?: SiteListContext,
) {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    const profile = getSiteProfile(domain);
    const hasData = hasSiteProfileData(domain);
    const safe = context?.safe ?? true;
    const isVaulted = context?.isVaulted ?? false;

    const statusLabel = safe ? 'No issues flagged' : 'Flagged for review';
    const statusClass = safe ? 'status-green' : 'status-red';

    appContainer.innerHTML = `
    <div class="site-details-view site-info-view">
      <section class="detail-card info-summary-card">
        <header class="card-header">
          <div class="header-title">
            <span class="mono-label">SITE INFO —</span>
            <span class="domain-badge">${domain}</span>
          </div>
          <button type="button" class="icon-btn" data-action="close-info" title="Close">✕</button>
        </header>

        <div class="info-hero">
          <span class="status-dot ${safe ? 'safe' : 'unsafe'}"></span>
          <div class="info-hero-text">
            <p class="info-domain">${domain}</p>
            <p class="info-status ${statusClass}">${statusLabel}</p>
          </div>
        </div>

        <div class="profile-grid info-grid">
          <div class="profile-row">
            <span class="profile-label">Cookies tracked</span>
            <span class="profile-value">${hasData ? profile.cookies.length : '—'}</span>
          </div>
          <div class="profile-row">
            <span class="profile-label">Safety score</span>
            <span class="profile-value ${hasData ? 'score-badge' : ''}">${hasData ? `${profile.safetyScore} / 100` : '—'}</span>
          </div>
          <div class="profile-row">
            <span class="profile-label">Security</span>
            <span class="profile-value ${hasData ? 'status-green' : ''}">${hasData ? profile.securityStatus : 'No data yet'}</span>
          </div>
          <div class="profile-row">
            <span class="profile-label">Vault status</span>
            <span class="profile-value">${isVaulted ? 'Vaulted' : 'Not vaulted'}</span>
          </div>
          <div class="profile-row">
            <span class="profile-label">Duration</span>
            <span class="profile-value">${hasData ? profile.duration : '—'}</span>
          </div>
          <div class="profile-row">
            <span class="profile-label">Permissions</span>
            <span class="profile-value">${hasData ? profile.permissions : '—'}</span>
          </div>
        </div>

        <p class="info-footnote">Read-only summary. Use settings to manage cookies for this site.</p>
      </section>
    </div>
  `;

    appContainer.querySelector('[data-action="close-info"]')?.addEventListener('click', onBack);
}
