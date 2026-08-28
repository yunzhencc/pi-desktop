// @vitest-environment jsdom

import { DEFAULT_LOCALE, messages } from '@renderer/features/app/i18n';
import { cleanup, render, screen } from '@testing-library/react';
import { createIntl, IntlProvider } from 'react-intl';
import { afterEach, describe, expect, it } from 'vitest';
import { SessionItem } from './item';
import { formatSessionAge } from './relative-age';

afterEach(cleanup);

describe('session item', () => {
  it('renders inside the app intl provider', () => {
    render(
      <IntlProvider locale={DEFAULT_LOCALE} messages={messages[DEFAULT_LOCALE]}>
        <SessionItem modifiedAt={new Date(Date.now() - 17 * 60000).toISOString()} projectName="pixvibe">
          Investigate Eagle resize
        </SessionItem>
      </IntlProvider>,
    );

    expect(screen.getByText('Investigate Eagle resize')).not.toBeNull();
  });

  it('formats compact relative age like Codex', () => {
    const intl = createIntl({
      locale: DEFAULT_LOCALE,
      messages: messages[DEFAULT_LOCALE],
    });

    expect(formatSessionAge(new Date(Date.now() - 17 * 60000).toISOString(), intl.formatMessage)).toBe('17m');
  });
});
