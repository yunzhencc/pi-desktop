import type { ShortcutBindings, ShortcutId } from '@renderer/features/app/shortcuts';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@pi-desktop/shadcn-ui/components/dialog';
import { Input } from '@pi-desktop/shadcn-ui/components/input';
import { cn } from '@pi-desktop/shadcn-ui/lib/utils';
import {
  findShortcutConflict,
  hasCustomShortcutBindings,
  isShortcutAllowed,
  shortcutDefinitions,
} from '@renderer/features/app/shortcuts';
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

const shortcutButtonClass = 'min-h-7 rounded-md border border-border-subtle bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] px-2 py-1 text-xs text-foreground hover:bg-[color-mix(in_srgb,var(--foreground)_9%,transparent)]';

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
    <div className="h-full min-h-0 overflow-y-auto pt-[46px]">
      <section className="mx-auto w-full min-w-0 max-w-3xl px-8 pt-[22px] pb-12" aria-labelledby="keyboard-shortcuts-title">
        <div className="flex items-start justify-between gap-5">
          <h1 className="text-xl font-semibold tracking-normal" id="keyboard-shortcuts-title">{formatMessage({ id: 'shortcuts.title' })}</h1>
          {onResetAll && hasCustomShortcutBindings(bindings) && (
            <button className={shortcutButtonClass} onClick={() => setIsConfirmingReset(true)} type="button">
              {formatMessage({ id: 'shortcuts.resetAll' })}
            </button>
          )}
        </div>
        <div className="relative mt-6 flex items-center">
          <Search aria-hidden="true" className="pointer-events-none absolute left-[9px] z-[1] text-text-tertiary" size={16} strokeWidth={1.75} />
          <Input
            aria-label={formatMessage({ id: 'shortcuts.search' })}
            className="h-8 border-border-subtle bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] pl-[30px] shadow-none"
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
            className="absolute right-1 grid size-6 place-items-center rounded-sm text-text-tertiary hover:bg-[color-mix(in_srgb,var(--foreground)_9%,transparent)] hover:text-foreground aria-pressed:bg-[color-mix(in_srgb,var(--foreground)_9%,transparent)] aria-pressed:text-foreground"
            onClick={() => {
              setIsSearchingByKeystrokes(searching => !searching);
              setKeystrokeQuery('');
            }}
            type="button"
          >
            <Keyboard aria-hidden="true" size={15} />
          </button>
        </div>
        <div className="mt-6 flex flex-col border-t border-border-subtle">
          {definitions.map(definition => (
            <article className="flex min-h-[72px] items-start justify-between gap-5 border-b border-border-subtle py-4" key={definition.id}>
              <div>
                <h2 className="m-0 text-sm font-medium">{formatMessage({ id: definition.title })}</h2>
                <p className="m-0 mt-1 text-[13px] text-text-tertiary">{formatMessage({ id: definition.description })}</p>
              </div>
              <div className="flex flex-[0_1_24rem] flex-wrap justify-end gap-1.5">
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
                {onReset && <button className={shortcutButtonClass} onClick={() => onReset(definition.id)} type="button">{formatMessage({ id: 'shortcuts.reset' })}</button>}
              </div>
            </article>
          ))}
        </div>
      </section>
      <Dialog onOpenChange={setIsConfirmingReset} open={isConfirmingReset}>
        <DialogContent className="block w-[min(24rem,calc(100vw-32px))] rounded-lg border border-border-subtle bg-surface p-5 shadow-[0_18px_50px_color-mix(in_srgb,#000_26%,transparent)] ring-0" showCloseButton={false}>
          <div>
            <DialogTitle className="m-0 text-sm font-medium">{formatMessage({ id: 'shortcuts.resetAll.title' })}</DialogTitle>
            <p className="m-0 mt-1 text-[13px] text-text-tertiary">{formatMessage({ id: 'shortcuts.resetAll.description' })}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button className={shortcutButtonClass} onClick={() => setIsConfirmingReset(false)} type="button">{formatMessage({ id: 'shortcuts.cancel' })}</button>
              <button
                className={cn(shortcutButtonClass, 'bg-foreground text-background hover:bg-foreground')}
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
        </DialogContent>
      </Dialog>
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
    return <span className={cn(shortcutButtonClass, 'text-text-secondary hover:bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)]')}>{formatMessage({ id: 'shortcuts.recording' })}</span>;
  }

  return (
    <span className="relative">
      <button
        aria-label={isAddButton ? formatMessage({ id: 'shortcuts.add' }) : formatMessage({ id: 'shortcuts.edit' }, { command, index: index + 1 })}
        className={shortcutButtonClass}
        onClick={() => recorder.startRecording()}
        type="button"
      >
        {isAddButton ? formatMessage({ id: 'shortcuts.add' }) : formatForDisplay(value!)}
      </button>
      {error && <span className="absolute right-0 top-[calc(100%+4px)] z-[1] w-max max-w-[220px] text-xs text-destructive">{error}</span>}
    </span>
  );
}
