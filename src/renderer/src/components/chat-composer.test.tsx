// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatComposer } from './chat-composer';

const composer = {
  addDroppedAttachments: vi.fn(),
  chooseAttachments: vi.fn(),
  onUpdate: vi.fn(),
  removeAttachment: vi.fn(),
  send: vi.fn(),
};

beforeEach(() => {
  const rect = new DOMRect(0, 0, 1, 1);
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => null });
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => rect });
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [rect] });
  Object.defineProperty(window, 'scrollBy', { configurable: true, value: () => {} });
  vi.stubGlobal('api', { composer });
  composer.addDroppedAttachments.mockResolvedValue({ attachments: [], failures: [] });
  composer.chooseAttachments.mockResolvedValue({ attachments: [], failures: [] });
  composer.removeAttachment.mockResolvedValue(undefined);
  composer.send.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('chat composer', () => {
  it('sends typed text and clears the editor', async () => {
    const user = userEvent.setup();
    const onSubmitted = vi.fn();
    render(<ChatComposer onSubmitted={onSubmitted} />);

    await user.type(screen.getByRole('textbox', { name: 'Message Pi' }), 'Hello Pi');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(composer.send).toHaveBeenCalledWith('Hello Pi', []);
    expect(onSubmitted).toHaveBeenCalledWith('Hello Pi');
    expect(screen.getByRole('textbox', { name: 'Message Pi' }).textContent).toBe('');
  });

  it('adds and removes selected attachment chips', async () => {
    const user = userEvent.setup();
    composer.chooseAttachments.mockResolvedValue({
      attachments: [{ id: 'image-1', kind: 'image', name: 'diagram.png', previewDataUrl: 'data:image/png;base64,AA==', size: 2 }],
      failures: [],
    });
    render(<ChatComposer onSubmitted={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Add attachment' }));
    expect(await screen.findByText('diagram.png')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Remove diagram.png' }));
    expect(composer.removeAttachment).toHaveBeenCalledWith('image-1');
    expect(screen.queryByText('diagram.png')).toBeNull();
  });

  it('reports rejected files while retaining accepted attachments', async () => {
    const user = userEvent.setup();
    composer.chooseAttachments.mockResolvedValue({
      attachments: [{ id: 'text-1', kind: 'text', name: 'notes.md', size: 7 }],
      failures: [{ name: 'recording.mp3', reason: '不支持此文件类型' }],
    });
    render(<ChatComposer onSubmitted={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Add attachment' }));

    expect(await screen.findByText('notes.md')).not.toBeNull();
    expect(screen.getByRole('status').textContent).toContain('recording.mp3: 不支持此文件类型');
  });

  it('uses the drop attachment command for Electron file paths', async () => {
    render(<ChatComposer onSubmitted={vi.fn()} />);
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'path', { value: '/tmp/notes.txt' });

    fireEvent.drop(screen.getByRole('textbox', { name: 'Message Pi' }), { dataTransfer: { files: [file] } });

    await waitFor(() => expect(composer.addDroppedAttachments).toHaveBeenCalledWith(['/tmp/notes.txt']));
  });
});
