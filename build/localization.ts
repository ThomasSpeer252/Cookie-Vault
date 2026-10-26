import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import type { Plugin, ResolvedConfig } from 'vite';

export function flattenMessages(value: unknown, prefix = '', result: Record<string, string> = {}): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected a YAML mapping at ${prefix || 'root'}`);
  }
  for (const [key, child] of Object.entries(value)) {
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key)) throw new Error(`Invalid localization key: ${key}`);
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') result[fullKey] = child;
    else flattenMessages(child, fullKey, result);
  }
  return result;
}

export function chromeMessages(messages: Record<string, string>) {
  return Object.fromEntries(Object.entries(messages).map(([key, message]) => [
    key.replaceAll('.', '_'),
    { message: message.replaceAll('$', () => '$$') },
  ]));
}

export function localization(): Plugin {
  let config: ResolvedConfig;
  let directory = path.resolve('src/locales');
  const locales = ['en_US', 'pt_BR'];
  const read = (locale: string) => flattenMessages(parse(readFileSync(path.join(directory, `${locale}.yaml`), 'utf8')));
  const assets = () => {
    const files: { fileName: string; source: string }[] = [];
    const english = read('en_US');
    const keys = Object.keys(english).sort();
    for (const locale of locales) {
      const messages = read(locale);
      if (JSON.stringify(Object.keys(messages).sort()) !== JSON.stringify(keys)) {
        throw new Error(`Localization keys for ${locale} do not match en_US`);
      }
      for (const key of keys) {
        const tokens = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join();
        if (tokens(messages[key]) !== tokens(english[key])) throw new Error(`Interpolation mismatch: ${locale}.${key}`);
      }
      // Keep dotted keys in plain JSON; Chrome requires underscore-separated message names.
      files.push({ fileName: `locales/${locale}.json`, source: JSON.stringify(messages, null, 2) });
      files.push({ fileName: `_locales/${locale}/messages.json`, source: JSON.stringify(chromeMessages(messages), null, 2) });
    }
    return files;
  };
  const writeDevelopmentAssets = () => {
    for (const { fileName, source } of assets()) {
      const target = path.resolve(config.root, config.build.outDir, fileName);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, source);
    }
  };
  return {
    name: 'cookie-vault-localization',
    enforce: 'pre',
    configResolved(resolved) {
      config = resolved;
      directory = path.resolve(config.root, 'src/locales');
    },
    buildStart() {
      for (const locale of locales) this.addWatchFile(path.join(directory, `${locale}.yaml`));
      const files = assets();
      if (config.command === 'build') {
        for (const file of files) this.emitFile({ type: 'asset', ...file });
      }
    },
    configureServer() {
      // CRXJS writes an unpacked extension during development; Chrome needs these on disk.
      if (config.mode !== 'test') writeDevelopmentAssets();
    },
    handleHotUpdate({ file, server }) {
      if (path.dirname(path.resolve(file)) !== directory || !file.endsWith('.yaml')) return;
      writeDevelopmentAssets();
      server.ws.send({ type: 'custom', event: 'crx:runtime-reload' });
    },
    transform(source, id) {
      if (!id.replaceAll('\\', '/').startsWith(directory.replaceAll('\\', '/') + '/') || !id.endsWith('.yaml')) return;
      return { code: `export default ${JSON.stringify(flattenMessages(parse(source)))}`, map: null };
    },
  };
}
