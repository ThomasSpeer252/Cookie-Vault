import { t, getLocale } from '../i18n';
import { escapeHtml } from './cookie_format';
import { CookieDatabase, LogEntry, OperationType } from '@/db/CookieDatabase';
import { openOverlay } from './overlay';

const ALL_SITES = 'all sites';

let opError: string | null = null;


export interface OperationEntry {
  timestamp: number; // epoch ms
  op: OperationType;
  type: string;
  site: string;
}

function cleanUrl(url: string): string {
    return url.replace(/^https?:\/\/?|\/+$/g, '');
}

const OP_TYPES: Record<OperationType, string> = {
  VAULT: 'vault',
  UNVAULT: 'unvault',
  UNVAULT_ALL: 'unvault-all',
  BLOCK: 'block',
  WARN: 'warn',
  DELETE: 'delete'
}

function fromDb(entry: LogEntry): OperationEntry {
  return { timestamp: entry.timestamp, op: entry.op, type: entry.detail, site: entry.domain };
}

export async function getOperations() {
  return (await CookieDatabase.getInstance().getLogEntries()).map(fromDb);
}

export async function recordOperation(op: OperationType, detail: string, site: string = ALL_SITES) {
  // TODO: When coooke deletion + warning and blocking is implemented, record those operations as well in their respective files
  try {
    await CookieDatabase.getInstance().addLogEntry({
      domain: op.endsWith('_ALL') ? ALL_SITES : cleanUrl(site),
      timestamp: Date.now(),
      op,
      detail: detail
    });
  } catch (error) {
    opError = error instanceof Error ? error.message : t('errors.record');
    return;
  }
};

async function clearLog(root: HTMLElement) {
  try {
    await CookieDatabase.getInstance().clearLogEntries();
  } catch (error) {
    opError = error instanceof Error ? error.message : t('errors.clear');
    return;
  }
  const events = root.querySelector('.operation-events');
  const count = root.querySelector('.entry-count');
  if (events) events.innerHTML = '';
  if (count) count.textContent = t('log.entries', { count: 0 });
}

export function localizeOperationDetail(entry: OperationEntry): string {
  // New records store message keys and values, keeping history language independent.
  try {
    const detail = JSON.parse(entry.type);
    if (['log.deleted', 'log.vaulted', 'log.unvaulted', 'log.allUnvaulted'].includes(detail.key)) {
      return t(detail.key, detail.values);
    }
  } catch { /* Older versions stored English descriptions. */ }
  if (entry.op === 'UNVAULT_ALL' && entry.type === 'All cookies unvaulted') return t('log.allUnvaulted');
  const legacy = { VAULT: [' vaulted', 'log.vaulted'], UNVAULT: [' unvaulted', 'log.unvaulted'], DELETE: [' deleted', 'log.deleted'] }[entry.op];
  if (legacy && entry.type.endsWith(legacy[0])) {
    return t(legacy[1], { name: entry.type.slice(0, -legacy[0].length) });
  }
  return entry.type;
}

function renderEvent(entry: OperationEntry): string {
  const date = new Date(entry.timestamp);
  const operationKey = { VAULT: 'vault', UNVAULT: 'unvault', UNVAULT_ALL: 'unvaultAll', BLOCK: 'block', WARN: 'warn', DELETE: 'delete' }[entry.op];

  return `
      <div class="operation-entry">
      <div class="operation-col timestamp">
        <span class="operation-date">${date.toLocaleDateString(getLocale())}</span>
        <span class="operation-time">${date.toLocaleTimeString(getLocale())}</span>
      </div>
      <div class="operation-col operation">
        <span class="operation-badge operation-badge-${OP_TYPES[entry.op]}">${t(`log.operations.${operationKey}`)}</span>
      </div>
      <div class="operation-col detail">
        <span class="operation-detail">${escapeHtml(localizeOperationDetail(entry))}</span>
        <span class="operation-site">${escapeHtml(entry.site === ALL_SITES ? t('log.allSites') : entry.site)}</span>
      </div>
    </div>`;
}

export async function renderLog() {
  const operations = await getOperations();
  const entryLabel = t(operations.length === 1 ? 'log.entry' : 'log.entries', { count: operations.length });

  const overlay = openOverlay(`
  <div class="site-details-view operation-view">
    <section class="detail-card operation-card">
      <header class="card-header">
        <div class="header-title">
          <span class="mono-label">${t('log.heading')}</span>
          <span class="entry-count">${entryLabel}</span>
          <button class="clear-log-btn" data-action="clear-log">${t('log.clear')}</button>
        </div>          
        <button class="icon-btn" data-action="close-settings" title="${t('common.close')}">✕</button>
      </header>

      <div class="operation-grid info-grid">
        <div class="operation-col timestamp">
          <span class="operation-header">${t('log.timestamp')}</span>
        </div>
        <div class="operation-col operation">
          <span class="operation-header">${t('log.operation')}</span>
        </div>
        <div class="operation-col detail">
          <span class="operation-header">${t('log.detail')}</span>
        </div>
      </div>
      
      <div class="operation-events">
        ${operations.map(renderEvent).join('')}
      </div>
    </section>
  </div>
`);

  if (!overlay) return;

  const closeButton = overlay.element.querySelector<HTMLButtonElement>('[data-action="close-settings"]');
  closeButton?.addEventListener('click', overlay.close);
  closeButton?.focus();

  const clearButton = overlay.element.querySelector<HTMLButtonElement>('[data-action="clear-log"]');
  clearButton?.addEventListener('click', () => clearLog(overlay.element));
}
