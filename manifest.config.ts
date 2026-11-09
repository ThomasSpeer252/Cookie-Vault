import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: '__MSG_app_name__',
  default_locale: 'en_US',
  version: pkg.version,
  icons: {
    48: 'public/logo.png',
  },
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_popup: 'src/popup/index.html',
  },
  background: {
    service_worker: 'src/background/main.ts',
    type: 'module',
  },
  content_scripts: [
    {
      js: ['src/content/main.ts', 'src/content/xss_alert.ts'],
      matches: ['https://*/*', 'http://127.0.0.1/*', 'http://localhost/*'],
      run_at: 'document_start',
    },
    {
      js: ['src/content/xss_outbound_hook.ts'],
      matches: ['https://*/*', 'http://127.0.0.1/*', 'http://localhost/*'],
      world: 'MAIN',
      run_at: 'document_start',
    },
  ],
  permissions: [
    'sidePanel',
    'contentSettings',
    'unlimitedStorage',
    'storage',
    'tabs',
    'webRequest',
    'scripting',
  ],
  optional_permissions: ['cookies'],
  optional_host_permissions: ['<all_urls>'],
  host_permissions: ['https://*/*', 'http://127.0.0.1/*', 'http://localhost/*'],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
})
