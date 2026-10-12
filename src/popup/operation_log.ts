import { openOverlay } from './overlay';
// import { applyTheme } from './theme';

export async function getSettings() {
  // No promise wrapper because chrome API handles that on its own
}

async function saveSettings() {
}

// TODO Connect storage and render
export async function renderLog() {
  const overlay = openOverlay(`
  <div class="site-details-view">
    <section class="detail-card">
      <header class="card-header">
        <div class="header-title">
          <span class="mono-label">OPERATION LOG</span>
        </div>          
        <button class="icon-btn" data-action="close-settings" title="Close">✕</button>
      </header>
    </section>
  </div>
`);

  if (!overlay) return;

  const closeButton = overlay.element.querySelector<HTMLButtonElement>('[data-action="close-settings"]');
  closeButton?.addEventListener('click', overlay.close);
  closeButton?.focus();
}
