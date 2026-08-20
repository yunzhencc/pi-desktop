import type { AppearanceTheme } from '../../types';
import { useTheme } from 'next-themes';
import { useIntl } from 'react-intl';
import { readAppearanceTheme } from '../../utils';

const themeOptions: AppearanceTheme[] = ['system', 'light', 'dark'];

export function ToggleTheme() {
  const { formatMessage } = useIntl();
  const { setTheme, theme } = useTheme();

  const appearanceTheme = readAppearanceTheme(theme ?? 'system');

  return (
    <div aria-label={formatMessage({ id: 'settings.theme' })} className="settings-theme-options" role="radiogroup">
      {themeOptions.map(value => (
        <label className="settings-theme-option" key={value}>
          <input
            aria-label={formatMessage({ id: `appearance.${value}` })}
            checked={appearanceTheme === value}
            name="appearance-theme"
            onChange={() => setTheme(value)}
            type="radio"
          />
          <ThemePreview mode={value} selected={appearanceTheme === value} />
          <span>{formatMessage({ id: `appearance.${value}` })}</span>
        </label>
      ))}
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
