// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider, LocaleEnum, readLocale, resolveLocale, useAppLocale } from '.';

function LocaleProbe() {
  const { locale, setLocale } = useAppLocale();
  return (
    <>
      <output>{locale}</output>
      <button onClick={() => setLocale('en')} type="button">English</button>
      <button onClick={() => setLocale(null)} type="button">Auto detect</button>
    </>
  );
}

describe('i18n provider', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'languages', { configurable: true, value: ['zh-CN', 'zh'] });
  });

  it('uses automatic detection and persists an explicit English selection', () => {
    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    );

    expect(screen.getByText('zh-CN')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'English' }));

    expect(screen.getByText('en')).not.toBeNull();
    expect(localStorage.getItem('pi-desktop-locale')).toBe('en');

    fireEvent.click(screen.getByRole('button', { name: 'Auto detect' }));
    expect(screen.getByText('zh-CN')).not.toBeNull();
    expect(localStorage.getItem('pi-desktop-locale')).toBeNull();
  });

  it('allows only Chinese and English locales', () => {
    expect(readLocale(LocaleEnum.English)).toBe(LocaleEnum.English);
    expect(readLocale('fr-FR')).toBe(LocaleEnum.English);
  });

  it('uses the system language when there is no explicit preference', () => {
    expect(resolveLocale(null, ['zh-TW', 'en-US'])).toBe(LocaleEnum.Chinese);
    expect(resolveLocale(null, ['fr-FR'])).toBe(LocaleEnum.English);
    expect(resolveLocale(LocaleEnum.Chinese, ['en-US'])).toBe(LocaleEnum.Chinese);
  });
});
