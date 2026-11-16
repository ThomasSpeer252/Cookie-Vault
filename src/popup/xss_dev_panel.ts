import {
    XSS_MSG_GET_OBSERVATIONS_FOR_TAB,
    type XssOutboundObservation,
} from '../xss/XssExfilStore';
import { escapeHtml } from './cookie_format';
import { closeAllOverlays, openOverlay } from './overlay';

const POLL_MS = 800;

function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
}

function renderRow(obs: XssOutboundObservation): string {
    const thirdParty = obs.isThirdParty
        ? '<span class="xss-tag xss-tag--warn">3rd party</span>'
        : '<span class="xss-tag">1st party</span>';
    const typeLabel = obs.resourceType
        ? `<span class="xss-tag xss-tag--type">${escapeHtml(obs.resourceType)}</span>`
        : '';

    return `
      <li class="xss-row">
        <div class="xss-row__meta">
          <span class="xss-row__source">${escapeHtml(obs.source)}</span>
          <span class="xss-row__method">${escapeHtml(obs.method)}</span>
          ${typeLabel}
          ${thirdParty}
          <span class="xss-row__time">${escapeHtml(formatTime(obs.timestamp))}</span>
        </div>
        <div class="xss-row__url" title="${escapeHtml(obs.requestUrl)}">${escapeHtml(obs.requestUrl)}</div>
        ${obs.bodyPreview
        ? `<div class="xss-row__body">${escapeHtml(obs.bodyPreview)}</div>`
        : ''}
      </li>
    `;
}

async function getActiveTabId(): Promise<number | null> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0]?.id ?? null;
}

async function fetchObservationsForTab(tabId: number): Promise<XssOutboundObservation[]> {
    try {
        const response = await chrome.runtime.sendMessage({
            type: XSS_MSG_GET_OBSERVATIONS_FOR_TAB,
            tabId,
            limit: 100,
        });
        return response?.observations ?? [];
    } catch {
        return [];
    }
}

function renderList(root: HTMLElement, observations: XssOutboundObservation[], tabLabel: string) {
    const list = root.querySelector<HTMLElement>('#xss-dev-list');
    const tabEl = root.querySelector<HTMLElement>('#xss-dev-tab');
    if (!list || !tabEl) return;

    tabEl.textContent = tabLabel;
    list.innerHTML = observations.map(renderRow).join('');
}

export function renderXssDevPanel() {
    closeAllOverlays();

    const overlay = openOverlay(`
    <div class="site-details-view xss-dev-view">
      <section class="detail-card">
        <header class="card-header">
          <div class="header-title">
            <span class="mono-label">XSS DEV</span>
            <span class="domain-badge" id="xss-dev-tab">—</span>
          </div>
          <button type="button" class="icon-btn" data-action="close-xss-dev" title="Close">✕</button>
        </header>
        <div class="xss-dev-body">
          <ul id="xss-dev-list" class="xss-dev-list"></ul>
        </div>
      </section>
    </div>
  `);

    if (!overlay) return;

    const refresh = async () => {
        const tabId = await getActiveTabId();
        if (tabId === null) {
            renderList(overlay.element, [], '—');
            return;
        }

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        let tabLabel = '—';
        if (tab?.url) {
            try {
                tabLabel = new URL(tab.url).hostname;
            } catch {
                tabLabel = tab.url.slice(0, 48);
            }
        }

        const observations = await fetchObservationsForTab(tabId);
        renderList(overlay.element, observations, tabLabel);
    };

    void refresh();
    const pollId = window.setInterval(() => {
        if (!overlay.element.isConnected) {
            window.clearInterval(pollId);
            return;
        }
        void refresh();
    }, POLL_MS);

    const closeButton = overlay.element.querySelector<HTMLButtonElement>('[data-action="close-xss-dev"]');
    closeButton?.addEventListener('click', overlay.close);
    closeButton?.focus();
}
