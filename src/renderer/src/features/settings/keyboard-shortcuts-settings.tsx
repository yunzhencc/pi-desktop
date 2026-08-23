import type { ShortcutBindings, ShortcutId } from '@renderer/features/app/shortcuts';
import { Button } from '@pi-desktop/shadcn-ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@pi-desktop/shadcn-ui/components/dialog';
import { Empty, EmptyHeader, EmptyTitle } from '@pi-desktop/shadcn-ui/components/empty';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@pi-desktop/shadcn-ui/components/input-group';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@pi-desktop/shadcn-ui/components/item';
import {
  findShortcutConflict,
  hasCustomShortcutBinding,
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
            <Button onClick={() => setIsConfirmingReset(true)} size="sm" variant="secondary">
              {formatMessage({ id: 'shortcuts.resetAll' })}
            </Button>
          )}
        </div>
        <div className="sticky top-0 z-10 -mx-8 bg-surface px-8 pt-6 pb-4">
          <InputGroup>
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={formatMessage({ id: 'shortcuts.search' })}
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
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label={formatMessage({ id: 'shortcuts.searchByKeystrokes' })}
                aria-pressed={isSearchingByKeystrokes}
                onClick={() => {
                  setIsSearchingByKeystrokes(searching => !searching);
                  setKeystrokeQuery('');
                }}
                size="icon-xs"
              >
                <Keyboard aria-hidden="true" />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
        {definitions.length === 0
          ? (
              <Empty className="border-0 py-12">
                <EmptyHeader>
                  <EmptyTitle>{formatMessage({ id: 'shortcuts.noMatches' })}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )
          : (
              <ItemGroup className="gap-0">
                {definitions.map(definition => (
                  <Item className="rounded-none border-x-0 border-t-0 border-b border-border-subtle px-0 py-4" key={definition.id}>
                    <ItemContent>
                      <ItemTitle>{formatMessage({ id: definition.title })}</ItemTitle>
                      <ItemDescription>{formatMessage({ id: definition.description })}</ItemDescription>
                    </ItemContent>
                    <ItemActions className="w-96 max-w-full flex-wrap justify-end">
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
                      {onReset && hasCustomShortcutBinding(bindings, definition.id) && <Button onClick={() => onReset(definition.id)} size="xs" variant="ghost">{formatMessage({ id: 'shortcuts.reset' })}</Button>}
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            )}
      </section>
      <Dialog onOpenChange={setIsConfirmingReset} open={isConfirmingReset}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{formatMessage({ id: 'shortcuts.resetAll.title' })}</DialogTitle>
            <DialogDescription>{formatMessage({ id: 'shortcuts.resetAll.description' })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setIsConfirmingReset(false)} variant="outline">{formatMessage({ id: 'shortcuts.cancel' })}</Button>
            <Button
              onClick={() => {
                onResetAll?.();
                setIsConfirmingReset(false);
              }}
            >
              {formatMessage({ id: 'shortcuts.resetAll' })}
            </Button>
          </DialogFooter>
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
    return <Button disabled size="xs" variant="outline">{formatMessage({ id: 'shortcuts.recording' })}</Button>;
  }

  return (
    <span className="relative">
      <Button
        aria-label={isAddButton ? formatMessage({ id: 'shortcuts.add' }) : formatMessage({ id: 'shortcuts.edit' }, { command, index: index + 1 })}
        onClick={() => recorder.startRecording()}
        size="xs"
        variant="outline"
      >
        {isAddButton ? formatMessage({ id: 'shortcuts.add' }) : formatForDisplay(value!)}
      </Button>
      {error && <span className="absolute right-0 top-[calc(100%+4px)] z-[1] w-max max-w-[220px] text-xs text-destructive">{error}</span>}
    </span>
  );
}
