// @vitest-environment jsdom

import { messages } from '@renderer/features/app/i18n/locale';
import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Footer } from '.';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

const { get, install, onChanged } = vi.hoisted(() => ({
  get: vi.fn(),
  install: vi.fn(),
  onChanged: vi.fn(() => () => {}),
}));

describe('sidebar footer updates', () => {
  beforeEach(() => {
    get.mockResolvedValue({ downloadProgressPercent: null, state: 'ready' });
    install.mockReset();
    onChanged.mockClear();
    Object.defineProperty(window, 'piApp', {
      configurable: true,
      value: { appUpdates: { get, install, onChanged } },
    });
  });

  it('shows the downloaded update action and installs only after the user clicks it', async () => {
    render(
      <IntlProvider locale="en" messages={messages.en}>
        <Footer />
      </IntlProvider>,
    );

    const update = await screen.findByRole('button', { name: 'Update' });
    fireEvent.click(update);

    expect(install).toHaveBeenCalledOnce();
  });
});
