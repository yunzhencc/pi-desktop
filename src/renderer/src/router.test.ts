import { createMemoryHistory } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { createAppRouter, settingsAppearancePath } from './router';

describe('app routes', () => {
  it('builds the Appearance settings route', () => {
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }));

    expect(settingsAppearancePath).toBe('/settings/appearance');
    expect(router.buildLocation({ to: settingsAppearancePath }).pathname).toBe(settingsAppearancePath);
  });
});
