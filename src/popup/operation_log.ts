import { CookieDatabase, LogEntry, LogOperation } from '@/db/CookieDatabase';
import { openOverlay } from './overlay';

export type OperationType = 'VAULT' | 'VAULT_ALL' | 'UNVAULT' | 'UNVAULT_ALL' | 'BLOCK' | 'WARN' | 'DELETE'

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
  VAULT_ALL: 'vault-all',
  UNVAULT: 'unvault',
  UNVAULT_ALL: 'unvault-all',
  BLOCK: 'block',
  WARN: 'warn',
  DELETE: 'delete'
}

const TO_DB_OP: Record<OperationType, LogOperation> = {
  VAULT: 'vault',
  VAULT_ALL: 'vault',
  UNVAULT: 'unvault',
  UNVAULT_ALL: 'unvault',
  BLOCK: 'block',
  WARN: 'warn',
  DELETE: 'delete'
}

function fromDb(entry: LogEntry): OperationEntry {
  const all_sites = entry.domain === ALL_SITES;
  const ops: Record<LogOperation, OperationType> = {
    vault: all_sites? 'VAULT_ALL' : 'VAULT',
    unvault: all_sites? 'UNVAULT_ALL' : 'UNVAULT',
    block: 'BLOCK',
    warn: 'WARN',
    delete: 'DELETE'
  };

  return { timestamp: entry.timestamp, op: ops[entry.op], type: entry.detail, site: entry.domain };
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
      op: TO_DB_OP[op],
      detail: detail
    });
  } catch (error) {
    opError = error instanceof Error ? error.message : 'Failed to record operation.';
    return;
  }
};

async function clearLog(root: HTMLElement) {
  try {
    await CookieDatabase.getInstance().clearLogEntries();
  } catch (error) {
    opError = error instanceof Error ? error.message : 'Failed to clear log.';
    return;
  }
  const events = root.querySelector('.operation-events');
  const count = root.querySelector('.entry-count');
  if (events) events.innerHTML = '';
  if (count) count.textContent = '0 entries';
}

function renderEvent(entry: OperationEntry): string {
  const date = new Date(entry.timestamp);

  return `
      <div class="operation-entry">
      <div class="operation-col timestamp">
        <span class="operation-date">${(date).toLocaleDateString()}</span>
        <span class="operation-time">${(date).toLocaleTimeString()}</span>
      </div>
      <div class="operation-col operation">
        <span class="operation-badge operation-badge-${OP_TYPES[entry.op]}">${(entry.op)}</span>
      </div>
      <div class="operation-col detail">
        <span class="operation-detail">${(entry.type)}</span>
        <span class="operation-site">${(entry.site)}</span>
      </div>
    </div>`;
}

export async function renderLog() {
  const operations = await getOperations();
  const entryLabel = operations.length === 1 ? 'entry' : 'entries';

  const overlay = openOverlay(`
  <div class="site-details-view operation-view">
    <section class="detail-card operation-card">
      <header class="card-header">
        <div class="header-title">
          <span class="mono-label">OPERATION LOG</span>
          <span class="entry-count">${operations.length} ${entryLabel}</span>
          <button class="clear-log-btn" data-action="clear-log">Clear Log</span>
        </div>          
        <button class="icon-btn" data-action="close-settings" title="Close">✕</button>
      </header>

      <div class="operation-grid info-grid">
        <div class="operation-col timestamp">
          <span class="operation-header">TIMESTAMP</span>
        </div>
        <div class="operation-col operation">
          <span class="operation-header">OP</span>
        </div>
        <div class="operation-col detail">
          <span class="operation-header">DETAIL</span>
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
