import english from './locales/en_US.yaml';
import portuguese from './locales/pt_BR.yaml';

export function getLocale(): 'en-US' | 'pt-BR' {
  const language = globalThis.chrome?.i18n?.getUILanguage?.()
    || globalThis.navigator?.language || 'en-US';
  return /^pt(?:[-_]BR)?$/i.test(language) ? 'pt-BR' : 'en-US';
}

/** Dotted YAML keys are encoded with underscores for Chrome's message API. */
export function t(key: string, values: Record<string, string | number> = {}): string {
  const catalog = getLocale() === 'pt-BR' ? portuguese : english;
  const message = globalThis.chrome?.i18n?.getMessage?.(key.replace(/\./g, '_'))
    || catalog[key] || english[key] || key;
  return message.replace(/\{(\w+)\}/g, (token, name) => String(values[name] ?? token));
}

export function localizeDocument(root: ParentNode = document): void {
  document.documentElement.lang = getLocale();
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach(element => {
    element.textContent = t(element.dataset.i18n!);
  });
  for (const attribute of ['title', 'placeholder', 'aria-label']) {
    root.querySelectorAll<HTMLElement>(`[data-i18n-${attribute}]`).forEach(element => {
      element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)!));
    });
  }
}
