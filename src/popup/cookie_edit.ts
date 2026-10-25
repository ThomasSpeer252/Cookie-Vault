import { escapeHtml } from './cookie_format';
import { updateCookie, updateVaultedCookie, type CookieEditInput } from './cookie_actions';
import { openOverlay } from './overlay';
import {SiteCookie} from "@/popup/cookie_data.ts";

function sameSiteFromSelect(value: string): `${chrome.cookies.SameSiteStatus}` {
    if (value === 'strict' || value === 'lax' || value === 'no_restriction') {
        return value;
    }
    return 'unspecified';
}

function defaultExpirationLocal(cookie: chrome.cookies.Cookie): string {
    if (cookie.session || cookie.expirationDate === undefined) return '';
    const date = new Date(cookie.expirationDate * 1000);
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function openCookieEdit(
    cookie: SiteCookie,
    onSaved: () => void | Promise<void>,
): void {
    const isSession = cookie.session || cookie.expirationDate === undefined;
    const isVaulted = cookie.isVaulted

    const overlay = openOverlay(`
      <div class="site-details-view cookie-edit-view">
        <section class="detail-card">
          <header class="card-header">
            <div class="header-title">
              <span class="mono-label">EDIT COOKIE</span>
              <span class="domain-badge">${escapeHtml(cookie.name || '(unnamed)')}</span>
            </div>
            <button type="button" class="icon-btn" data-action="close-edit" title="Close">✕</button>
          </header>

          <form class="cookie-edit-form" id="cookie-edit-form">
            <label class="cookie-edit-field">
              <span>Value</span>
              <input type="text" name="value" required value="${escapeHtml(cookie.value)}" />
            </label>

            <label class="cookie-edit-field cookie-edit-field--readonly">
              <span>Domain</span>
              <input type="text" readonly value="${escapeHtml(cookie.domain)}" />
            </label>

            <label class="cookie-edit-field cookie-edit-field--readonly">
              <span>Path</span>
              <input type="text" readonly value="${escapeHtml(cookie.path)}" />
            </label>

            <div class="cookie-edit-flags">
              <label><input type="checkbox" name="secure" ${cookie.secure ? 'checked' : ''} /> Secure</label>
              <label><input type="checkbox" name="httpOnly" ${cookie.httpOnly ? 'checked' : ''} /> HttpOnly</label>
              <label><input type="checkbox" name="session" ${isSession ? 'checked' : ''} /> Session</label>
            </div>

            <label class="cookie-edit-field">
              <span>SameSite</span>
              <select name="sameSite">
                <option value="unspecified" ${cookie.sameSite === 'unspecified' ? 'selected' : ''}>Unspecified</option>
                <option value="lax" ${cookie.sameSite === 'lax' ? 'selected' : ''}>Lax</option>
                <option value="strict" ${cookie.sameSite === 'strict' ? 'selected' : ''}>Strict</option>
                <option value="no_restriction" ${cookie.sameSite === 'no_restriction' ? 'selected' : ''}>None</option>
              </select>
            </label>

            <label class="cookie-edit-field" id="expires-field">
              <span>Expires</span>
              <input type="datetime-local" name="expires" value="${defaultExpirationLocal(cookie)}" />
            </label>

            <p class="cookie-edit-error list-state list-state--error" id="cookie-edit-error" hidden></p>

            <div class="cookie-edit-actions">
              <button type="button" class="cookie-edit-btn cookie-edit-btn--cancel" data-action="cancel-edit">Cancel</button>
              <button type="submit" class="cookie-edit-btn cookie-edit-btn--save">Save changes</button>
            </div>
          </form>
        </section>
      </div>
    `);

    if (!overlay) return;

    const form = overlay.element.querySelector<HTMLFormElement>('#cookie-edit-form');
    const errorEl = overlay.element.querySelector<HTMLParagraphElement>('#cookie-edit-error');
    const sessionCheck = overlay.element.querySelector<HTMLInputElement>('input[name="session"]');
    const expiresField = overlay.element.querySelector<HTMLLabelElement>('#expires-field');

    const syncExpiresVisibility = () => {
        if (expiresField && sessionCheck) {
            expiresField.hidden = sessionCheck.checked;
        }
    };
    sessionCheck?.addEventListener('change', syncExpiresVisibility);
    syncExpiresVisibility();

    const close = () => overlay.close();

    overlay.element.querySelector('[data-action="close-edit"]')?.addEventListener('click', close);
    overlay.element.querySelector('[data-action="cancel-edit"]')?.addEventListener('click', close);

    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!form || !errorEl) return;

        errorEl.hidden = true;
        errorEl.textContent = '';

        const data = new FormData(form);
        const session = data.get('session') === 'on';
        let expirationDate: number | undefined;

        if (!session) {
            const raw = String(data.get('expires') ?? '');
            if (raw) {
                expirationDate = Math.floor(new Date(raw).getTime() / 1000);
            }
        }

        const input: CookieEditInput = {
            value: String(data.get('value') ?? ''),
            secure: data.get('secure') === 'on',
            httpOnly: data.get('httpOnly') === 'on',
            sameSite: sameSiteFromSelect(String(data.get('sameSite') ?? 'unspecified')),
            session,
            expirationDate,
        };

        if (input.sameSite === 'no_restriction') {
            input.secure = true;
        }

        const err = getValidationError(cookie, input);
        if (err) {
            errorEl.hidden = false;
            errorEl.textContent = err;
            return;
        }

        try {
            if (isVaulted) {
                await updateVaultedCookie(cookie, input);
            } else {
                await updateCookie(cookie, input)
            }
            close();
            await onSaved();
        } catch (error) {
            errorEl.hidden = false;
            errorEl.textContent = error instanceof Error
                ? error.message
                : 'Failed to update cookie.';
        }
    });

    overlay.element.querySelector<HTMLButtonElement>('[data-action="close-edit"]')?.focus();
}

export function getValidationError(cookie: chrome.cookies.Cookie, input: CookieEditInput): string | null {
    const name = cookie.name || '';
    const path = cookie.path || '/';

    if (!name.trim()) {
        return "Cookie name cannot be empty.";
    }
    if (/[\r\n;,]/.test(input.value)) {
        return "Cookie value contains invalid characters.";
    }

    if (name.startsWith('__Host-')) {
        if (!input.secure) {
            return "Cookies prefixed with '__Host-' must have the Secure flag enabled.";
        }
        if (path !== '/') {
            return "Cookies prefixed with '__Host-' must have a Path set strictly to '/'.";
        }
    }

    if (name.startsWith('__Secure-') && !input.secure) {
        return "Cookies prefixed with '__Secure-' must have the Secure flag enabled.";
    }

    if (input.sameSite === 'no_restriction' && !input.secure) {
        return "Cookies with 'SameSite=None' must also have the 'Secure' attribute checked.";
    }

    if (!input.session) {
        if (input.expirationDate === undefined || isNaN(input.expirationDate)) {
            return "Enter an expiration date and time, or check the 'Session' flag.";
        }
        const nowSec = Math.floor(Date.now() / 1000);
        if (input.expirationDate <= nowSec) {
            return "Set Expiration date has passed.";
        }
    }
    return null;
}