import { openOverlay } from './overlay';

const DEFAULT_SETTINGS: Settings = {
  active: true,
  autoDel: false,
  autoVault: false,
  darkMode: true
}

export interface Settings {
  active: Boolean;
  autoDel: Boolean;
  autoVault: Boolean;
  darkMode: Boolean;
}

async function getSettings(): Promise<Settings> {
  // No promise wrapper because chrome API handles that on its own
  return chrome.storage.sync.get(DEFAULT_SETTINGS);
}

async function saveSettings(settings: Settings) {
  chrome.storage.sync.set(settings)
}

// TODO Connect storage and render
export async function renderSettings() {
    await getSettings();

    const overlay = openOverlay(`
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

          <!-- TODO: Operation log should open a new page on the extension and show a read-only log of cookie usage -->
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
  `);

    if (!overlay) return;
    const closeButton = overlay.element.querySelector<HTMLButtonElement>('[data-action="close-settings"]');
    closeButton?.addEventListener('click', overlay.close);
    closeButton?.focus();

    // TODO: bind listeners for individual controls and persist their values.
}
