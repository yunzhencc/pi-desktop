import type { FormEvent } from 'react';
import type { ModelPickerScope, ProviderId, ProviderSnapshot, ProvidersSnapshot } from '../../../../../main/provider-settings';
import DeepSeekIcon from '@lobehub/icons/es/DeepSeek/components/Color.js';
import OpenAIIcon from '@lobehub/icons/es/OpenAI/components/Mono.js';
import OpenCodeIcon from '@lobehub/icons/es/OpenCode/components/Mono.js';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pi-desktop/shadcn-ui/components/select';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

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
  const [selection, setSelection] = useState<ProviderId | undefined>(snapshot.connectedProviders[0]?.id ?? snapshot.availableProviders[0]?.id);
  const connectableProviders = snapshot.availableProviders.filter(provider => !provider.configured);
  const selectedProvider = snapshot.connectedProviders.find(provider => provider.id === selection)
    ?? connectableProviders.find(provider => provider.id === selection)
    ?? snapshot.connectedProviders[0]
    ?? connectableProviders[0];

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    try {
      await action();
    }
    finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="settings-view">
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
            <ProviderNavSection
              empty={formatMessage({ id: 'providers.empty' })}
              providers={snapshot.connectedProviders}
              selection={selectedProvider?.id}
              title={formatMessage({ id: 'providers.connectedList' })}
              onSelect={setSelection}
            />
            <ProviderNavSection
              providers={connectableProviders}
              selection={selectedProvider?.id}
              title={formatMessage({ id: 'providers.availableList' })}
              onSelect={setSelection}
            />
          </aside>

          {selectedProvider && (
            <ProviderDetail
              busy={busy}
              defaultModel={snapshot.defaultModel}
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

function ProviderNavSection({
  empty,
  onSelect,
  providers,
  selection,
  title,
}: {
  empty?: string;
  onSelect: (providerId: ProviderId) => void;
  providers: ProviderSnapshot[];
  selection?: ProviderId;
  title: string;
}) {
  const { formatMessage } = useIntl();

  return (
    <div className="settings-provider-nav-section">
      <div className="settings-provider-nav-title">{title}</div>
      {providers.length === 0
        ? <p className="settings-provider-description">{empty}</p>
        : providers.map(provider => (
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
  );
}

function ProviderDetail({
  busy,
  defaultModel,
  onLoginChatGPT,
  onRemove,
  onSaveApiKey,
  onSetDefaultModel,
  onSetPrimaryProvider,
  provider,
}: {
  busy?: string;
  defaultModel?: ProvidersSnapshot['defaultModel'];
  onLoginChatGPT: () => void;
  onRemove?: () => void;
  onSaveApiKey?: (apiKey: string) => void;
  onSetDefaultModel: (modelId: string) => void;
  onSetPrimaryProvider: () => void;
  provider: ProviderSnapshot;
}) {
  const { formatMessage } = useIntl();
  const selectedModel = defaultModel?.providerId === provider.id ? defaultModel.modelId : provider.models[0]?.id;

  return (
    <article className="settings-provider-detail">
      <header className="settings-provider-detail-header">
        <ProviderMark provider={provider} />
        <div>
          <h2>{provider.name}</h2>
          <p className="settings-provider-status">
            {provider.configured ? formatMessage({ id: 'providers.connected' }) : formatMessage({ id: 'providers.notConnected' })}
            {provider.primary ? ` · ${formatMessage({ id: 'providers.primary' })}` : ''}
          </p>
        </div>
      </header>

      <div className="settings-provider-detail-section">
        <div className="settings-provider-nav-title">{formatMessage({ id: 'providers.auth' })}</div>
        {provider.authType === 'oauth'
          ? <button disabled={busy === 'login-openai-codex'} onClick={onLoginChatGPT} type="button">{formatMessage({ id: 'providers.chatgpt.login' })}</button>
          : onSaveApiKey && <ApiKeyForm buttonLabel={formatMessage({ id: provider.configured ? 'providers.apiKey.update' : 'providers.connect' })} disabled={busy === `save-${provider.id}`} onSubmit={onSaveApiKey} />}
        {provider.authType === 'api_key' && provider.configured && onRemove && (
          <button className="settings-provider-danger" disabled={busy === `remove-${provider.id}`} onClick={onRemove} type="button">
            {formatMessage({ id: 'providers.remove' })}
          </button>
        )}
      </div>

      <div className="settings-provider-detail-section">
        <div className="settings-provider-nav-title">{formatMessage({ id: 'providers.modelSettings' })}</div>
        {!provider.primary && (
          <button disabled={!provider.configured || busy === `primary-${provider.id}`} onClick={onSetPrimaryProvider} type="button">{formatMessage({ id: 'providers.setPrimary' })}</button>
        )}
        {provider.models.length > 0 && selectedModel
          ? (
              <label className="settings-provider-field">
                <span>{formatMessage({ id: 'providers.defaultModel' })}</span>
                <Select
                  items={provider.models.map(model => ({ label: model.name, value: model.id }))}
                  onValueChange={onSetDefaultModel}
                  value={selectedModel}
                >
                  <SelectTrigger aria-label={`${provider.name} ${formatMessage({ id: 'providers.defaultModel' })}`} className="settings-language-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start" alignItemWithTrigger={false}>
                    <SelectGroup>
                      {provider.models.map(model => <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </label>
            )
          : <p className="settings-provider-description">{formatMessage({ id: 'providers.noModels' })}</p>}
      </div>
    </article>
  );
}

function ProviderMark({ provider }: { provider: ProviderSnapshot }) {
  const Icon = {
    'deepseek': DeepSeekIcon,
    'openai-codex': OpenAIIcon,
    'opencode': OpenCodeIcon,
  }[provider.id];

  return (
    <span className="settings-provider-mark" data-provider={provider.id}>
      <Icon size={16} title={provider.name} />
    </span>
  );
}

function ApiKeyForm({ buttonLabel, disabled, onSubmit }: { buttonLabel: string; disabled: boolean; onSubmit: (apiKey: string) => void }) {
  const { formatMessage } = useIntl();
  const [apiKey, setApiKey] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(apiKey);
    setApiKey('');
  }

  return (
    <form className="settings-provider-form" onSubmit={submit}>
      <label className="settings-provider-field">
        <span>{formatMessage({ id: 'providers.apiKey' })}</span>
        <input aria-label={formatMessage({ id: 'providers.apiKey' })} onChange={event => setApiKey(event.target.value)} required type="password" value={apiKey} />
      </label>
      <button disabled={disabled} type="submit">{buttonLabel}</button>
    </form>
  );
}

export function ProvidersPage() {
  const [snapshot, setSnapshot] = useState<ProvidersSnapshot>();

  useEffect(() => {
    window.api.providers.get().then(setSnapshot);
  }, []);

  if (!snapshot)
    return null;

  return (
    <ProvidersSettingsView
      onLoginChatGPT={async () => {
        const next = await window.api.providers.loginChatGPT();
        setSnapshot(next);
        return next;
      }}
      onRemove={async (providerId) => {
        const next = await window.api.providers.remove(providerId);
        setSnapshot(next);
        return next;
      }}
      onSaveApiKey={async (providerId, apiKey) => {
        const next = await window.api.providers.saveApiKey(providerId, apiKey);
        setSnapshot(next);
        return next;
      }}
      onSetDefaultModel={async (providerId, modelId) => {
        const next = await window.api.providers.setDefaultModel(providerId, modelId);
        setSnapshot(next);
        return next;
      }}
      onSetPrimaryProvider={async (providerId) => {
        const next = await window.api.providers.setPrimaryProvider(providerId);
        setSnapshot(next);
        return next;
      }}
      onSetScope={async (scope) => {
        const next = await window.api.providers.setModelPickerScope(scope);
        setSnapshot(next);
        return next;
      }}
      snapshot={snapshot}
    />
  );
}
