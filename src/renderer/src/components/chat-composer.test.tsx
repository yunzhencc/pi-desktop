// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../providers/i18n';
import { ChatComposer } from './chat-composer';

const composer = {
  addDroppedAttachments: vi.fn(),
  onUpdate: vi.fn(),
  removeAttachment: vi.fn(),
  send: vi.fn(),
};

beforeEach(() => {
  localStorage.clear();
  const rect = new DOMRect(0, 0, 1, 1);
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => null });
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => rect });
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [rect] });
  Object.defineProperty(window, 'scrollBy', { configurable: true, value: () => {} });
  vi.stubGlobal('api', { composer });
  composer.addDroppedAttachments.mockResolvedValue({ attachments: [], failures: [] });
  composer.removeAttachment.mockResolvedValue(undefined);
  composer.send.mockResolvedValue(undefined);
});

function renderComposer(onSubmitted = vi.fn()) {
  return render(
    <I18nProvider>
      <ChatComposer onSubmitted={onSubmitted} />
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('chat composer', () => {
  it('sends typed text and clears the editor', async () => {
    const user = userEvent.setup();
    const onSubmitted = vi.fn();
    renderComposer(onSubmitted);

    await user.type(screen.getByRole('textbox', { name: 'Message Pi' }), 'Hello Pi');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(composer.send).toHaveBeenCalledWith('Hello Pi', []);
    expect(onSubmitted).toHaveBeenCalledWith('Hello Pi');
    expect(screen.getByRole('textbox', { name: 'Message Pi' }).textContent).toBe('');
  });

  it('does not render auxiliary composer controls', () => {
    renderComposer();

    expect(screen.queryByRole('button', { name: 'Add attachment' })).toBeNull();
    expect(screen.queryByText('⌘↵ to send')).toBeNull();
  });

  it('uses Codex’s vertical send arrow', () => {
    renderComposer();

    expect(screen.getByRole('button', { name: 'Send message' }).querySelector('.lucide-arrow-up')).not.toBeNull();
  });

  it('uses the localized Codex default placeholder', () => {
    renderComposer();

    expect(screen.getByRole('form', { name: 'Message Pi' }).style.getPropertyValue('--chat-composer-placeholder')).toBe('"随心输入"');
  });

  it('uses the English placeholder when selected', () => {
    localStorage.setItem('pi-desktop-locale', 'en');
    renderComposer();

    expect(screen.getByRole('form', { name: 'Message Pi' }).style.getPropertyValue('--chat-composer-placeholder')).toBe('"Do anything"');
  });

  it('uses the drop attachment command for Electron file paths', async () => {
    renderComposer();
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'path', { value: '/tmp/notes.txt' });

    fireEvent.drop(screen.getByRole('textbox', { name: 'Message Pi' }), { dataTransfer: { files: [file] } });

    await waitFor(() => expect(composer.addDroppedAttachments).toHaveBeenCalledWith(['/tmp/notes.txt']));
  });
});
