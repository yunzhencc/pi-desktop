import type { AppLocale } from '@renderer/features/i18n';
import type { AppearanceTheme } from './appearance-settings';
import { Input } from '@pi-desktop/shadcn-ui/components/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pi-desktop/shadcn-ui/components/select';
import { useShortcutSettings } from '@renderer/features/hotkeys';
import { useHotkeys } from '@tanstack/react-hotkeys';
import { ArrowLeft, Bot, Keyboard, Search, Settings, Sun, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';

interface SettingsViewProps {
  onThemeChange: (theme: AppearanceTheme) => void;
  theme: AppearanceTheme;
}

const themeOptions: AppearanceTheme[] = ['system', 'light', 'dark'];

export type SettingsPath = '/settings/general' | '/settings/appearance' | '/settings/keyboard-shortcuts' | '/settings/providers';

interface SettingsSearchTarget {
  messages: string[];
  panel: string;
  path: SettingsPath;
}

interface SettingsSearchResult {
  label: string;
  panel: string;
  path: SettingsPath;
  priority: number;
  score: number;
}

const settingsSearchTargets: SettingsSearchTarget[] = [
  {
    messages: ['settings.language', 'settings.chinese', 'settings.english'],
    panel: 'settings.general',
    path: '/settings/general',
  },
  {
    messages: ['settings.theme', 'appearance.system', 'appearance.light', 'appearance.dark'],
    panel: 'settings.appearance',
    path: '/settings/appearance',
  },
  {
    messages: ['shortcuts.title', 'shortcut.newConversation.title', 'shortcut.toggleSidebar.title', 'shortcut.openSettings.title', 'shortcut.toggleSessionPin.title'],
    panel: 'shortcuts.title',
    path: '/settings/keyboard-shortcuts',
  },
  {
    messages: ['providers.title', 'providers.deepseek.title'],
    panel: 'providers.title',
    path: '/settings/providers',
  },
];

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
    <nav className="settings-navigation" aria-label={formatMessage({ id: 'settings.navigation' })}>
      <button className="settings-back-button" onClick={onClose} type="button">
        <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.75} />
        {formatMessage({ id: 'settings.backToApp' })}
      </button>
      <div className="settings-search">
        <Search aria-hidden="true" className="settings-search-icon" size={16} strokeWidth={1.75} />
        <Input
          aria-label={formatMessage({ id: 'settings.search.label' })}
          className="settings-search-input"
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
            className="settings-search-clear"
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
              <div className="settings-navigation-title">{formatMessage({ id: 'settings.settings' })}</div>
              <button
                aria-current={activePath === '/settings/general' ? 'page' : undefined}
                className="settings-navigation-item"
                onClick={() => onNavigate('/settings/general')}
                type="button"
              >
                <Settings aria-hidden="true" size={16} strokeWidth={1.75} />
                {formatMessage({ id: 'settings.general' })}
              </button>
              <button
                aria-current={activePath === '/settings/appearance' ? 'page' : undefined}
                className="settings-navigation-item"
                onClick={() => onNavigate('/settings/appearance')}
                type="button"
              >
                <Sun aria-hidden="true" size={16} strokeWidth={1.75} />
                {formatMessage({ id: 'settings.appearance' })}
              </button>
              <button
                aria-current={activePath === '/settings/keyboard-shortcuts' ? 'page' : undefined}
                className="settings-navigation-item"
                onClick={() => onNavigate('/settings/keyboard-shortcuts')}
                type="button"
              >
                <Keyboard aria-hidden="true" size={16} strokeWidth={1.75} />
                {formatMessage({ id: 'shortcuts.title' })}
              </button>
              <button
                aria-current={activePath === '/settings/providers' ? 'page' : undefined}
                className="settings-navigation-item"
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
    return <div className="settings-search-empty">{formatMessage({ id: 'settings.search.empty' })}</div>;
  }

  return (
    <div className="settings-search-results">
      {results.map((result, index) => (
        <button
          aria-label={formatMessage({ id: 'settings.search.result' }, { label: result.label, panel: result.panel })}
          className="settings-search-result"
          data-highlighted={highlightedIndex === index || undefined}
          key={result.path}
          onClick={() => onNavigate(result.path)}
          onFocus={() => onHighlight(index)}
          onPointerEnter={() => onHighlight(index)}
          type="button"
        >
          <span>{result.label}</span>
          {result.label !== result.panel && <span className="settings-search-result-panel">{result.panel}</span>}
        </button>
      ))}
    </div>
  );
}

