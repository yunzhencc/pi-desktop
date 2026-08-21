import type { ProviderId, ProviderSnapshot } from '@shared/types';
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
      <div className="relative flex shrink-0 items-center px-3 pt-3 pb-1.5">
        <Search aria-hidden="true" className="pointer-events-none absolute left-[21px] z-[1] text-text-tertiary" size={15} strokeWidth={1.75} />
        <Input
          aria-label={formatMessage({ id: 'providers.search' })}
          className="[&::-webkit-search-cancel-button]:hidden h-[30px] border-transparent bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] ps-[30px] text-[13px] text-foreground shadow-none focus-visible:border-border-subtle focus-visible:shadow-none"
          onChange={event => setQuery(event.target.value)}
          placeholder={formatMessage({ id: 'providers.search.placeholder' })}
          type="search"
          value={query}
        />
      </div>
      <OverlayScrollbarsComponent
        className="min-h-0 flex-1 [&_[data-overlayscrollbars-viewport]]:min-h-0"
        options={{ scrollbars: { autoHide: 'leave', theme: overlayScrollbarsTheme } }}
      >
        <div className="flex flex-col gap-1.5 p-3">
          {providers.length === 0
            ? <p className="settings-provider-description m-0 text-sm text-text-tertiary">{empty}</p>
            : filteredProviders.length === 0
              ? <p className="settings-provider-description m-0 text-sm text-text-tertiary">{formatMessage({ id: 'providers.search.empty' })}</p>
              : filteredProviders.map(provider => (
                  <button
                    aria-current={selection === provider.id ? 'page' : undefined}
                    className="settings-provider-nav-item flex w-full min-w-0 items-center gap-[9px] rounded-md p-[7px] text-start text-foreground hover:bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] aria-[current=page]:bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)]"
                    key={provider.id}
                    onClick={() => onSelect(provider.id)}
                    type="button"
                  >
                    <ProviderMark provider={provider} />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium">{provider.name}</strong>
                      <small className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-text-tertiary">{provider.configured ? formatMessage({ id: 'providers.connected' }) : formatMessage({ id: 'providers.notConnected' })}</small>
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
