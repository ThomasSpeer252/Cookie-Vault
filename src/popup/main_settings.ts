// Main panel: General settings
export interface Settings {
    // TODO: replace with actual app-level settings fields
    // Extension Active
    // Auto-Delete
    // Auto-Vault
    // Dark Mode
    // Operation Log
    // Unvault Everything

}

// TODO: needs chrome.storage read for persistence/allowing user to save settings
function getSettings(): Settings {
    // placeholder defaults
    return {}
}

// TODO: needs chrome.storage write
function saveSettings(settings: Settings) {
}

export function renderSettings(onBack: () => void) {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    const settings = getSettings();

    appContainer.innerHTML = `
    <div class="site-details-view settings-view">
      <section class="detail-card settings-card">
        <header class="card-header">
          <div class="header-title">
            <span class="mono-label">SETTINGS</span>
          </div>          
          <button class="icon-btn" data-action="close-settings" title="Close">✕</button>
        </header>

        <div class="settings-grid info-grid">
          <div class="settings-row">
            <div class="settings-info">
                <span class="settings-label">Extension Active</span>
                <span class="settings-minor">Enable cookie monitoring</span>
            </div>
            <label class="switch">
              <input type="checkbox">
              <span class="slider round"></span>
            </label>
          </div>

          <div class="settings-row">
            <div class="settings-info">
                <span class="settings-label">Auto-Delete</span>
                <span class="settings-minor">Delete risky cookies automatically</span>
            </div>
            <label class="switch">
              <input type="checkbox">
              <span class="slider round"></span>
            </label>
          </div>
          
          <div class="settings-row">
            <div class="settings-info">
                <span class="settings-label">Auto-Vault</span>
                <span class="settings-minor">Vault new cookies from safe sites</span>
            </div>
            <label class="switch">
              <input type="checkbox">
              <span class="slider round"></span>
            </label>
          </div>

          <div class="settings-row">
            <div class="settings-info">
                <span class="settings-label">Dark Mode</span>
                <span class="settings-minor">Toggle light/dark interface</span>
            </div>
            <label class="switch">
              <input type="checkbox">
              <span class="slider round"></span>
            </label>
          </div>

          <div class="settings-row">
            <div class="settings-info">
                <span class="settings-label">Operation Log</span>
                <span class="settings-minor">Activity history and alerts</span>
            </div>
            <button class="settings-view-btn">☱ View</button>
          </div>

          <button class="unvault-all-btn">Unvault Everything </button>

        </div>
      </section>
    </div>
  `;

    appContainer.querySelector('[data-action="close-settings"]')?.addEventListener('click', onBack);

    // TODO: bind listeners for individual controls and persist their values.
}