function searchSettings(query: string, formatMessage: (descriptor: { id: string }) => string): SettingsSearchResult[] {
  const terms = query.trim().split(/\s+/).filter(Boolean);

  if (terms.length === 0) {
    return [];
  }

  return settingsSearchTargets.flatMap((target, index) => {
    const panel = formatMessage({ id: target.panel });
    const panelScore = fuzzyScore(panel, query);

    if (panelScore > 0) {
      return [{ label: panel, panel, path: target.path, priority: 0, score: panelScore, index }];
    }

    const messages = target.messages.map(id => formatMessage({ id }));
    const matches = messages
      .filter(message => terms.every(term => fuzzyScore(panel, term) > 0 || contentScore(message, term) > 0))
      .map(message => ({ label: message, score: terms.reduce((score, term) => score * Math.max(fuzzyScore(panel, term), contentScore(message, term)), 1) }));
    const match = matches.sort((left, right) => right.score - left.score)[0];

    return match ? [{ ...match, panel, path: target.path, priority: 1, index }] : [];
  })
    .sort((left, right) => left.priority - right.priority || right.score - left.score || left.index - right.index)
    .map(({ index: _, ...result }) => result);
}

function contentScore(value: string, term: string) {
  return value.toLocaleLowerCase().includes(term.toLocaleLowerCase()) ? fuzzyScore(value, term) : 0;
}

function fuzzyScore(value: string, query: string) {
  const normalizedValue = value.toLocaleLowerCase();
  const normalizedQuery = query.toLocaleLowerCase();
  const directIndex = normalizedValue.indexOf(normalizedQuery);

  if (directIndex !== -1) {
    return normalizedQuery.length * 100 - directIndex;
  }

  let offset = 0;
  let score = 0;

  for (const character of normalizedQuery) {
    const index = normalizedValue.indexOf(character, offset);

    if (index === -1) {
      return 0;
    }

    score += 10 - Math.min(index - offset, 9);
    offset = index + 1;
  }

  return score;
}

