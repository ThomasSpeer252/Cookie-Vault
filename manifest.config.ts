import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
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
  content_scripts: [{
    js: ['src/content/main.ts'],
    matches: ['https://*/*'],
  }],
  permissions: [
    'sidePanel',
    'contentSettings',
    'unlimitedStorage',
    'storage',
  ],
  optional_permissions: ['cookies'],
  optional_host_permissions: ['<all_urls>'],
  host_permissions: ['https://*/*'],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
})
