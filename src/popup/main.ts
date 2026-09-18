import './style.scss';

interface SiteInfo {
    name: string;
    safe: boolean;
    isVaulted: boolean;
}

// 9/17: Temporary hardcoded list of websites
const SITES: SiteInfo[] = [
    { name: "google.com", safe: true, isVaulted: false },
    { name: "github.com", safe: true, isVaulted: false },
    { name: "Suspicious.org", safe: false, isVaulted: false },
    { name: "evil_ram.net", safe: false, isVaulted: false },
    { name: "Testing scrollbar 1", safe: true, isVaulted: true },
    { name: "Testing scrollbar 2", safe: true, isVaulted: true },
    { name: "Testing scrollbar 3", safe: true, isVaulted: false },
    { name: "Testing scrollbar 4", safe: true, isVaulted: false },
    { name: "Sneaky Trojan", safe: true, isVaulted: false },
    { name: "Testing scrollbar 5", safe: true, isVaulted: false },
    { name: "Long name aaaaaaaaaaaaaaaaaaaaaaaaa", safe: true, isVaulted: false },
    { name: "Zac needs Sleep badly", safe: true, isVaulted: true }
];

function renderSiteList() {

    // Get site list, search bar, and vault/unvault filter values
    const container = document.getElementById('site-list');
    const searchInput = document.getElementById('site-search') as HTMLInputElement;
    const vaultCheck = document.getElementById('filter-vaulted') as HTMLInputElement;
    const unvaultCheck = document.getElementById('filter-unvaulted') as HTMLInputElement;

    if (!container) return;

    // Turn the searchbar and filters into usable input.
    const filterText = searchInput?.value.toLowerCase() || '';
    const showVaulted = vaultCheck ? vaultCheck.checked : true;
    const showUnvaulted = vaultCheck ? unvaultCheck.checked : true;

    container.innerHTML = '';

    // List filter
    const filtered = SITES.filter(site => {
        const matchesText = site.name.toLowerCase().includes(filterText);
        const matchesCategory = (site.isVaulted && showVaulted) || (!site.isVaulted && showUnvaulted);
        return matchesText && matchesCategory;
    });

    // Iterate each filtered site for it' icons (status, name, info, settings, vault)
    filtered.forEach(site => {
        const card = document.createElement('div');
        card.className = 'site-card';

        // Green = no issues found from website's cookies. Red = flagged
        // 9/17: We may want to do a spectrum (i.e. add Yellow if there's minor concerns).
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
        
        <!-- Vault/Unvault -->
        <button class="icon-btn vault-btn ${site.isVaulted ? 'active' : ''}" title="Vault Cookies" data-site="${site.name}">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <rect x="2" y="5.5" width="9" height="7" rx="1.5" stroke="currentColor" stroke-width="1.2" />
            <path d="M4 5.5V4a2.5 2.5 0 0 1 5 0v1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    `;

        container.appendChild(card);
    });

    // Update vault button on click
    container.querySelectorAll('.vault-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const button = e.currentTarget as HTMLButtonElement;
            const domain = button.getAttribute('data-site');
            const siteObj = SITES.find(s => s.name === domain);

            if (siteObj) {
                siteObj.isVaulted = !siteObj.isVaulted;
                renderSiteList();
            }
        })
    })
}

// Search Bar
document.addEventListener('DOMContentLoaded', () => {
    renderSiteList();

    const searchInput = document.getElementById('site-search');
    const vaultedCheck = document.getElementById('filter-vaulted');
    const unvaultedCheck = document.getElementById('filter-unvaulted');

    searchInput?.addEventListener('input', () => renderSiteList());
    vaultedCheck?.addEventListener('change', () => renderSiteList());
    unvaultedCheck?.addEventListener('change', () => renderSiteList());
});