export function SettingsView({ onThemeChange, theme }: SettingsViewProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="settings-view">
      <section className="settings-content" aria-labelledby="appearance-settings-title">
        <h1 id="appearance-settings-title">{formatMessage({ id: 'settings.appearance' })}</h1>
        <div className="settings-section">
          <h2>{formatMessage({ id: 'settings.theme' })}</h2>
          <div aria-label={formatMessage({ id: 'settings.theme' })} className="settings-theme-options" role="radiogroup">
            {themeOptions.map(value => (
              <label className="settings-theme-option" key={value}>
                <input
                  aria-label={formatMessage({ id: `appearance.${value}` })}
                  checked={theme === value}
                  name="appearance-theme"
                  onChange={() => onThemeChange(value)}
                  type="radio"
                />
                <ThemePreview mode={value} selected={theme === value} />
                <span>{formatMessage({ id: `appearance.${value}` })}</span>
              </label>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

interface GeneralSettingsViewProps {
  locale: AppLocale;
  onLocaleChange: (locale: AppLocale) => void;
}

export function GeneralSettingsView({ locale, onLocaleChange }: GeneralSettingsViewProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="settings-view">
      <section className="settings-content" aria-labelledby="general-settings-title">
        <h1 id="general-settings-title">{formatMessage({ id: 'settings.general' })}</h1>
        <div className="settings-section">
          <h2>{formatMessage({ id: 'settings.language' })}</h2>
          <label className="settings-field">
            <span>{formatMessage({ id: 'settings.language' })}</span>
            <Select
              items={[
                { label: formatMessage({ id: 'settings.chinese' }), value: 'zh-CN' },
                { label: formatMessage({ id: 'settings.english' }), value: 'en' },
              ]}
              onValueChange={value => onLocaleChange(value as AppLocale)}
              value={locale}
            >
              <SelectTrigger aria-label={formatMessage({ id: 'settings.language' })} className="settings-language-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" alignItemWithTrigger={false}>
                <SelectGroup>
                  <SelectItem value="zh-CN">{formatMessage({ id: 'settings.chinese' })}</SelectItem>
                  <SelectItem value="en">{formatMessage({ id: 'settings.english' })}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
        </div>
      </section>
    </div>
  );
}

function ThemePreview({ mode, selected }: { mode: AppearanceTheme; selected: boolean }) {
  const preview = mode === 'light'
    ? <LightThemePreview />
    : mode === 'dark'
      ? <DarkThemePreview />
      : <SystemThemePreview />;

  return (
    <span
      aria-hidden="true"
      className="settings-theme-preview"
      data-selected={selected}
      data-testid={`theme-preview-${mode}`}
      data-theme={mode}
    >
      {preview}
    </span>
  );
}

function LightThemePreview() {
  return (
    <svg className="settings-theme-preview-art" viewBox="0 0 170 120" xmlns="http://www.w3.org/2000/svg">
      <path d="M49 26h72a3 3 0 1 0 0 6H49a3 3 0 0 0 0-6Z" fill="#cdcdcd" />
      <path d="M28 35h114a2 2 0 1 0 0 4H28a2 2 0 0 0 0-4Z" fill="#dfdfdf" />
      <path d="M15 52a8 8 0 0 1 8-8h124a8 8 0 0 1 8 8v68H15V52Z" fill="#fff" />
      <path d="M22 59a3 3 0 0 1 3-3h39a3 3 0 0 1 0 6H25a3 3 0 0 1-3-3Z" fill="#dfdfdf" />
      <path d="M22 67h65v2H22zM15 76h140v1H15z" fill="#f3f3f3" />
      <path d="M22 83a3 3 0 0 1 3-3h39a3 3 0 0 1 0 6H25a3 3 0 0 1-3-3Z" fill="#dfdfdf" />
      <path d="M22 91h65v2H22zM15 100h140v1H15z" fill="#f3f3f3" />
      <path d="M22 107a3 3 0 0 1 3-3h39a3 3 0 0 1 0 6H25a3 3 0 0 1-3-3Z" fill="#dfdfdf" />
      <path d="M22 115h65v2H22z" fill="#f3f3f3" />
    </svg>
  );
}

function DarkThemePreview() {
  return (
    <svg className="settings-theme-preview-art" viewBox="0 0 170 120" xmlns="http://www.w3.org/2000/svg">
      <path d="M49 26h72a3 3 0 1 0 0 6H49a3 3 0 0 0 0-6Z" fill="#9f9f9f" />
      <path d="M28 35h114a2 2 0 1 0 0 4H28a2 2 0 0 0 0-4Z" fill="#8f8f8f" />
      <path d="M15 52a8 8 0 0 1 8-8h124a8 8 0 0 1 8 8v68H15V52Z" fill="#fff" />
      <path d="M22 59a3 3 0 0 1 3-3h39a3 3 0 0 1 0 6H25a3 3 0 0 1-3-3Z" fill="#dfdfdf" />
      <path d="M22 67h65v2H22zM15 76h140v1H15z" fill="#f3f3f3" />
      <path d="M22 83a3 3 0 0 1 3-3h39a3 3 0 0 1 0 6H25a3 3 0 0 1-3-3Z" fill="#dfdfdf" />
      <path d="M22 91h65v2H22zM15 100h140v1H15z" fill="#f3f3f3" />
      <path d="M22 107a3 3 0 0 1 3-3h39a3 3 0 0 1 0 6H25a3 3 0 0 1-3-3Z" fill="#dfdfdf" />
      <path d="M22 115h65v2H22z" fill="#f3f3f3" />
    </svg>
  );
}

function SystemThemePreview() {
  return (
    <svg className="settings-theme-preview-art" viewBox="0 0 170 120" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="system-preview-sheet">
          <path d="M7 42a8 8 0 0 1 8-8h140a8 8 0 0 1 8 8v78H7V42Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#system-preview-sheet)">
        <path d="M7 34h78v86H7z" fill="#f3f3f3" />
        <path d="M85 34h78v86H85z" fill="#393939" />
        <path d="M73 59h12v6H73a3 3 0 0 1 0-6Z" fill="#cdcdcd" />
        <path d="M85 59h9a3 3 0 0 1 0 6h-9Z" fill="#767676" />
        <path d="M53 68h32v3H53z" fill="#dfdfdf" />
        <path d="M85 68h32v3H85z" fill="#8f8f8f" />
        <path d="M26 84a7 7 0 0 1 7-7h52v43H26V84Z" fill="#fff" />
        <path d="M85 77h52a7 7 0 0 1 7 7v36H85V77Z" fill="#4f4f4f" />
        <path d="M32 88a3 3 0 0 1 3-3h29a3 3 0 0 1 0 6H35a3 3 0 0 1-3-3Z" fill="#dfdfdf" />
        <path d="M103 88a3 3 0 0 1 3-3h29a3 3 0 0 1 0 6h-29a3 3 0 0 1-3-3Z" fill="#767676" />
        <path d="M32 96h53v2H32zM26 105h59v1H26z" fill="#f3f3f3" />
        <path d="M85 96h53v2H85zM85 105h59v1H85z" fill="#767676" />
        <path d="M32 114a3 3 0 0 1 3-3h29a3 3 0 0 1 0 6H35a3 3 0 0 1-3-3Z" fill="#dfdfdf" />
        <path d="M103 114a3 3 0 0 1 3-3h29a3 3 0 0 1 0 6h-29a3 3 0 0 1-3-3Z" fill="#767676" />
      </g>
    </svg>
  );
}
