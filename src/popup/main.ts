import './style.scss';

interface SiteInfo {
    name: string;
    safe: boolean;
}

// 9/17: Temporary hardcoded list of websites
const SITES: SiteInfo[] = [
    { name: "google.com", safe: true },
    { name: "github.com", safe: true },
    { name: "Suspicious.org", safe: false },
    { name: "evil_ram.net", safe: false },
    { name: "Testing scrollbar 1", safe: true },
    { name: "Testing scrollbar 2", safe: true },
    { name: "Testing scrollbar 3", safe: true },
    { name: "Testing scrollbar 4", safe: true },
    { name: "Sneaky Trojan", safe: true },
    { name: "Testing scrollbar 5", safe: true },
    { name: "Testing scrollbar 6", safe: true },
    { name: "Zac needs Sleep badly", safe: true }
];

function renderSiteList(filterText = '') {
    const container = document.getElementById('site-list');
    if (!container) return;

    container.innerHTML = '';

    const filtered = SITES.filter(site =>
        site.name.toLowerCase().includes(filterText.toLowerCase())
    );

    filtered.forEach(site => {
        const card = document.createElement('div');
        card.className = 'site-card';

        // Green = no issues found from website's cookies. Red = flagged
        // 9/17: We may want to do a spectrum (i.e. add Yellow if there's minor concerns)
        const dotColor = site.safe ? 'var(--accent-green)' : 'var(--accent-red)';

        card.innerHTML = `
      <div class="site-info">
        <span class="status-dot" style="background-color: ${dotColor}"></span>
        <span class="site-name">${site.name}</span>
      </div>
      
      <!-- Buttons to the right of each website (info, settings, vault) -->
      <div class="action-group">
        <!-- Info -->
        <button class="icon-btn info-btn" title="Site Info" data-site="${site.name}">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.4" />
            <path d="M8 7v5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            <circle cx="8" cy="5" r="0.8" fill="currentColor" />
          </svg>
        </button>

        <!-- Vault/Unvault -->
        <button class="icon-btn vault-btn" title="Vault Cookies" data-site="${site.name}">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <rect x="2" y="5.5" width="9" height="7" rx="1.5" stroke="currentColor" stroke-width="1.2" />
            <path d="M4 5.5V4a2.5 2.5 0 0 1 5 0v1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          </svg>
        </button>

        <!-- Settings -->
        <button class="icon-btn settings-btn" title="Site Settings" data-site="${site.name}">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <mask id="gear-bore">
              <rect width="16" height="16" fill="white" />
              <circle cx="8" cy="8" r="2.25" fill="black" />
            </mask>
            <g mask="url(#gear-bore)">
              <circle cx="8" cy="8" r="5.25" />
              <rect x="6.6" y="1" width="2.8" height="14" rx="0.9" />
              <rect x="1" y="6.6" width="14" height="2.8" rx="0.9" />
              <rect x="6.6" y="1" width="2.8" height="14" rx="0.9" transform="rotate(45 8 8)" />
              <rect x="6.6" y="1" width="2.8" height="14" rx="0.9" transform="rotate(-45 8 8)" />
            </g>
          </svg>
        </button>
      </div>
    `;

        container.appendChild(card);
    });
}

// Search Bar
document.addEventListener('DOMContentLoaded', () => {
    renderSiteList();

    const searchInput = document.getElementById('site-search') as HTMLInputElement;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            renderSiteList(target.value);
        });
    }
});