// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './home';

vi.mock('../components/chat-composer', () => ({
  ChatComposer: ({ onSubmitted }: { onSubmitted: (text: string) => void }) => <button onClick={() => onSubmitted('Build this')}>Fake composer</button>,
}));

beforeEach(() => {
  vi.stubGlobal('api', { composer: { onUpdate: vi.fn(() => () => {}) } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('home page', () => {
  it('shows an empty state and appends a submitted user message', () => {
    render(<HomePage />);

    expect(screen.getByText('What can I help you build?')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));

    expect(screen.getByText('Build this')).not.toBeNull();
  });

  it('renders submitted and streamed turns through the transcript log', () => {
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('api', { composer: { onUpdate } });
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));
    expect(screen.getByRole('log').textContent).toContain('Build this');

    act(() => onUpdate.mock.calls[0]![0]({ done: false, text: 'Working', type: 'assistant' }));
    expect(screen.getByRole('log').textContent).toContain('Working');
  });
});
