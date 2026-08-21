import type { SettingsPath, SettingsSearchResult } from '../../search';
import { Input } from '@pi-desktop/shadcn-ui/components/input';
import { cn } from '@pi-desktop/shadcn-ui/lib/utils';
import { useShortcutSettings } from '@renderer/features/app/hotkeys';
import { useHotkeys } from '@tanstack/react-hotkeys';
import { ArrowLeft, Bot, Keyboard, Search, Settings, Sun, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { searchSettings } from '../../search';

const navigationButtonClass = 'flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-medium text-text-secondary hover:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] hover:text-foreground aria-[current=page]:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] aria-[current=page]:text-foreground';

interface SettingsSidebarProps {
  activePath: string;
  onClose: () => void;
  onNavigate: (path: SettingsPath) => void;
}

export function SettingsSidebar({ activePath, onClose, onNavigate }: SettingsSidebarProps) {
  const { formatMessage } = useIntl();
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { bindings } = useShortcutSettings();
  const results = useMemo(() => searchSettings(query, formatMessage), [formatMessage, query]);
  const focusSearch = () => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  };

  useHotkeys(bindings.focusSettingsSearch.map(hotkey => ({ callback: focusSearch, hotkey })), { ignoreInputs: true, preventDefault: true });

  return (
    <nav className="flex h-full flex-col px-3 pt-12 pb-[18px]" aria-label={formatMessage({ id: 'settings.navigation' })}>
      <button className="flex h-8 w-full items-center gap-2 rounded-md bg-transparent px-2 text-left text-sm font-normal text-text-tertiary hover:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] hover:text-foreground" onClick={onClose} type="button">
        <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.75} />
        {formatMessage({ id: 'settings.backToApp' })}
      </button>
      <div className="relative mt-3 flex items-center">
        <Search aria-hidden="true" className="pointer-events-none absolute left-[9px] z-[1] text-text-tertiary" size={16} strokeWidth={1.75} />
        <Input
          aria-label={formatMessage({ id: 'settings.search.label' })}
          className="[&::-webkit-search-cancel-button]:hidden h-[30px] border-transparent bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] ps-[30px] pe-7 text-[13px] text-foreground shadow-none focus-visible:border-border-subtle focus-visible:shadow-none"
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlightedIndex(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setQuery('');
              setHighlightedIndex(-1);
            }
            else if (event.key === 'ArrowDown' && results.length > 0) {
              event.preventDefault();
              setHighlightedIndex(index => Math.min(index + 1, results.length - 1));
            }
            else if (event.key === 'ArrowUp' && results.length > 0) {
              event.preventDefault();
              setHighlightedIndex(index => Math.max(index - 1, 0));
            }
            else if (event.key === 'Enter' && highlightedIndex >= 0) {
              onNavigate(results[highlightedIndex].path);
            }
          }}
          placeholder={formatMessage({ id: 'settings.search.placeholder' })}
          ref={searchInputRef}
          type="search"
          value={query}
        />
        {query && (
          <button
            aria-label={formatMessage({ id: 'settings.search.clear' })}
            className="absolute right-[7px] z-[1] grid size-5 place-items-center rounded-sm p-0 text-text-tertiary hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] hover:text-foreground"
            onClick={() => {
              setQuery('');
              setHighlightedIndex(-1);
            }}
            type="button"
          >
            <X aria-hidden="true" size={14} strokeWidth={1.75} />
          </button>
        )}
      </div>
      {query.trim()
        ? <SettingsSearchResults highlightedIndex={highlightedIndex} onHighlight={setHighlightedIndex} onNavigate={onNavigate} results={results} />
        : (
            <>
              <div className="px-2 pt-4 pb-2 text-sm font-normal text-text-tertiary">{formatMessage({ id: 'settings.settings' })}</div>
              <button
                aria-current={activePath === '/settings/general' ? 'page' : undefined}
                className={navigationButtonClass}
                onClick={() => onNavigate('/settings/general')}
                type="button"
              >
                <Settings aria-hidden="true" size={16} strokeWidth={1.75} />
                {formatMessage({ id: 'settings.general' })}
              </button>
              <button
                aria-current={activePath === '/settings/appearance' ? 'page' : undefined}
                className={cn(navigationButtonClass, 'mt-px')}
                onClick={() => onNavigate('/settings/appearance')}
                type="button"
              >
                <Sun aria-hidden="true" size={16} strokeWidth={1.75} />
                {formatMessage({ id: 'settings.appearance' })}
              </button>
              <button
                aria-current={activePath === '/settings/keyboard-shortcuts' ? 'page' : undefined}
                className={cn(navigationButtonClass, 'mt-px')}
                onClick={() => onNavigate('/settings/keyboard-shortcuts')}
                type="button"
              >
                <Keyboard aria-hidden="true" size={16} strokeWidth={1.75} />
                {formatMessage({ id: 'shortcuts.title' })}
              </button>
              <button
                aria-current={activePath === '/settings/providers' ? 'page' : undefined}
                className={cn(navigationButtonClass, 'mt-px')}
                onClick={() => onNavigate('/settings/providers')}
                type="button"
              >
                <Bot aria-hidden="true" size={16} strokeWidth={1.75} />
                {formatMessage({ id: 'providers.title' })}
              </button>
            </>
          )}
    </nav>
  );
}

function SettingsSearchResults({ highlightedIndex, onHighlight, onNavigate, results }: {
  highlightedIndex: number;
  onHighlight: (index: number) => void;
  onNavigate: (path: SettingsPath) => void;
  results: SettingsSearchResult[];
}) {
  const { formatMessage } = useIntl();

  if (results.length === 0) {
    return <div className="px-2 py-3 text-xs text-text-tertiary">{formatMessage({ id: 'settings.search.empty' })}</div>;
  }

  return (
    <div className="mt-3 flex flex-col gap-0.5">
      {results.map((result, index) => (
        <button
          aria-label={formatMessage({ id: 'settings.search.result' }, { label: result.label, panel: result.panel })}
          className="flex min-h-[34px] w-full flex-col items-start rounded-md px-2 py-[5px] text-left text-[13px] text-foreground hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] focus-visible:outline-none data-[highlighted=true]:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]"
          data-highlighted={highlightedIndex === index || undefined}
          key={result.path}
          onClick={() => onNavigate(result.path)}
          onFocus={() => onHighlight(index)}
          onPointerEnter={() => onHighlight(index)}
          type="button"
        >
          <span>{result.label}</span>
          {result.label !== result.panel && <span className="text-xs text-text-tertiary">{result.panel}</span>}
        </button>
      ))}
    </div>
  );
}
