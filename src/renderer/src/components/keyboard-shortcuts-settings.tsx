import type { ShortcutBindings, ShortcutId } from '@renderer/features/hotkeys';
import { Input } from '@pi-desktop/shadcn-ui/components/input';
import {
  findShortcutConflict,
  hasCustomShortcutBindings,
  isShortcutAllowed,
  shortcutDefinitions,
} from '@renderer/features/hotkeys';
import { formatForDisplay, hasNonModifierKey, normalizeHotkey, normalizeHotkeyFromEvent, useHotkeyRecorder } from '@tanstack/react-hotkeys';
import { Keyboard, Search } from 'lucide-react';
import { useState } from 'react';
import { useIntl } from 'react-intl';

interface KeyboardShortcutsViewProps {
  bindings: ShortcutBindings;
  onAppend?: (commandId: ShortcutId, hotkey: string) => void;
  onRemove?: (commandId: ShortcutId, index: number) => void;
  onReset?: (commandId: ShortcutId) => void;
  onResetAll?: () => void;
  onUpdate: (commandId: ShortcutId, index: number, hotkey: string) => void;
}

export function KeyboardShortcutsView({ bindings, onAppend, onRemove, onReset, onResetAll, onUpdate }: KeyboardShortcutsViewProps) {
  const { formatMessage } = useIntl();
  const [query, setQuery] = useState('');
  const [keystrokeQuery, setKeystrokeQuery] = useState('');
  const [isSearchingByKeystrokes, setIsSearchingByKeystrokes] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const definitions = shortcutDefinitions.filter(({ description, id, title }) => isSearchingByKeystrokes
    ? !keystrokeQuery || bindings[id].some(binding => normalizeHotkey(binding) === keystrokeQuery)
    : !normalizedQuery
      || formatMessage({ id: title }).toLocaleLowerCase().includes(normalizedQuery)
      || formatMessage({ id: description }).toLocaleLowerCase().includes(normalizedQuery));

  return (
    <div className="settings-view">
      <section className="settings-content" aria-labelledby="keyboard-shortcuts-title">
        <div className="shortcut-settings-heading">
          <h1 id="keyboard-shortcuts-title">{formatMessage({ id: 'shortcuts.title' })}</h1>
          {onResetAll && hasCustomShortcutBindings(bindings) && (
            <button className="shortcut-reset-button" onClick={() => setIsConfirmingReset(true)} type="button">
              {formatMessage({ id: 'shortcuts.resetAll' })}
            </button>
          )}
        </div>
        <div className="shortcut-search">
          <Search aria-hidden="true" className="shortcut-search-icon" size={16} strokeWidth={1.75} />
          <Input
            aria-label={formatMessage({ id: 'shortcuts.search' })}
            className="shortcut-search-input"
            onChange={event => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (!isSearchingByKeystrokes)
                return;
              event.preventDefault();
              event.stopPropagation();
              if (event.key === 'Escape') {
                setIsSearchingByKeystrokes(false);
                setKeystrokeQuery('');
                return;
              }
              const hotkey = normalizeHotkeyFromEvent(event.nativeEvent);
              if (hasNonModifierKey(hotkey))
                setKeystrokeQuery(hotkey);
            }}
            placeholder={formatMessage({ id: 'shortcuts.search.placeholder' })}
            readOnly={isSearchingByKeystrokes}
            type="search"
            value={isSearchingByKeystrokes ? formatForDisplay(keystrokeQuery || '') : query}
          />
          <button
            aria-label={formatMessage({ id: 'shortcuts.searchByKeystrokes' })}
            aria-pressed={isSearchingByKeystrokes}
            className="shortcut-search-mode"
            onClick={() => {
              setIsSearchingByKeystrokes(searching => !searching);
              setKeystrokeQuery('');
            }}
            type="button"
          >
            <Keyboard aria-hidden="true" size={15} />
          </button>
        </div>
        <div className="shortcut-command-list">
          {definitions.map(definition => (
            <article className="shortcut-command" key={definition.id}>
              <div className="shortcut-command-copy">
                <h2>{formatMessage({ id: definition.title })}</h2>
                <p>{formatMessage({ id: definition.description })}</p>
              </div>
              <div className="shortcut-command-controls">
                {bindings[definition.id].map((binding, index) => (
                  <ShortcutBindingButton
                    bindings={bindings}
                    commandId={definition.id}
                    index={index}
                    key={binding}
                    onClear={() => onRemove?.(definition.id, index)}
                    onRecord={hotkey => onUpdate(definition.id, index, hotkey)}
                    value={binding}
                  />
                ))}
                {onAppend && (
                  <ShortcutBindingButton
                    bindings={bindings}
                    commandId={definition.id}
                    index={bindings[definition.id].length}
                    isAddButton
                    onClear={() => {}}
                    onRecord={hotkey => onAppend(definition.id, hotkey)}
                  />
                )}
                {onReset && <button className="shortcut-reset-button" onClick={() => onReset(definition.id)} type="button">{formatMessage({ id: 'shortcuts.reset' })}</button>}
              </div>
            </article>
          ))}
        </div>
      </section>
      {isConfirmingReset && (
        <div aria-modal="true" className="shortcut-reset-dialog-backdrop" role="dialog">
          <div className="shortcut-reset-dialog">
            <h2>{formatMessage({ id: 'shortcuts.resetAll.title' })}</h2>
            <p>{formatMessage({ id: 'shortcuts.resetAll.description' })}</p>
            <div>
              <button className="shortcut-reset-button" onClick={() => setIsConfirmingReset(false)} type="button">{formatMessage({ id: 'shortcuts.cancel' })}</button>
              <button
                className="shortcut-reset-button shortcut-reset-button-primary"
                onClick={() => {
                  onResetAll?.();
                  setIsConfirmingReset(false);
                }}
                type="button"
              >
                {formatMessage({ id: 'shortcuts.resetAll' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShortcutBindingButton({ bindings, commandId, index, isAddButton = false, onClear, onRecord, value }: {
  bindings: ShortcutBindings;
  commandId: ShortcutId;
  index: number;
  isAddButton?: boolean;
  onClear: () => void;
  onRecord: (hotkey: string) => void;
  value?: string;
}) {
  const { formatMessage } = useIntl();
  const [error, setError] = useState<string>();
  const recorder = useHotkeyRecorder({
    ignoreInputs: false,
    onClear,
    onRecord: (hotkey) => {
      if (!hotkey)
        return;
      if (!isShortcutAllowed(hotkey)) {
        setError(formatMessage({ id: 'shortcuts.invalid' }));
        return;
      }
      const conflict = findShortcutConflict(bindings, commandId, hotkey);
      if (conflict) {
        setError(formatMessage({ id: 'shortcuts.conflict' }, { command: formatMessage({ id: shortcutDefinitions.find(definition => definition.id === conflict)!.title }) }));
        return;
      }
      setError(undefined);
      onRecord(hotkey);
    },
  });
  const command = formatMessage({ id: shortcutDefinitions.find(definition => definition.id === commandId)!.title });

  if (recorder.isRecording) {
    return <span className="shortcut-recording">{formatMessage({ id: 'shortcuts.recording' })}</span>;
  }

  return (
    <span className="shortcut-binding-control">
      <button
        aria-label={isAddButton ? formatMessage({ id: 'shortcuts.add' }) : formatMessage({ id: 'shortcuts.edit' }, { command, index: index + 1 })}
        className="shortcut-binding"
        onClick={() => recorder.startRecording()}
        type="button"
      >
        {isAddButton ? formatMessage({ id: 'shortcuts.add' }) : formatForDisplay(value!)}
      </button>
      {error && <span className="shortcut-error">{error}</span>}
    </span>
  );
}
