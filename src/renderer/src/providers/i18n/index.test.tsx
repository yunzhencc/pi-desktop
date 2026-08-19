// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider, readLocale, useAppLocale } from '.';

function LocaleProbe() {
  const { locale, setLocale } = useAppLocale();
  return (
    <>
      <output>{locale}</output>
      <button onClick={() => setLocale('en')} type="button">English</button>
    </>
  );
}

describe('i18n provider', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to Chinese and persists an explicit English selection', () => {
    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    );

    expect(screen.getByText('zh-CN')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'English' }));

    expect(screen.getByText('en')).not.toBeNull();
    expect(localStorage.getItem('pi-desktop-locale')).toBe('en');
  });

  it('allows only Chinese and English locales', () => {
    expect(readLocale('en')).toBe('en');
    expect(readLocale('fr-FR')).toBe('zh-CN');
  });
});
