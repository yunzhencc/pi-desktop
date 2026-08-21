import type { ModelPickerScope, ProviderId, ProvidersSnapshot } from '@shared/types';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pi-desktop/shadcn-ui/components/select';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import { PROVIDER_ERROR_CHATGPT_UNSUPPORTED_REGION } from '../../../../../shared/provider-errors';
import { ProviderDetail, ProviderNavList } from './components';

interface ProvidersSettingsViewProps {
  onLoginChatGPT: () => Promise<ProvidersSnapshot>;
  onRemove: (providerId: ProviderId) => Promise<ProvidersSnapshot>;
  onSaveApiKey: (providerId: ProviderId, apiKey: string) => Promise<ProvidersSnapshot>;
  onSetDefaultModel: (providerId: ProviderId, modelId: string) => Promise<ProvidersSnapshot>;
  onSetPrimaryProvider: (providerId: ProviderId) => Promise<ProvidersSnapshot>;
  onSetScope: (scope: ModelPickerScope) => Promise<ProvidersSnapshot>;
  snapshot: ProvidersSnapshot;
}

export function ProvidersSettingsView({
  onLoginChatGPT,
  onRemove,
  onSaveApiKey,
  onSetDefaultModel,
  onSetPrimaryProvider,
  onSetScope,
  snapshot,
}: ProvidersSettingsViewProps) {
  const { formatMessage } = useIntl();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [selection, setSelection] = useState<ProviderId | undefined>(snapshot.connectedProviders[0]?.id ?? snapshot.availableProviders[0]?.id);
  const connectedProviderIds = new Set(snapshot.connectedProviders.map(provider => provider.id));
  const connectableProviders = snapshot.availableProviders.filter(provider => !provider.configured && !connectedProviderIds.has(provider.id));
  const selectedProvider = snapshot.connectedProviders.find(provider => provider.id === selection)
    ?? connectableProviders.find(provider => provider.id === selection)
    ?? snapshot.connectedProviders[0]
    ?? connectableProviders[0];

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError(undefined);
    try {
      await action();
    }
    catch (error) {
      setError(providerErrorMessage(error, formatMessage));
    }
    finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="settings-provider-view h-full min-h-0 overflow-hidden pt-[46px]">
      <section className="mx-auto box-border flex h-full w-full max-w-[58rem] min-w-0 flex-col px-8 pt-[22px] pb-6" aria-labelledby="providers-settings-title">
        <div className="flex items-start justify-between gap-4 max-[760px]:flex-col">
          <div>
            <h1 id="providers-settings-title" className="m-0 text-xl font-semibold">{formatMessage({ id: 'providers.title' })}</h1>
            <p className="settings-provider-description mt-2 m-0 text-sm text-text-tertiary">{formatMessage({ id: 'providers.description' })}</p>
          </div>
          <label className="flex min-w-52 flex-col items-end gap-2 text-xs text-text-tertiary">
            <span>{formatMessage({ id: 'providers.scope' })}</span>
            <Select
              items={[
                { label: formatMessage({ id: 'providers.scope.primary' }), value: 'primary-provider' },
                { label: formatMessage({ id: 'providers.scope.all' }), value: 'all-providers' },
              ]}
              onValueChange={scope => void run('scope', async () => onSetScope(scope as ModelPickerScope).then(() => undefined))}
              value={snapshot.modelPickerScope}
            >
              <SelectTrigger aria-label={formatMessage({ id: 'providers.scope' })} className="min-w-32 bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] font-inherit text-inherit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start" alignItemWithTrigger={false}>
                <SelectGroup>
                  <SelectItem value="primary-provider">{formatMessage({ id: 'providers.scope.primary' })}</SelectItem>
                  <SelectItem value="all-providers">{formatMessage({ id: 'providers.scope.all' })}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
        </div>

        <div className="mt-7 flex min-h-0 flex-1 items-stretch gap-4 overflow-hidden rounded-md border border-border-subtle bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] max-[760px]:flex-col">
          <aside className="settings-provider-nav flex min-h-0 w-60 basis-60 flex-col border-e border-border-subtle bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] max-[760px]:min-h-48 max-[760px]:w-auto max-[760px]:basis-auto max-[760px]:border-e-0 max-[760px]:border-b" aria-label={formatMessage({ id: 'providers.title' })}>
            <ProviderNavList
              empty={formatMessage({ id: 'providers.empty' })}
              providers={[...snapshot.connectedProviders, ...connectableProviders]}
              selection={selectedProvider?.id}
              onSelect={setSelection}
            />
          </aside>

          {selectedProvider && (
            <ProviderDetail
              busy={busy}
              defaultModel={snapshot.defaultModel}
              error={error}
              onLoginChatGPT={() => run('login-openai-codex', async () => onLoginChatGPT().then(next => setSelection(next.connectedProviders.find(provider => provider.id === 'openai-codex')?.id ?? selectedProvider.id)))}
              onRemove={selectedProvider.authType === 'api_key' ? () => run(`remove-${selectedProvider.id}`, async () => onRemove(selectedProvider.id).then(() => undefined)) : undefined}
              onSaveApiKey={selectedProvider.authType === 'api_key' ? apiKey => run(`save-${selectedProvider.id}`, async () => onSaveApiKey(selectedProvider.id, apiKey).then(next => setSelection(next.connectedProviders.find(provider => provider.id === selectedProvider.id)?.id ?? selectedProvider.id))) : undefined}
              onSetDefaultModel={modelId => run(`model-${selectedProvider.id}`, async () => onSetDefaultModel(selectedProvider.id, modelId).then(() => undefined))}
              onSetPrimaryProvider={() => run(`primary-${selectedProvider.id}`, async () => onSetPrimaryProvider(selectedProvider.id).then(() => undefined))}
              provider={selectedProvider}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function providerErrorMessage(error: unknown, formatMessage: ReturnType<typeof useIntl>['formatMessage']) {
  const message = error instanceof Error ? error.message : '';
  if (message.includes(PROVIDER_ERROR_CHATGPT_UNSUPPORTED_REGION))
    return formatMessage({ id: PROVIDER_ERROR_CHATGPT_UNSUPPORTED_REGION });
  return stripIpcErrorMessage(message) || formatMessage({ id: 'providers.error.generic' });
}

function stripIpcErrorMessage(message: string) {
  return message.replace(/^Error invoking remote method '[^']+': Error: /, '').trim();
}
