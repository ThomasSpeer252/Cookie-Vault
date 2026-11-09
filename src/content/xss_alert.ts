import { t } from '../i18n';
import { XSS_TAB_ALERT, type XssTabAlertPayload } from '../xss/xss_alert_message';

const HOST_ID = 'cookie-vault-xss-host';
const DISMISS_MS = 12_000;

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

let dismissTimer = 0;

function ensureHost(): ShadowRoot | null {
    const root = document.documentElement;
    if (!root) return null;

    let host = document.getElementById(HOST_ID);
    if (!host) {
        host = document.createElement('div');
        host.id = HOST_ID;
        host.style.cssText = 'all:initial;position:fixed;top:16px;right:16px;z-index:2147483647;';
        root.appendChild(host);
        host.attachShadow({ mode: 'open' });
    }

    return host.shadowRoot;
}

function showAlert(payload: XssTabAlertPayload): void {
    const shadow = ensureHost();
    if (!shadow) return;

    const title = t('xssAlert.possibleXss');
    const detail = escapeHtml(t('xssAlert.sentTo', {
        cookies: payload.cookieNames.join(', '),
        host: payload.destHost,
    }));
    const tone = '#f87171';

    shadow.innerHTML = `
      <style>
        .card {
          width: 320px;
          font-family: "DM Sans", system-ui, sans-serif;
          background: #111827;
          color: #e5e7eb;
          border: 1px solid #374151;
          border-left: 3px solid ${tone};
          border-radius: 10px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
          padding: 12px 14px;
        }
        .row { display: flex; align-items: flex-start; gap: 8px; }
        .label {
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 11px;
          letter-spacing: 0.06em;
          color: ${tone};
          font-weight: 700;
        }
        .detail {
          margin-top: 6px;
          font-size: 13px;
          line-height: 1.4;
          word-break: break-word;
        }
        button {
          margin-left: auto;
          border: 0;
          background: transparent;
          color: #9ca3af;
          cursor: pointer;
          font-size: 14px;
        }
      </style>
      <div class="card">
        <div class="row">
          <div>
            <div class="label">${escapeHtml(title)}</div>
            <div class="detail">${detail}</div>
          </div>
          <button type="button" data-dismiss aria-label="${t('common.close')}">✕</button>
        </div>
      </div>
    `;

    shadow.querySelector('[data-dismiss]')?.addEventListener('click', () => {
        shadow.innerHTML = '';
    });

    window.clearTimeout(dismissTimer);
    dismissTimer = window.setTimeout(() => {
        if (shadow.isConnected) shadow.innerHTML = '';
    }, DISMISS_MS);
}

chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== XSS_TAB_ALERT) return;
    const payload = message.payload as XssTabAlertPayload | undefined;
    if (!payload?.destHost || !payload.cookieNames?.length) return;
    showAlert(payload);
});
