// Top panel: info of each cookie
export interface CookieInfo {
    name: string;
    flags: string[];
    expires: string;
}

// Store top panel (Cookies) and bottom panel (Site Profile)
export interface SiteProfile {
    website: string;
    duration: string;
    safetyScore: number;
    securityStatus: string;
    permissions: string;
    cookies: CookieInfo[];
}

// 9/18: Placeholder site info. Google for all popups
const tempSite: Record<string, SiteProfile> = {
    'google.com': {
        website: "google.com",
        duration: "7 days",
        safetyScore: 94,
        securityStatus: "No Concerns Found",
        permissions: "Essential cookies Only",
        cookies: [
            {name: 'session_id', flags: ['SEC', 'HTTPONLY', 'SS:S'], expires: '9/25/2026'},
            {name: 'NID', flags: ['SEC', 'HTTPONLY'], expires: '9/25/2026'},
            {name: 'Placeholder Cookie', flags: ['HTTPONLY', 'SS:N'], expires: '9/25/2026'}
        ]
    }
};

export function renderSiteDetails(domain: string, onBack: () => void) {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    // If Site Profile doesn't load, Error
    // 9:18: Placeholder for google.com works specifically. All others bring up error page
    const details = tempSite[domain] || {
        website: domain,
        duration: 'Error',
        safetyScore: 0,
        securityStatus: 'Error',
        permissions: 'Error',
        cookies: [
            { name: 'Error', flags: [], expires: '0/0/0' }
        ]
    };

    appContainer.innerHTML = `
    <div class="site-details-view">
      <!-- Cookies Section -->
      <section class="detail-card cookies-card">
        <header class="card-header">
          <div class="header-title">
            <span class="mono-label">COOKIES —</span>
            <span class="domain-badge">${details.website}</span>
          </div>
          <button id="close-details-btn" class="icon-btn close-btn" title="Close">✕</button>
        </header>

        <div class="cookies-table">
          <div class="table-header">
            <span>NAME / FLAGS</span>
            <span class="header-expires">EXPIRES</span>
            <span class="header-options">Options</span>
          </div>
            <div class="cookie-list-container">
              <div class="table-body">
                ${details.cookies.map(cookie => `
                  <div class="cookie-row">
                    <div class="cookie-meta">
                      <span class="cookie-name">${cookie.name}</span>
                      <div class="flag-badges">
                        ${cookie.flags.map(flag => `<span class="flag-badge ${flag.toLowerCase().replace(':', '-')}">${flag}</span>`).join('')}
                      </div>
                    </div>
                    <div class="cookie-actions">
                      <span class="cookie-expires">${cookie.expires}</span>
                      <div class="row-btns">
                        <button class="icon-btn row-btn" title="Lock Cookie">
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="7" width="10" height="7" rx="1.5"/>
                            <path d="M5 7V4.5a3 3 0 0 1 6 0V7"/>
                          </svg>
                        </button>
                        <button class="icon-btn row-btn" title="Edit Cookie">
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M11 2l3 3-9 9H2v-3l9-9z"/>
                          </svg>
                        </button>
                        <button class="icon-btn row-btn delete-btn" title="Delete Cookie">
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M2 4h12M5 4V2.5A.5.5 0 0 1 5.5 2h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
        </div>
      </section>

      <!-- Site Profile Section -->
      <section class="detail-card profile-card">
        <header class="card-header">
          <span class="mono-label">SITE PROFILE</span>
        </header>

        <div class="profile-grid">
          <div class="profile-row">
            <span class="profile-label">Website</span>
            <span class="profile-value">${details.website}</span>
          </div>
          <div class="profile-row">
            <span class="profile-label">Duration</span>
            <span class="profile-value">${details.duration}</span>
          </div>
          <div class="profile-row">
            <span class="profile-label">Safety Score</span>
            <span class="profile-value score-badge">${details.safetyScore} / 100</span>
          </div>
          <div class="profile-row">
            <span class="profile-label">Security</span>
            <span class="profile-value status-green">${details.securityStatus}</span>
          </div>
          <div class="profile-row">
            <span class="profile-label">Permissions</span>
            <span class="profile-value">${details.permissions}</span>
          </div>
        </div>
      </section>
    </div>
  `;

    //9/18: DIDNT FINISH YET. Back button doesn't actually undo properly yet
    document.getElementById('close-details-btn')?.addEventListener('click', onBack);
}