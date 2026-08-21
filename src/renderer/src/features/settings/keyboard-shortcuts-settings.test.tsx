// @vitest-environment jsdom

import { getDefaultShortcutBindings } from '@renderer/features/app/shortcuts';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyboardShortcutsView } from './keyboard-shortcuts-settings';

const messages = {
  'shortcut.focusSettingsSearch.description': 'Focus the settings search field',
  'shortcut.focusSettingsSearch.title': 'Find settings',
  'shortcut.newConversation.description': 'Start a new conversation',
  'shortcut.newConversation.title': 'New conversation',
  'shortcut.openSettings.description': 'Open settings',
  'shortcut.openSettings.title': 'Open settings',
  'shortcut.toggleSessionPin.description': 'Pin or unpin the current conversation',
  'shortcut.toggleSessionPin.title': 'Toggle conversation pin',
  'shortcut.toggleSidebar.description': 'Show or hide the sidebar',
  'shortcut.toggleSidebar.title': 'Toggle sidebar',
  'shortcuts.add': 'Add shortcut',
  'shortcuts.conflict': '{command} already uses this shortcut',
  'shortcuts.edit': 'Edit {command} shortcut {index}',
  'shortcuts.invalid': 'Shortcut must include Command, Control, or Alt',
  'shortcuts.recording': 'Press a shortcut',
  'shortcuts.reset': 'Reset',
  'shortcuts.resetAll': 'Reset all',
  'shortcuts.resetAll.description': 'Restore every custom shortcut.',
  'shortcuts.resetAll.title': 'Reset all shortcuts?',
  'shortcuts.search': 'Search shortcuts',
  'shortcuts.searchByKeystrokes': 'Search by keystrokes',
  'shortcuts.search.placeholder': 'Search shortcuts',
  'shortcuts.title': 'Keyboard shortcuts',
};

function renderView(bindings = getDefaultShortcutBindings(), onUpdate = vi.fn()) {
  render(
    <IntlProvider locale="en" messages={messages}>
      <KeyboardShortcutsView bindings={bindings} onUpdate={onUpdate} />
    </IntlProvider>,
  );
  return onUpdate;
}

describe('keyboard shortcuts settings', () => {
  afterEach(cleanup);

  it('filters commands by title and description', () => {
    renderView();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search shortcuts' }), { target: { value: 'sidebar' } });

    expect(screen.getByText('Toggle sidebar')).not.toBeNull();
    expect(screen.queryByText('New conversation')).toBeNull();
  });

  it('filters commands by a recorded keystroke', () => {
    renderView();

    fireEvent.click(screen.getByRole('button', { name: 'Search by keystrokes' }));
    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Search shortcuts' }), { ctrlKey: true, key: 'b' });

    expect(screen.getByText('Toggle sidebar')).not.toBeNull();
    expect(screen.queryByText('New conversation')).toBeNull();
  });

  it('records a replacement binding', () => {
    const onUpdate = renderView();

    fireEvent.click(screen.getByRole('button', { name: 'Edit New conversation shortcut 1' }));
    expect(screen.getByText('Press a shortcut')).not.toBeNull();
    fireEvent.keyDown(document, { ctrlKey: true, key: 'j' });

    expect(onUpdate).toHaveBeenCalledWith('newConversation', 0, 'Mod+J');
  });

  it('rejects a bare character while recording', () => {
    const onUpdate = renderView();

    fireEvent.click(screen.getByRole('button', { name: 'Edit New conversation shortcut 1' }));
    fireEvent.keyDown(document, { key: 'c' });

    expect(screen.getByText('Shortcut must include Command, Control, or Alt')).not.toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('shows an inline error for a conflicting recorded binding', () => {
    const onUpdate = renderView();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Open settings shortcut 1' }));
    fireEvent.keyDown(document, { ctrlKey: true, key: 'b' });

    expect(screen.getByText('Toggle sidebar already uses this shortcut')).not.toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('removes a binding when recording receives Backspace', () => {
    const onRemove = vi.fn();

    render(
      <IntlProvider locale="en" messages={messages}>
        <KeyboardShortcutsView bindings={getDefaultShortcutBindings()} onRemove={onRemove} onUpdate={vi.fn()} />
      </IntlProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit New conversation shortcut 1' }));
    fireEvent.keyDown(document, { key: 'Backspace' });

    expect(onRemove).toHaveBeenCalledWith('newConversation', 0);
  });

  it('confirms before resetting all custom bindings', () => {
    const onResetAll = vi.fn();
    const bindings = {
      ...getDefaultShortcutBindings(),
      newConversation: ['Mod+J'],
    };

    render(
      <IntlProvider locale="en" messages={messages}>
        <KeyboardShortcutsView bindings={bindings} onResetAll={onResetAll} onUpdate={vi.fn()} />
      </IntlProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset all' }));
    expect(screen.getByRole('dialog', { name: 'Reset all shortcuts?' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Reset all' }));

    expect(onResetAll).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Reset all shortcuts?' })).toBeNull();
  });
});
