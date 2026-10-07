import { openOverlay } from './overlay';

export type OperationType = 'VAULT' | 'UNVAULT' | 'UNVAULT_ALL' | 'BLOCK' | 'WARN'

export interface OperationEntry {
  timestamp: number; // epoch ms
  op: OperationType;
  title: string;
  site: string;
}

const OP_MODIFIERS: Record<OperationType, string> = {
  VAULT: 'vault',
  UNVAULT: 'unvault',
  UNVAULT_ALL: 'unvault-all',
  BLOCK: 'BLOCK',
  WARN: 'WARN'
}

const PLACEHOLDER_OPS: OperationEntry[] = [
  { timestamp: new Date(2026, 9, 2, 15, 12, 26).getTime(), op: 'UNVAULT_ALL', title: 'All cookies unvaulted', site: 'all sites' },
  { timestamp: new Date(2026, 8, 17, 14, 23, 11).getTime(), op: 'VAULT', title: 'token_v2 vaulted', site: 'notion.so' },
  { timestamp: new Date(2026, 8, 17, 14, 20, 44).getTime(), op: 'BLOCK', title: 'Cross-site tracker blocked', site: 'tracker-ads.net' }
]

export async function getOperations() {
  return PLACEHOLDER_OPS;
}

function renderEvent(entry: OperationEntry): string {
  const date = new Date(entry.timestamp);

  return `
      <div class="operation-row">
      <div class="operation-col timestamp">
        <span class="operation-date">${(date)}</span>
        <span class="operation-time">${(date)}</span>
      </div>
      <div class="operation-col operation">
        <span class="op-badge op-badge--${OP_MODIFIERS[entry.op]}">${(entry.op)}</span>
      </div>
      <div class="operation-col detail">
        <span class="operation-title">${(entry.title)}</span>
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
}
