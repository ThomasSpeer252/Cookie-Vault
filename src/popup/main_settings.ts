import { openOverlay } from './overlay';
import { applyTheme } from './theme';
import { renderLog } from './operation_log';
import { CookieDatabase } from '../db/CookieDatabase';
import { fromVaultCookie, type SiteCookie } from './cookie_data';
import { moveCookie } from './site_settings';

let unvaultError: string | null = null;

const DEFAULT_SETTINGS: Settings = {
  autoDel: false,
  autoVault: false,
  detectionActive: false,
  darkMode: true
}

export interface Settings {
  detectionActive: boolean;
  autoDel: boolean;
  autoVault: boolean;
  darkMode: boolean;
}

export async function getSettings(): Promise<Settings> {
  // No promise wrapper because chrome API handles that on its own
  return chrome.storage.sync.get(DEFAULT_SETTINGS) as Promise<Settings>;
}

async function saveSettings(settings: Settings) {
  chrome.storage.sync.set(settings)
}

export async function renderSettings(onVaultChanged: () => void | Promise<void>) {
  const settings = await getSettings();

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
              <span class="settings-label">Dark Mode</span>
              <span class="settings-minor">Toggle light/dark interface</span>
          </div>
          <label class="switch">
            <input type="checkbox" data-key="darkMode">
            <span class="slider round"></span>
          </label>
        </div>

        <div class="settings-row">
          <div class="settings-info">
              <span class="settings-label">Auto-Delete</span>
              <span class="settings-minor">Delete risky cookies automatically</span>
          </div>
          <label class="switch">
            <input type="checkbox" data-key="autoDel">
            <span class="slider round"></span>
          </label>
        </div>
        
        <div class="settings-row">
          <div class="settings-info">
              <span class="settings-label">Auto-Vault</span>
              <span class="settings-minor">Vault new cookies from safe sites</span>
          </div>
          <label class="switch">
            <input type="checkbox" data-key="autoVault">
            <span class="slider round"></span>
          </label>
        </div>

        <div class="settings-row">
          <div class="settings-info">
              <span class="settings-label">Detection Active</span>
              <span class="settings-minor">Enable XSS/CSRF detection (Stretch)</span>
          </div>
          <label class="switch">
            <input type="checkbox" data-key="detectionActive">
            <span class="slider round"></span>
          </label>
        </div>

        <!-- TODO: Operation log should open a new page on the extension and show a read-only log of cookie usage -->
        <div class="settings-row">
          <div class="settings-info">
              <span class="settings-label">Operation Log</span>
              <span class="settings-minor">Activity history and alerts</span>
          </div>
          <button class="settings-view-btn op-log">☱ View</button>
        </div>

        <button class="unvault-all-btn" data-action="unvault-all">Unvault Everything </button>

      </div>
    </section>
  </div>
`);

  if (!overlay) return;

  // User settings
  overlay.element.querySelectorAll<HTMLInputElement>('input[data-key]').forEach(checkbox => {
    const key = checkbox.dataset.key as keyof Settings;
    checkbox.checked = Boolean(settings[key]);
    
    checkbox.addEventListener('change', async () => {
      settings[key] = checkbox.checked;
      await saveSettings(settings);
      
      if (key === 'darkMode') {
        applyTheme(checkbox.checked);
      }
    });
  });

  // All other elements
  overlay.element.querySelector('.op-log')?.addEventListener('click', renderLog);
  
  const closeButton = overlay.element.querySelector<HTMLButtonElement>('[data-action="close-settings"]');
  closeButton?.addEventListener('click', overlay.close);
  closeButton?.focus();

  const unvaultAllButton = overlay.element.querySelector<HTMLButtonElement>('[data-action="unvault-all"]');

  unvaultAllButton?.addEventListener('click', async () => {
  unvaultAllButton.disabled = true;

    try {
      const vaulted: SiteCookie[] = CookieDatabase.getInstance().getAllCookies().map(fromVaultCookie);

      for (const cookie of vaulted) {
        await moveCookie(cookie);
      }

      // refresh sitelist to reflect database, runs loadCookies() under the hood
      await onVaultChanged();
    } catch (error) {
        if (overlay) throw error;
        unvaultError = error instanceof Error ? error.message : 'Unable to unvault everything.';
        return;
    } finally {
      unvaultAllButton.disabled = false;
    }
  });
}