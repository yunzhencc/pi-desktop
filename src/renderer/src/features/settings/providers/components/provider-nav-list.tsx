import type { ProviderId, ProviderSnapshot } from '../../../../../../main/provider-settings';
import { Input } from '@pi-desktop/shadcn-ui/components/input';
import { useOverlayScrollbarsTheme } from '@renderer/features/app/theme';
import { Search } from 'lucide-react';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import { ProviderMark } from './provider-mark';

export function ProviderNavList({
  empty,
  onSelect,
  providers,
  selection,
}: {
  empty?: string;
  onSelect: (providerId: ProviderId) => void;
  providers: ProviderSnapshot[];
  selection?: ProviderId;
}) {
  const { formatMessage } = useIntl();
  const overlayScrollbarsTheme = useOverlayScrollbarsTheme();
  const [query, setQuery] = useState('');
  const filteredProviders = providers.filter(provider => matchesProviderQuery(provider, query));

  return (
    <>
      <div className="settings-provider-search">
        <Search aria-hidden="true" className="settings-provider-search-icon" size={15} strokeWidth={1.75} />
        <Input
          aria-label={formatMessage({ id: 'providers.search' })}
          className="settings-provider-search-input"
          onChange={event => setQuery(event.target.value)}
          placeholder={formatMessage({ id: 'providers.search.placeholder' })}
          type="search"
          value={query}
        />
      </div>
      <OverlayScrollbarsComponent
        className="settings-provider-nav-scroll"
        options={{ scrollbars: { autoHide: 'leave', theme: overlayScrollbarsTheme } }}
      >
        <div className="settings-provider-nav-list">
          {providers.length === 0
            ? <p className="settings-provider-description">{empty}</p>
            : filteredProviders.length === 0
              ? <p className="settings-provider-description">{formatMessage({ id: 'providers.search.empty' })}</p>
              : filteredProviders.map(provider => (
                  <button
                    aria-current={selection === provider.id ? 'page' : undefined}
                    className="settings-provider-nav-item"
                    key={provider.id}
                    onClick={() => onSelect(provider.id)}
                    type="button"
                  >
                    <ProviderMark provider={provider} />
                    <span>
                      <strong>{provider.name}</strong>
                      <small>{provider.configured ? formatMessage({ id: 'providers.connected' }) : formatMessage({ id: 'providers.notConnected' })}</small>
                    </span>
                  </button>
                ))}
        </div>
      </OverlayScrollbarsComponent>
    </>
  );
}

function matchesProviderQuery(provider: ProviderSnapshot, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery)
    return true;

  return fuzzyIncludes(`${provider.name} ${provider.id}`.toLocaleLowerCase(), normalizedQuery);
}

function fuzzyIncludes(value: string, query: string) {
  let cursor = 0;
  for (const char of query) {
    cursor = value.indexOf(char, cursor);
    if (cursor === -1)
      return false;
    cursor += 1;
  }
  return true;
}
