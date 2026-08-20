import { useTheme } from 'next-themes';

export function useOverlayScrollbarsTheme() {
  const { resolvedTheme } = useTheme();

  return resolvedTheme === 'dark' ? 'os-theme-dark' : 'os-theme-light';
}
