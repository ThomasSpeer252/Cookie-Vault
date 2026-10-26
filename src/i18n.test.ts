import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLocale, localizeDocument, t } from './i18n';
import english from './locales/en_US.yaml';
import portuguese from './locales/pt_BR.yaml';
import { formatCookieExpiration } from './popup/cookie_format';
import { localizeOperationDetail } from './popup/operation_log';

afterEach(() => vi.unstubAllGlobals());

describe('interface localization', () => {
  it.each(['pt-BR', 'pt_BR', 'pt-br', 'pt'])('selects Brazilian Portuguese for %s', language => {
    vi.stubGlobal('chrome', { i18n: { getUILanguage: () => language } });
    expect(getLocale()).toBe('pt-BR');
    expect(t('home.settings')).toBe('Configurações');
  });

  it.each(['en-US', 'en-GB', 'fr', 'pt-PT'])('falls back to US English for %s', language => {
    vi.stubGlobal('chrome', { i18n: { getUILanguage: () => language } });
    expect(getLocale()).toBe('en-US');
    expect(t('home.settings')).toBe('Settings');
  });

  it('uses navigator language in a web preview without extension APIs', () => {
    vi.stubGlobal('chrome', undefined);
    vi.stubGlobal('navigator', { language: 'pt-BR' });
    expect(t('edit.save')).toBe('Salvar alterações');
  });

  it('uses native messages with encoded keys and interpolates values literally', () => {
    const getMessage = vi.fn(() => '{name} excluído');
    vi.stubGlobal('chrome', { i18n: { getUILanguage: () => 'pt-BR', getMessage } });
    expect(t('log.deleted', { name: '$&{name}<cookie>' })).toBe('$&{name}<cookie> excluído');
    expect(getMessage).toHaveBeenCalledWith('log_deleted');
  });

  it('keeps identical translation keys and interpolation tokens', () => {
    expect(Object.keys(portuguese).sort()).toEqual(Object.keys(english).sort());
    for (const key of Object.keys(english)) {
      expect(portuguese[key].match(/\{\w+\}/g), key).toEqual(english[key].match(/\{\w+\}/g));
      expect(portuguese[key], key).not.toContain('?');
    }
  });

  it('localizes document text, language, and attributes', () => {
    vi.stubGlobal('chrome', { i18n: { getUILanguage: () => 'pt-BR' } });
    const text = { dataset: { i18n: 'home.settings' }, textContent: '' };
    const input = { getAttribute: () => 'home.search', setAttribute: vi.fn() };
    const root = {
      documentElement: { lang: '' },
      querySelectorAll: (selector: string) => selector === '[data-i18n]' ? [text]
        : selector === '[data-i18n-placeholder]' ? [input] : [],
    };
    vi.stubGlobal('document', root);
    localizeDocument();
    expect(root.documentElement.lang).toBe('pt-BR');
    expect(text.textContent).toBe('Configurações');
    expect(input.setAttribute).toHaveBeenCalledWith('placeholder', 'Pesquisar domínio...');
  });

  it('formats expiration dates in Brazilian Portuguese', () => {
    vi.stubGlobal('chrome', { i18n: { getUILanguage: () => 'pt-BR' } });
    const cookie = { session: false, expirationDate: Date.UTC(2030, 9, 26, 12) / 1000 } as chrome.cookies.Cookie;
    expect(formatCookieExpiration(cookie).label).toBe(new Date(cookie.expirationDate! * 1000)
      .toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: 'numeric' }));
    expect(formatCookieExpiration({ session: true } as chrome.cookies.Cookie).label).toBe('Sessão');
  });

  it('translates new and legacy persisted log descriptions', () => {
    vi.stubGlobal('chrome', { i18n: { getUILanguage: () => 'pt-BR' } });
    const entry = { timestamp: 0, op: 'DELETE' as const, site: 'example.com', type: 'session deleted' };
    expect(localizeOperationDetail(entry)).toBe('session excluído');
    expect(localizeOperationDetail({ ...entry, type: JSON.stringify({ key: 'log.deleted', values: { name: 'session' } }) }))
      .toBe('session excluído');
  });
});
