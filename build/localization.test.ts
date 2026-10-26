import { describe, expect, it } from 'vitest';
import { chromeMessages, flattenMessages } from './localization';

describe('YAML localization compilation', () => {
  it('flattens arbitrary nesting to dotted keys', () => {
    expect(flattenMessages({ settings: { theme: { label: 'Dark mode' } }, close: 'Close' }))
      .toEqual({ 'settings.theme.label': 'Dark mode', close: 'Close' });
  });

  it.each([null, [], 42, { label: true }, { label: ['text'] }])('rejects non-string leaves: %j', value => {
    expect(() => flattenMessages(value)).toThrow();
  });

  it.each(['a.b', 'a_b', 'a-b'])('rejects keys that could collide in Chrome: %s', key => {
    expect(() => flattenMessages({ [key]: 'text' })).toThrow('Invalid localization key');
  });

  it('encodes dotted keys for Chrome and escapes literal dollar signs', () => {
    expect(chromeMessages({ 'edit.price': 'Cost: $5 for {count}' }))
      .toEqual({ edit_price: { message: 'Cost: $$5 for {count}' } });
  });
});
