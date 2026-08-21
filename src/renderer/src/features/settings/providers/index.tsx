import type { ModelPickerScope, ProviderId, ProvidersSnapshot } from '../../../../../main/provider-settings';
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
    <div className="settings-view settings-provider-view">
      <section className="settings-content settings-provider-content" aria-labelledby="providers-settings-title">
        <div className="settings-provider-titlebar">
          <div>
            <h1 id="providers-settings-title">{formatMessage({ id: 'providers.title' })}</h1>
            <p className="settings-provider-description">{formatMessage({ id: 'providers.description' })}</p>
          </div>
          <label className="settings-provider-scope">
            <span>{formatMessage({ id: 'providers.scope' })}</span>
            <Select
              items={[
                { label: formatMessage({ id: 'providers.scope.primary' }), value: 'primary-provider' },
                { label: formatMessage({ id: 'providers.scope.all' }), value: 'all-providers' },
              ]}
              onValueChange={scope => void run('scope', async () => onSetScope(scope as ModelPickerScope).then(() => undefined))}
              value={snapshot.modelPickerScope}
            >
              <SelectTrigger aria-label={formatMessage({ id: 'providers.scope' })} className="settings-language-select">
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

        <div className="settings-provider-config">
          <aside className="settings-provider-nav" aria-label={formatMessage({ id: 'providers.title' })}>
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
