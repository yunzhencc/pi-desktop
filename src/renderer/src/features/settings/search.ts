export type SettingsPath = '/settings/general' | '/settings/appearance' | '/settings/keyboard-shortcuts' | '/settings/providers';

interface SettingsSearchTarget {
  messages: string[];
  panel: string;
  path: SettingsPath;
}

export interface SettingsSearchResult {
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
    messages: ['providers.title', 'providers.chatgpt.login', 'providers.scope', 'DeepSeek', 'OpenCode'],
    panel: 'providers.title',
    path: '/settings/providers',
  },
];

export function searchSettings(query: string, formatMessage: (descriptor: { id: string }) => string): SettingsSearchResult[] {
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

export function fuzzyScore(value: string, query: string) {
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
